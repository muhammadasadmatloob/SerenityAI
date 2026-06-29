import os
import time
import random
import logging
import httpx
from typing import List, Dict, Any, Optional
import openai
from openai import OpenAI

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_router")

# --- ENVIRONMENT-DRIVEN CONFIGURATION ---
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY")
RUNPOD_BASE_URL = os.getenv("THERAPY_ENGINE_BASE_URL", "https://api.runpod.ai/v1/chat")
ENGINE_MODEL_NAME = os.getenv("ENGINE_MODEL_NAME", "phi-3")
RUNPOD_TIMEOUT = float(os.getenv("RUNPOD_TIMEOUT", "60.0"))
RUNPOD_COOLDOWN = float(os.getenv("RUNPOD_COOLDOWN", "120.0"))
RUNPOD_MAX_CONSECUTIVE_FAILURES = int(os.getenv("RUNPOD_MAX_CONSECUTIVE_FAILURES", "3"))

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
GROQ_LIGHT_MODEL = os.getenv("GROQ_LIGHT_MODEL", "llama-3.1-8b-instant")
GROQ_HEAVY_MODEL = os.getenv("GROQ_HEAVY_MODEL", "llama-3.3-70b-versatile")
GROQ_TIMEOUT = float(os.getenv("GROQ_TIMEOUT", "30.0"))
GROQ_COOLDOWN = float(os.getenv("GROQ_COOLDOWN", "60.0"))
GROQ_MAX_CONSECUTIVE_FAILURES = int(os.getenv("GROQ_MAX_CONSECUTIVE_FAILURES", "3"))

# Client Initializations
runpod_client = None
if RUNPOD_API_KEY and RUNPOD_BASE_URL:
    runpod_client = OpenAI(api_key=RUNPOD_API_KEY, base_url=RUNPOD_BASE_URL)

groq_client = None
if GROQ_API_KEY:
    groq_client = OpenAI(api_key=GROQ_API_KEY, base_url=GROQ_BASE_URL)


class RateLimitError(Exception):
    """Raised when a provider returns a 429 rate limit error."""
    pass


class AIResponse:
    """Standardized response object regardless of provider."""
    def __init__(self, content: str, provider: str, model: str, prompt_tokens: int = 0, completion_tokens: int = 0, total_tokens: int = 0, latency: float = 0.0):
        self.content = content
        self.provider = provider
        self.model = model
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        self.total_tokens = total_tokens
        self.latency = latency

    def to_dict(self) -> dict:
        return {
            "content": self.content,
            "provider": self.provider,
            "model": self.model,
            "usage": {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
                "total_tokens": self.total_tokens
            },
            "latency": self.latency
        }


class ProviderHealth:
    """Tracks circuit breaker and health monitor state in memory."""
    def __init__(self, name: str, max_failures: int, cooldown: float):
        self.name = name
        self.max_failures = max_failures
        self.cooldown = cooldown
        self.consecutive_failures = 0
        self.circuit_broken = False
        self.circuit_broken_until = 0.0

    def record_success(self):
        if self.circuit_broken or self.consecutive_failures > 0:
            logger.info(f"[Circuit Breaker] Provider {self.name} recovered. Resetting failure counts.")
        self.consecutive_failures = 0
        self.circuit_broken = False
        self.circuit_broken_until = 0.0

    def record_failure(self):
        self.consecutive_failures += 1
        logger.warning(f"[Circuit Breaker] Provider {self.name} failure count: {self.consecutive_failures}/{self.max_failures}")
        if self.consecutive_failures >= self.max_failures:
            self.circuit_broken = True
            self.circuit_broken_until = time.time() + self.cooldown
            logger.error(f"[Circuit Breaker] Tripping circuit for {self.name}! Disabled for {self.cooldown}s.")

    def is_available(self) -> bool:
        if self.circuit_broken:
            if time.time() >= self.circuit_broken_until:
                logger.info(f"[Circuit Breaker] Cooldown expired for {self.name}. Re-testing connection.")
                self.circuit_broken = False
                return True
            return False
        return True


# In-memory health states
health_states = {
    "runpod": ProviderHealth("runpod", RUNPOD_MAX_CONSECUTIVE_FAILURES, RUNPOD_COOLDOWN),
    "groq_light": ProviderHealth("groq_light", GROQ_MAX_CONSECUTIVE_FAILURES, GROQ_COOLDOWN),
    "groq_heavy": ProviderHealth("groq_heavy", GROQ_MAX_CONSECUTIVE_FAILURES, GROQ_COOLDOWN),
}


def retry_with_backoff(provider_name: str, client_call, max_retries: int = 2):
    """Executes call with exponential backoff & jitter for transient errors.
    
    Immediately aborts and raises RateLimitError on 429s.
    """
    delay = 1.0
    backoff_factor = 2.0
    for attempt in range(max_retries + 1):
        try:
            start_time = time.time()
            res = client_call()
            latency = time.time() - start_time
            return res, latency
        except Exception as e:
            err_str = str(e).lower()
            # Detect Rate Limit (429)
            if "rate limit" in err_str or "429" in err_str or "limit exceeded" in err_str:
                logger.warning(f"[AI Router] Provider {provider_name} rate limited (429). Advancing immediately.")
                raise RateLimitError(f"Rate limit on {provider_name}")
            
            # Detect transient exceptions (Connection, timeout, server errors)
            is_transient = (
                isinstance(e, (openai.APITimeoutError, openai.APIConnectionError, httpx.TimeoutException, httpx.ConnectError)) or
                "timeout" in err_str or "connection" in err_str or "500" in err_str or "502" in err_str or "503" in err_str or "504" in err_str
            )
            
            if not is_transient or attempt == max_retries:
                logger.error(f"[AI Router] Provider {provider_name} failed on final attempt: {e}")
                raise e
            
            # Apply jittered backoff
            sleep_time = delay * (0.8 + random.random() * 0.4)
            logger.warning(f"[AI Router] Transient error on {provider_name} (attempt {attempt+1}/{max_retries+1}). Retrying in {sleep_time:.2f}s... Error: {e}")
            time.sleep(sleep_time)
            delay *= backoff_factor


class AIRouter:
    """Centralized router responsible for selecting providers, failover, and prompt compression."""
    
    @staticmethod
    def get_providers_for_task(task_type: str) -> List[str]:
        """Maps task type to sorted list of provider options."""
        if task_type == "complex_reasoning":
            # Primary: RunPod, Secondary: Groq Heavy, Tertiary: Groq Light
            return ["runpod", "groq_heavy", "groq_light"]
        elif task_type == "chat":
            # Primary: RunPod, Secondary: Groq Light, Tertiary: Groq Heavy
            return ["runpod", "groq_light", "groq_heavy"]
        else:
            # Primary: Groq Light, Secondary: Groq Heavy, Tertiary: RunPod
            return ["groq_light", "groq_heavy", "runpod"]

    @classmethod
    def complete(
        cls,
        messages: List[Dict[str, str]],
        task_type: str = "chat",
        temperature: float = 0.85,
        top_p: float = 0.95,
        response_format: Optional[Dict[str, Any]] = None,
        max_tokens: Optional[int] = None,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0
    ) -> AIResponse:
        """Centralized route executor with automatic failover, health tracking, and standardized response."""
        providers = cls.get_providers_for_task(task_type)
        
        # Requirement 8: Compress prompts by filtering and limiting history before calling LLM
        compressed_messages = cls.compress_history(messages)
        
        last_exception = Exception("No provider available")
        
        for provider in providers:
            health = health_states[provider]
            if not health.is_available():
                logger.warning(f"[AI Router] Skipping unhealthy provider: {provider}")
                continue
            
            # Attempt execution
            try:
                logger.info(f"[AI Router] Route selected: {provider} for task_type: {task_type}")
                response = cls._execute_provider(
                    provider=provider,
                    messages=compressed_messages,
                    temperature=temperature,
                    top_p=top_p,
                    response_format=response_format,
                    max_tokens=max_tokens,
                    frequency_penalty=frequency_penalty,
                    presence_penalty=presence_penalty
                )
                health.record_success()
                
                # Standardized Log: selected, model, token usage, latency, circuit status
                logger.info(
                    f"[AI Router] SUCCESS | Provider: {response.provider} | Model: {response.model} | "
                    f"Prompt Tokens: {response.prompt_tokens} | Completion Tokens: {response.completion_tokens} | "
                    f"Latency: {response.latency:.2f}s | HealthState: {health.consecutive_failures} consecutive failures"
                )
                return response
            except Exception as e:
                last_exception = e
                health.record_failure()
                logger.warning(f"[AI Router] Fallback triggered! Provider {provider} failed: {e}")
                
        # If all fail, raise the last exception
        raise last_exception

    @classmethod
    def _execute_provider(
        cls,
        provider: str,
        messages: List[Dict[str, str]],
        temperature: float,
        top_p: float,
        response_format: Optional[Dict[str, Any]],
        max_tokens: Optional[int],
        frequency_penalty: float,
        presence_penalty: float
    ) -> AIResponse:
        """Internal provider execution wrapper."""
        if provider == "runpod":
            if not runpod_client:
                raise ValueError("RunPod client not configured")
            
            def call():
                return runpod_client.chat.completions.create(
                    model=ENGINE_MODEL_NAME,
                    messages=messages,
                    temperature=temperature,
                    top_p=top_p,
                    max_tokens=max_tokens,
                    timeout=RUNPOD_TIMEOUT
                )
            
            res, latency = retry_with_backoff("runpod", call)
            usage = getattr(res, "usage", None)
            return AIResponse(
                content=res.choices[0].message.content,
                provider="runpod",
                model=ENGINE_MODEL_NAME,
                prompt_tokens=getattr(usage, "prompt_tokens", 0),
                completion_tokens=getattr(usage, "completion_tokens", 0),
                total_tokens=getattr(usage, "total_tokens", 0),
                latency=latency
            )
            
        elif provider in ("groq_light", "groq_heavy"):
            if not groq_client:
                raise ValueError("Groq client not configured")
            
            model = GROQ_LIGHT_MODEL if provider == "groq_light" else GROQ_HEAVY_MODEL
            
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "top_p": top_p,
                "frequency_penalty": frequency_penalty,
                "presence_penalty": presence_penalty,
                "timeout": GROQ_TIMEOUT
            }
            if response_format:
                kwargs["response_format"] = response_format
            if max_tokens:
                kwargs["max_tokens"] = max_tokens
                
            def call():
                return groq_client.chat.completions.create(**kwargs)
                
            res, latency = retry_with_backoff(provider, call)
            usage = getattr(res, "usage", None)
            return AIResponse(
                content=res.choices[0].message.content,
                provider="groq",
                model=model,
                prompt_tokens=getattr(usage, "prompt_tokens", 0),
                completion_tokens=getattr(usage, "completion_tokens", 0),
                total_tokens=getattr(usage, "total_tokens", 0),
                latency=latency
            )
        else:
            raise ValueError(f"Unknown provider: {provider}")

    @staticmethod
    def compress_history(messages: List[Dict[str, str]], max_turns: int = 10) -> List[Dict[str, str]]:
        """Requirement 8: Reduces token usage by compressing conversation history.
        
        Keeps system instructions and the last `max_turns` of messages to keep context relevant and thin.
        """
        system_msgs = [m for m in messages if m.get("role") == "system"]
        chat_msgs = [m for m in messages if m.get("role") != "system"]
        
        # Keep last 10 messages of conversation history
        trimmed_chat = chat_msgs[-max_turns:]
        return system_msgs + trimmed_chat
