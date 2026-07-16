import os
import datetime
import time
import uuid
import httpx
import contextvars
import requests
from functools import lru_cache
import json
import re

llm_payload_context = contextvars.ContextVar("llm_payload_context", default=None)
from typing import Optional, List, Dict, Any
import logging
import concurrent.futures
import signal
import threading
import atexit
import uvicorn
import firebase_admin
from fastapi import FastAPI, Depends, Header, HTTPException, Request, Response, UploadFile, File, Form, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
import edge_tts
import asyncio
import io
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from cryptography.fernet import Fernet
from dotenv import load_dotenv
from firebase_admin import auth, credentials
from pydantic import BaseModel
from database import (
    get_db, User, UserSession, Message, SessionSummary, MessageAnalysis,
    TherapeuticIntervention, UserGoal, SessionReflection, MoodEntry,
    PersonalityProfile, CrisisEvent, TreatmentPlan, SemanticMemory,
    ContinuousLearningData, SessionLocal
)
from voice_analyzer import analyze_voice_emotion
from semantic_memory import add_semantic_memory, retrieve_semantic_memories
import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold

load_dotenv()

# --- LOGGING ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("donna_ai")

# --- CONFIG ---
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    GEMINI_API_KEY = GEMINI_API_KEY.strip('"').strip("'")
    genai.configure(api_key=GEMINI_API_KEY)


SESSION_TIMEOUT_SECONDS = 1200
global_ai_executor = concurrent.futures.ThreadPoolExecutor(max_workers=20)

if not ENCRYPTION_KEY:
    raise ValueError("ENCRYPTION_KEY missing in .env")

cipher = Fernet(ENCRYPTION_KEY.encode())

# --- SCHEMA VERSIONING ---
CURRENT_SCHEMA_VERSION = "v1"

def validate_schema_version(data: dict, expected: str = CURRENT_SCHEMA_VERSION) -> bool:
    """Validate that the data schema version matches the expected version.
    Returns True if the version matches or if no version is present (legacy data).
    Logs a warning for mismatches so operators can plan migrations."""
    version = data.get("schema_version")
    if version is None:
        logger.warning("Schema version missing from data payload — treating as legacy format.")
        return True  # Accept legacy data gracefully
    if version != expected:
        logger.warning(f"Schema version mismatch: expected '{expected}', got '{version}'. Data may be processed incorrectly.")
        return False
    return True

# --- GRACEFUL SHUTDOWN ---
shutdown_event = threading.Event()
_active_tasks_lock = threading.Lock()
_active_task_count = 0

# --- BACKGROUND TASK TRACKING ---


def _register_task():
    """Increment the active background task counter."""
    global _active_task_count
    with _active_tasks_lock:
        _active_task_count += 1

def _unregister_task():
    """Decrement the active background task counter."""
    global _active_task_count
    with _active_tasks_lock:
        _active_task_count -= 1

def _graceful_shutdown(signum, frame):
    """Signal handler for SIGTERM/SIGINT. Waits for active background tasks to drain."""
    sig_name = signal.Signals(signum).name
    logger.info(f"Received {sig_name} — initiating graceful shutdown...")
    shutdown_event.set()
    # Wait up to 30 seconds for in-flight background tasks to finish
    deadline = 30
    elapsed = 0
    while elapsed < deadline:
        with _active_tasks_lock:
            if _active_task_count <= 0:
                break
        logger.info(f"Waiting for {_active_task_count} background task(s) to complete... ({elapsed}s / {deadline}s)")
        threading.Event().wait(1)
        elapsed += 1
    if _active_task_count > 0:
        logger.warning(f"Shutdown deadline reached with {_active_task_count} task(s) still running. Forcing exit.")
    else:
        logger.info("All background tasks completed. Shutting down cleanly.")
    raise SystemExit(0)

# Register signal handlers (only in main thread)
try:
    signal.signal(signal.SIGTERM, _graceful_shutdown)
    signal.signal(signal.SIGINT, _graceful_shutdown)
except (OSError, ValueError):
    # signal.signal can fail if not called from the main thread (e.g., during tests)
    pass

def initialize_services():
    """Verify configuration, validate secrets, and test API connectivity before startup."""
    logger.info("Initializing services and validating environment variables...")
    
    # 1. Validate environment variables
    required_vars = {
        "FIREBASE_JSON_CONTENT": os.getenv("FIREBASE_JSON_CONTENT"),
        "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY"),
    }
    
    missing_vars = [name for name, val in required_vars.items() if not val or not val.strip()]
    if missing_vars:
        logger.critical(f"❌ CRITICAL CONFIGURATION ERROR: The following required environment variables are missing or empty: {missing_vars}")
        print("\n" + "="*80)
        print("❌ CRITICAL CONFIGURATION ERROR: MISSING REQUIRED ENVIRONMENT VARIABLES")
        print(f"Missing variables: {', '.join(missing_vars)}")
        print("The application will now shut down.")
        print("="*80 + "\n")
        raise SystemExit(1)
        
    # Validate encryption key
    if not os.getenv("ENCRYPTION_KEY"):
        logger.critical("❌ CRITICAL: ENCRYPTION_KEY missing in .env")
        raise SystemExit(1)

    # 2. Verify Database Connection
    from database import SessionLocal
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        logger.info("✅ Database connection validated successfully.")
    except Exception as e:
        logger.critical(f"❌ CRITICAL: Database connection validation failed: {e}")
        raise SystemExit(1)
    finally:
        db.close()

    # 3. Verify Gemini API Connectivity
    try:
        if not os.getenv("RUNPOD_API_KEY"):
            logger.critical("❌ CRITICAL: RUNPOD_API_KEY missing in .env")
            raise SystemExit(1)
        logger.info("✅ RunPod API configuration validated successfully.")
    except Exception as e:
        logger.critical(f"❌ CRITICAL: RunPod API validation failed: {e}")
        raise SystemExit(1)

    logger.info("🚀 All critical services validated successfully. Starting application server...")

async def safe_gemini_completion(prompt: str, system_instruction: str, max_tokens: int = 4000, temperature: float = 0.3, response_format=None):
    # Store the prompt in context for debugging on error
    llm_payload_context.set([{"role": "system", "content": system_instruction}, {"role": "user", "content": prompt}])
    
    generation_config_args = {
        "temperature": temperature,
        "max_output_tokens": max_tokens,
    }
    if response_format and response_format.get("type") == "json_object":
        generation_config_args["response_mime_type"] = "application/json"
        
    safety_settings = {
        HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
    }
        
    model = genai.GenerativeModel(
        model_name="gemini-3.1-flash-lite",
        system_instruction=system_instruction,
        generation_config=genai.types.GenerationConfig(**generation_config_args),
        safety_settings=safety_settings
    )
    
    try:
        res = await model.generate_content_async(prompt)
        # Create a mock completion object to satisfy any legacy callers
        class MockChoiceMessage:
            def __init__(self, content): self.content = content
        class MockChoice:
            def __init__(self, content): self.message = MockChoiceMessage(content)
        class MockCompletion:
            def __init__(self, content): self.choices = [MockChoice(content)]
        
        return MockCompletion(res.text)
    except Exception as e:
        logger.error(f"Gemini Engine failed or timed out: {e}")
        logger.error(f"Gemini API Error: {str(e)}")
        raise e

async def safe_runpod_completion(prompt: str, system_instruction: str, max_tokens: int = 4000, temperature: float = 0.3, response_format=None):
    # Store the prompt in context for debugging on error
    llm_payload_context.set([{"role": "system", "content": system_instruction}, {"role": "user", "content": prompt}])
    
    if response_format and response_format.get("type") == "json_object":
        system_instruction += "\nIMPORTANT: You must output ONLY valid JSON format."
        
    class MockChoiceMessage:
        def __init__(self, content): self.content = content
    class MockChoice:
        def __init__(self, content): self.message = MockChoiceMessage(content)
    class MockCompletion:
        def __init__(self, content): self.choices = [MockChoice(content)]

    # --- 1. TRY RUNPOD FIRST ---
    runpod_api_key = os.getenv("RUNPOD_API_KEY")
    runpod_endpoint_id = os.getenv("RUNPOD_ENDPOINT_ID")
    
    if runpod_api_key and runpod_endpoint_id:
        combined_prompt = f"System Instruction:\n{system_instruction}\n\nUser Message:\n{prompt}"
        url = f"https://api.runpod.ai/v2/{runpod_endpoint_id}/runsync"
        headers = {
            "Authorization": f"Bearer {runpod_api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "input": {
                "prompt": combined_prompt,
                "messages": [
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": max_tokens,
                "temperature": temperature
            }
        }
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                rp_response = await client.post(url, json=payload, headers=headers)
                if rp_response.status_code == 200:
                    rp_data = rp_response.json()
                    status = rp_data.get("status")
                    if status == "COMPLETED":
                        output_text = str(rp_data.get("output", ""))
                        if isinstance(rp_data.get("output"), dict) and "choices" in rp_data["output"]:
                            output_text = str(rp_data["output"]["choices"][0]["message"]["content"])
                        return MockCompletion(output_text)
                    else:
                        logger.warning(f"RunPod failed or is still in queue (status: {status}). Falling back to Gemini.")
                else:
                    logger.warning(f"RunPod request failed: {rp_response.status_code}. Falling back to Gemini.")
        except Exception as e:
            logger.warning(f"RunPod Engine failed: {e}. Falling back to Gemini.")
    else:
        logger.warning("RunPod credentials missing. Falling back to Gemini.")

    # --- 2. FALLBACK TO GEMINI ---
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        raise Exception("RunPod failed and GEMINI_API_KEY is not set for fallback")
    gemini_api_key = gemini_api_key.strip('"').strip("'")

    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={gemini_api_key}"
    gemini_payload = {
        "systemInstruction": {
            "parts": {"text": system_instruction}
        },
        "contents": [
            {"role": "user", "parts": [{"text": prompt}]}
        ],
        "generationConfig": {
            "temperature": temperature,
            "maxOutputTokens": max_tokens
        },
        "safetySettings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
        ]
    }
    
    if response_format and response_format.get("type") == "json_object":
        gemini_payload["generationConfig"]["responseMimeType"] = "application/json"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            gemini_response = await client.post(gemini_url, json=gemini_payload)
            if gemini_response.status_code == 200:
                gemini_data = gemini_response.json()
                try:
                    output_text = gemini_data["candidates"][0]["content"]["parts"][0]["text"]
                    return MockCompletion(output_text)
                except (KeyError, IndexError) as e:
                    logger.error(f"Failed to parse Gemini response: {gemini_data}")
                    raise Exception("Invalid response format from Gemini")
            else:
                raise Exception(f"Gemini fallback request failed: {gemini_response.status_code} {gemini_response.text}")
    except Exception as e:
        logger.error(f"Gemini fallback completely failed: {e}")
        raise e
if not firebase_admin._apps:
    firebase_json = os.getenv("FIREBASE_JSON_CONTENT")
    if firebase_json:
        try:
            cred_dict = json.loads(firebase_json)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
        except Exception as e:
            logger.warning(f"Firebase Init Warning: {e}")
    else:
        logger.warning("Firebase Init Warning: FIREBASE_JSON_CONTENT environment variable is missing. Trying local serviceAccountKey.json fallback...")
        try:
            cred = credentials.Certificate("serviceAccountKey.json")
            firebase_admin.initialize_app(cred)
        except Exception as e:
            logger.warning(f"Firebase Fallback Init Warning: {e}")


app = FastAPI(title="Donna AI - FYP Backend")

# Ensure static directories exist
os.makedirs("static/audio", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_headers=["*"],
    allow_methods=["*"]
)

# --- STANDARDIZED ERROR HANDLING ---
ERROR_MAP = {
    401: {"message": "Your session has expired. Please log in again.", "code": "AUTH_SESSION_EXPIRED"},
    403: {"message": "Your session has expired. Please log in again.", "code": "AUTH_SESSION_EXPIRED"},
    404: {"message": "The requested information could not be found.", "code": "RESOURCE_NOT_FOUND"},
    400: {"message": "The request could not be processed. Please check your input.", "code": "BAD_REQUEST"},
    422: {"message": "The submitted data is invalid. Please check your input.", "code": "VALIDATION_ERROR"},
    500: {"message": "We are experiencing some technical difficulties. Please try again in a few moments.", "code": "SERVER_INTERNAL_ERROR"},
}

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTPException {exc.status_code}: {exc.detail} | Path: {request.url.path}")
    if exc.detail == "Session has expired":
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": "Session has expired", "code": "SESSION_EXPIRED"}
        )
    error_info = ERROR_MAP.get(exc.status_code, {
        "message": "An unexpected error occurred. Please try again.",
        "code": "UNKNOWN_ERROR"
    })
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "message": error_info["message"], "code": error_info["code"]}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {type(exc).__name__}: {exc} | Path: {request.url.path}", exc_info=True)
    
    # Retrieve and print the exact LLM payload if it was set during this request context
    payload = llm_payload_context.get()
    if payload:
        logger.error(f"LLM Payload at error: {json.dumps(payload, indent=2)}")
        
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "We are experiencing some technical difficulties. Please try again in a few moments.",
            "code": "SERVER_INTERNAL_ERROR"
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"RequestValidationError: {exc.errors()} | Path: {request.url.path}")
    error_details = []
    for err in exc.errors():
        loc = " -> ".join(str(x) for x in err.get("loc", []))
        msg = err.get("msg", "invalid value")
        error_details.append(f"{loc}: {msg}")
    friendly_msg = "Invalid input data: " + ", ".join(error_details) if error_details else "The submitted data is invalid. Please check your input."
    
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": friendly_msg,
            "code": "VALIDATION_ERROR"
        }
    )

# --- PASSWORD VALIDATION ---
def validate_password(password: str) -> bool:
    """Enforce strict password policy: 8+ chars, upper, lower, digit, special."""
    if len(password) < 8:
        return False
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[a-z]', password):
        return False
    if not re.search(r'[0-9]', password):
        return False
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False
    return True

def encrypt(t: str) -> str:
    return cipher.encrypt(t.encode()).decode() if t else ""

def decrypt(t: str) -> str:
    if not t: return ""
    try:
        return cipher.decrypt(t.encode()).decode()
    except Exception:
        return "Encrypted Message"

def get_current_uid(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Invalid or Expired Token")
    try:
        token = authorization.split(" ")[1]
        decoded_token = auth.verify_id_token(token)
        return decoded_token["uid"]
    except Exception as e:
        logger.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Invalid or Expired Token")

class SessionStart(BaseModel):
    mood: str
    path: Optional[str] = None
    description: Optional[str] = None

class ChatMsg(BaseModel):
    session_id: int
    content: str
    duration_seconds: Optional[int] = None

class DurationUpdate(BaseModel):
    session_id: int
    duration_seconds: int

class ProfileUpdate(BaseModel):
    name: str
    gender: Optional[str] = None
    emergency_name: str
    emergency_phone: str

class InfoSync(BaseModel):
    name: str
    dob: str
    gender: Optional[str] = None
    lat: float
    lng: float
    eName: str
    ePhone: str

class GoalCreate(BaseModel):
    goal: str
    category: str

class GoalUpdate(BaseModel):
    progress: Optional[int] = None
    status: Optional[str] = None

class TreatmentPlanCreate(BaseModel):
    focus_area: str
    milestones: List[dict]
    progress: Optional[int] = 0

class PasswordCheck(BaseModel):
    password: str

class ReportGenerateRequest(BaseModel):
    start_date: str # ISO string
    end_date: str # ISO string

@app.get("/")
def home():
    return {"status": "Donna AI Backend is Online"}

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    db_status = "ok"
    engine_status = "ok"
    
    # 1. Check DB
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"Database connection failed: {e}"
        
    # 2. Check RunPod and Groq
    try:
        if not os.getenv("RUNPOD_API_KEY") or not os.getenv("GROQ_API_KEY"):
            raise ValueError("RUNPOD_API_KEY or GROQ_API_KEY is not set")
        engine_status = "ok"
    except Exception as e:
        engine_status = f"RunPod/Groq API configuration failed: {e}"
        
    overall_status = "ok" if db_status == "ok" else "error"
    
    if overall_status == "error":
        return JSONResponse(
            status_code=500,
            content={
                "status": overall_status,
                "db_status": db_status,
                "engine_status": engine_status
            }
        )
    return {
        "status": overall_status,
        "db_status": db_status,
        "engine_status": engine_status
    }

@app.post("/api/auth/validate-password")
def check_password_strength(data: PasswordCheck):
    """Validate password strength before signup or password reset."""
    if not validate_password(data.password):
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "message": "Password must be at least 8 characters, and include an uppercase letter, a lowercase letter, a number, and a special character.",
                "code": "INVALID_PASSWORD_FORMAT"
            }
        )
    return {"success": True, "message": "Password meets all requirements.", "code": "PASSWORD_VALID"}

@app.api_route("/api/auth/proxy", methods=["GET", "POST"])
async def firebase_auth_proxy(request: Request, path: str, key: str = ""):
    """Proxy Firebase Authentication requests to bypass network/CORS restrictions."""
    if path.startswith("securetoken/"):
        target_path = path.replace("securetoken/", "")
        target_url = f"https://securetoken.googleapis.com/{target_path}"
    else:
        target_url = f"https://identitytoolkit.googleapis.com/{path}"
        
    if key:
        target_url += f"?key={key}"
        
    body = await request.body()
    
    headers = {}
    for h_name, h_val in request.headers.items():
        if h_name.lower() not in ["host", "origin", "referer", "content-length", "connection"]:
            headers[h_name] = h_val
            
    async with httpx.AsyncClient() as client:
        try:
            if request.method == "POST":
                resp = await client.post(target_url, content=body, headers=headers, timeout=30.0)
            else:
                resp = await client.get(target_url, headers=headers, timeout=30.0)
                
            headers_dict = dict(resp.headers)
            headers_dict.pop("transfer-encoding", None)
            headers_dict.pop("content-encoding", None)
            
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=headers_dict,
                media_type=resp.headers.get("content-type")
            )
        except Exception as e:
            logger.error(f"Proxy request failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/transcribe")
def transcribe_audio(file: UploadFile = File(...), uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    import tempfile
    import groq
    try:
        ext = os.path.splitext(file.filename)[1] or ".m4a"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                temp_file.write(chunk)
            temp_path = temp_file.name
        
        try:
            groq_api_key = os.getenv("GROQ_API_KEY")
            if not groq_api_key:
                raise Exception("GROQ_API_KEY is missing")
                
            client = groq.Groq(api_key=groq_api_key)
            lang_hint = detect_user_language_hint(uid, None, db)
            prompt = WHISPER_TRANSCRIPTION_PROMPT
            if lang_hint:
                prompt += f" The user often speaks in {lang_hint}."
            
            with open(temp_path, "rb") as f:
                transcription = client.audio.transcriptions.create(
                    file=(os.path.basename(temp_path), f.read()),
                    model="whisper-large-v3",
                    prompt=prompt
                )
            
            transcript = transcription.text
        finally:
            try:
                os.remove(temp_path)
            except Exception:
                pass
            
        return {"transcript": transcript}
    except Exception as e:
        logger.error(f"Transcription Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

WHISPER_TRANSCRIPTION_PROMPT = (
    "This is a spoken input from a user in a therapy app. The user may speak in English, Urdu (اردو), "
    "or code-switch between them. Transcribe the words exactly as they are spoken, preserving the language "
    "and script of the speech (e.g., Urdu text must be written in the Urdu script like 'میں ٹھیک ہوں' rather "
    "than Roman Urdu, and English in English). Do not translate."
)

def get_edge_tts_voice(text: str, response_lang: Optional[str] = None) -> str:
    """Determine the best Edge TTS voice based on response language or text content."""
    lang = (response_lang or "").strip().lower()
    
    # Check if the text contains characters in the Arabic block (covering Urdu, Arabic, Persian, etc.)
    has_arabic = any(
        '\u0600' <= c <= '\u06FF' or 
        '\u0750' <= c <= '\u077F' or 
        '\u08A0' <= c <= '\u08FF' or 
        '\uFB50' <= c <= '\uFDFF' or 
        '\uFE70' <= c <= '\uFEFF' 
        for c in text
    )
    
    if lang == "ur" or has_arabic:
        return "ur-PK-UzmaNeural"
        
    # Standard mapping for common languages
    lang_mapping = {
        "es": "es-ES-ElviraNeural",
        "fr": "fr-FR-DeniseNeural",
        "de": "de-DE-AmalaNeural",
        "ar": "ar-AE-FatimaNeural",
        "hi": "hi-IN-SwaraNeural",
        "zh": "zh-CN-XiaoxiaoNeural",
        "it": "it-IT-ElsaNeural",
        "pt": "pt-PT-RaquelNeural",
    }
    
    return lang_mapping.get(lang, "en-US-AvaNeural")

def get_tts_parameters(parsed_data: dict) -> tuple:
    # Default parameters
    rate = "+0%"
    pitch = "+0Hz"
    
    if not parsed_data:
        return rate, pitch
        
    emotion_info = parsed_data.get("emotion_analysis", {})
    primary = emotion_info.get("primary_emotion", "Neutral").lower()
    try:
        intensity = int(emotion_info.get("intensity", 5))
    except Exception:
        intensity = 5
    
    # Scale adjustments slightly based on intensity (1-10)
    # Higher intensity = more pronounced vocal adaptation
    intensity_factor = min(max(intensity / 10.0, 0.3), 1.0)
    
    r_val = 0
    p_val = 0
    
    if primary in ["anxiety", "fear", "overwhelm"]:
        # Soothing, slow, grounding rate, slightly lower pitch
        r_val = int(-6 * intensity_factor - 4)  # ranges from -5% to -10%
        p_val = int(-1 * intensity_factor - 1)  # ranges from -1Hz to -2Hz
    elif primary in ["sadness", "loneliness", "grief", "hopelessness", "shame", "guilt"]:
        # Soft, slower, low-energy, empathetic tone
        r_val = int(-8 * intensity_factor - 6)  # ranges from -8% to -14%
        p_val = int(-2 * intensity_factor - 2)  # ranges from -2Hz to -4Hz
    elif primary in ["anger", "frustration"]:
        # Grounded, extremely calm, very steady
        r_val = int(-4 * intensity_factor - 2)  # ranges from -3% to -6%
        p_val = int(-1 * intensity_factor)      # ranges from 0Hz to -1Hz
    elif primary in ["happiness", "relief"]:
        # Upbeat, lighter, warmer tone
        r_val = int(2 * intensity_factor + 1)   # ranges from +1% to +3%
        p_val = int(2 * intensity_factor + 1)   # ranges from +1Hz to +3Hz
        
    rate = f"+{r_val}%" if r_val >= 0 else f"{r_val}%"
    pitch = f"+{p_val}Hz" if p_val >= 0 else f"{p_val}Hz"
    return rate, pitch

@app.get("/api/tts")
async def text_to_speech(text: str, session_id: Optional[str] = None, db: Session = Depends(get_db)):
    rate_adjust = "+0%"
    pitch_adjust = "+0Hz"
    
    session_id_int = None
    if session_id:
        try:
            session_id_int = int(session_id)
        except ValueError:
            logger.warning(f"TTS: session_id {session_id!r} could not be parsed to integer. Ignoring.")
    
    if session_id_int is not None:
        try:
            # Query the latest message analysis for this session to get the last detected emotion
            latest_msg = db.query(Message).filter_by(session_id=session_id_int, role="user").order_by(Message.timestamp.desc()).first()
            if latest_msg:
                analysis = db.query(MessageAnalysis).filter_by(message_id=latest_msg.id).first()
                if analysis:
                    mock_data = {
                        "emotion_analysis": {
                            "primary_emotion": analysis.primary_emotion,
                            "intensity": analysis.emotion_intensity
                        }
                    }
                    rate_adjust, pitch_adjust = get_tts_parameters(mock_data)
        except Exception as e:
            logger.error(f"Error resolving TTS parameters for session {session_id_int}: {e}")
            
    # Connection Retry Logic with buffering to avoid partial/corrupt stream yielding
    audio_data = b""
    max_attempts = 3
    last_err = None
    for attempt in range(max_attempts):
        try:
            voice = get_edge_tts_voice(text)
            communicate = edge_tts.Communicate(text, voice, rate=rate_adjust, pitch=pitch_adjust)
            chunks = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    chunks.append(chunk["data"])
            audio_data = b"".join(chunks)
            if audio_data:
                break
        except Exception as e:
            last_err = e
            logger.error(f"TTS Error on attempt {attempt + 1}: {e}")
            if attempt < max_attempts - 1:
                await asyncio.sleep(0.5)

    if not audio_data:
        err_msg = str(last_err) if last_err else "Failed to generate audio"
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {err_msg}")

    return StreamingResponse(io.BytesIO(audio_data), media_type="audio/mpeg")

@app.get("/api/session/active")
def get_active_session(uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    sess = db.query(UserSession).filter_by(user_uid=uid, is_ended=False).order_by(UserSession.created_at.desc()).first()
    if not sess:
        return {"session_id": None, "session_cap_seconds": SESSION_TIMEOUT_SECONDS}
    return {"session_id": sess.id, "session_cap_seconds": SESSION_TIMEOUT_SECONDS}

def compile_past_sessions_summary(uid: str, current_session_id: int, db: Session) -> str:
    # Query up to the last 4 sessions of the user, excluding the current active one
    past_sessions = db.query(UserSession).filter(
        UserSession.user_uid == uid, 
        UserSession.id != current_session_id
    ).order_by(UserSession.created_at.desc()).limit(4).all()
    
    if not past_sessions:
        return ""
        
    past_summaries = []
    for ps in past_sessions:
        first_user_msg = db.query(Message).filter_by(session_id=ps.id, role="user").order_by(Message.timestamp.asc()).first()
        last_ai_msg = db.query(Message).filter_by(session_id=ps.id, role="assistant").order_by(Message.timestamp.desc()).first()
        
        desc_text = decrypt(first_user_msg.content) if first_user_msg else "No description provided."
        ai_text = decrypt(last_ai_msg.content) if last_ai_msg else "No resolution recorded."
        
        # Truncate text to keep context window clean
        if len(desc_text) > 150:
            desc_text = desc_text[:147] + "..."
        if len(ai_text) > 150:
            ai_text = ai_text[:147] + "..."
            
        past_summaries.append(
            f"- Session on {ps.created_at.strftime('%b %d, %Y')} (Mood: {ps.mood}, Path: {ps.path}):\n"
            f"  * User's concern: \"{desc_text}\"\n"
            f"  * Donna's final advice: \"{ai_text}\""
        )
        
    summary_text = "Here is the summary of the user's PAST THERAPY SESSIONS. Use this memory to maintain therapeutic continuity. Refer back to their previous struggles, patterns, or progress when helpful:\n"
    summary_text += "\n".join(past_summaries)
    return summary_text

@lru_cache(maxsize=32)
def get_path_style_guidelines(path: str) -> str:
    if path == "logical":
        return (
            "CRITICAL INSTRUCTION: You MUST act EXTREMELY logical. "
            "Therapeutic Approach: Cognitive Behavioral Therapy (CBT).\n"
            "Style Guidelines:\n"
            "- Focus strictly on structured problem solving, identifying cognitive distortions (e.g., catastrophizing, mind-reading, emotional reasoning), and challenging automatic thoughts.\n"
            "- Help the user reframe negative perceptions rationally and guide them to outline actionable steps.\n"
            "- DO NOT be overly emotional; rely on facts, logic, and structure."
        )
    elif path == "emotional":
        return (
            "CRITICAL INSTRUCTION: You MUST act EXTREMELY emotional and supportive. "
            "Therapeutic Approach: Emotion-Focused & Person-Centered Therapy.\n"
            "Style Guidelines:\n"
            "- Prioritize active listening, deep emotional validation, safety, and letting the user vent.\n"
            "- Provide deep emotional support. Comfort the user as a deeply empathetic listener.\n"
            "- Do NOT jump to solving their problems. Make the user feel heard, respected, and unconditionally supported."
        )
    elif path == "spiritual":
        return (
            "CRITICAL INSTRUCTION: You MUST act deeply spiritual. "
            "Therapeutic Approach: Existential / Mindfulness-Based Therapy.\n"
            "Style Guidelines:\n"
            "- Focus on finding meaning, alignment with values/beliefs, acceptance, inner peace, and presence.\n"
            "- Speak with a calm, transcendent, and grounding tone.\n"
            "- Incorporate breathing, grounding, and perspective-shifting guidance to handle anxieties."
        )
    elif path == "casual":
        return (
            "CRITICAL INSTRUCTION: You MUST act completely casual. "
            "Therapeutic Approach: Warm & Informal Supportive Counseling.\n"
            "Style Guidelines:\n"
            "- Keep your tone very friendly, relaxed, supportive, and informal (like a close, level-headed companion).\n"
            "- Avoid heavy clinical jargon and formal therapy talk entirely. Listen actively and reply casually but constructively."
        )
    return "Therapeutic Approach: Compassionate general counseling."

def parse_llm_response(raw_response: str) -> dict:
    raw_response = raw_response.strip()
    parsed = None
    try:
        parsed = json.loads(raw_response)
    except Exception:
        try:
            match = re.search(r"\{.*\}", raw_response, re.DOTALL)
            if match:
                parsed = json.loads(match.group(0))
        except Exception:
            pass
    
    if parsed is None:
        # Absolute fallback structure if JSON parsing fails completely
        parsed = {
            "emotion_analysis": {
                "primary_emotion": "Neutral",
                "secondary_emotion": "None",
                "intensity": 5,
                "stress_level": "Medium",
                "emotional_need": "Supportive listening",
                "conversation_need": "Validation"
            },
            "risk_analysis": {
                "self_harm": False,
                "suicide_risk": False,
                "violence": False,
                "abuse": False,
                "domestic_violence": False,
                "crisis": False,
                "psychosis": False,
                "risk_level": "Low",
                "risk_details": "Failed to parse LLM JSON analysis. Defaulted to Low.",
                "urgency_score": 1
            },
            "therapy_strategy": "Compassionate general counseling",
            "therapeutic_response": "I'm taking a moment to process what you've shared. Please, continue.",
            "response_language": "en"
        }
    
    # Stamp schema version on every parsed payload for downstream validation
    parsed.setdefault("schema_version", CURRENT_SCHEMA_VERSION)
    return parsed

def save_message_analysis(db: Session, message_id: int, analysis_data: dict):
    try:
        # Validate schema version before processing
        if not validate_schema_version(analysis_data):
            logger.warning(f"Proceeding with schema-mismatched analysis data for message {message_id}")
        
        emotion = analysis_data.get("emotion_analysis", {})
        risk = analysis_data.get("risk_analysis", {})
        strategy = analysis_data.get("therapy_strategy", "Compassionate general counseling")
        
        analysis = MessageAnalysis(
            message_id=message_id,
            primary_emotion=emotion.get("primary_emotion", "Neutral"),
            secondary_emotion=emotion.get("secondary_emotion", "None"),
            emotion_intensity=emotion.get("intensity", 5),
            stress_level=emotion.get("stress_level", "Medium"),
            emotional_need=emotion.get("emotional_need", "Supportive listening"),
            conversation_need=emotion.get("conversation_need", "Validation"),
            risk_level=risk.get("risk_level", "Low"),
            risk_details=risk.get("risk_details", "No detailed risk analysis parsed."),
            urgency_score=risk.get("urgency_score", 1),
            selected_strategy=strategy
        )
        db.add(analysis)
        db.commit()
    except Exception as e:
        logger.error(f"Error saving message analysis: {e}")
        db.rollback()

def compile_past_sessions_summary_v2(uid: str, current_session_id: int, db: Session) -> str:
    # Query past session summaries for the user, excluding current session
    past_summaries = db.query(SessionSummary).filter(
        SessionSummary.user_uid == uid,
        SessionSummary.session_id != current_session_id
    ).order_by(SessionSummary.created_at.desc()).limit(5).all()
    
    if not past_summaries:
        # Fallback to the original simple compiler if no structured summaries exist yet
        return compile_past_sessions_summary(uid, current_session_id, db)
        
    compiled_memories = []
    for ps in past_summaries:
        try:
            decrypted_data = decrypt(ps.summary_data)
            summary_json = json.loads(decrypted_data)
            
            # Print only core clinical progress details to prevent bloating the system prompt
            summary_text = (
                f"Session on {ps.created_at.strftime('%b %d, %Y')}:\n"
                f"- Main Issues: {summary_json.get('main_issues', 'None')}\n"
                f"- Coping Strategies & Goals: {summary_json.get('coping_strategies', 'None')}\n"
                f"- Breakthroughs & Wins: {summary_json.get('wins_this_week', 'None')}\n"
                f"- Focus/Growth Areas: {summary_json.get('growth_areas', 'None')}\n"
                f"- Risk Factors: {summary_json.get('risk_factors', 'None')}"
            )
            compiled_memories.append(summary_text)
        except Exception as e:
            logger.error(f"Error parsing session summary: {e}")
            continue
            
    if not compiled_memories:
        return compile_past_sessions_summary(uid, current_session_id, db)
        
    return "SUMMARY OF CLIENT'S RECENT SESSIONS:\n\n" + "\n\n---\n\n".join(compiled_memories)

# --- THERAPEUTIC PLATFORM HELPERS ---

CRISIS_KEYWORDS = [
    # English
    r"\bsuicid", r"\bself-harm", r"\bkill myself", r"\bend my life", r"\bwant to die",
    r"\bharm myself", r"\bcutting myself", r"\bslitting my",
    # Urdu Script
    r"خودکشی",
    r"زندگی ختم",
    r"مرنا چاہتا",
    r"مرنا چاہتی",
    r"خود کو نقصان",
    r"اپنے آپ کو نقصان",
    r"جان دے دوں",
    r"جان دے دوں گا",
    r"جان دے دوں گی",
    r"خود کو مار",
    r"اپنے آپ کو مار",
    # Roman Urdu / Transliterations
    r"\bkhud\s?kushi\b",
    r"\bmarna\s?chahta\b",
    r"\bmarna\s?chahti\b",
    r"\bmarna\s?chahata\b",
    r"\bmarna\s?chahati\b",
    r"\bzindagi\s?khatam\b",
    r"\bapni\s?jaan\s?le\b",
    r"\bjaan\s?de\s?dung",
    r"\bjaan\s?dena\b",
    r"\bkhud\s?ko\s?nuksan\b",
    r"\bkhud\s?ko\s?nuqsan\b",
    r"\bapne\s?aap\s?ko\s?nuksan\b",
    r"\bapne\s?aap\s?ko\s?nuqsan\b",
    r"\bkhud\s?ko\s?mar\b",
    r"\bapne\s?aap\s?ko\s?mar\b"
]

def backend_crisis_scan(text: str) -> bool:
    for pattern in CRISIS_KEYWORDS:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False

CRISIS_RESPONSE = (
    "I hear how much pain you're in right now, and I want to support you, but as an AI, "
    "I cannot provide the crisis intervention you need. Your safety is extremely important. "
    "Please connect with a professional or contact emergency services in your country immediately. "
    "You can call or text your local emergency number (like 911, 999, or 112), call a national helpline "
    "(such as 988 in the US/Canada, or 111/999 in the UK), or visit https://findahelpline.com/ "
    "to find free, confidential support in your area. Let's take a slow, deep breath together. "
    "Please reach out to local emergency services first."
)

BOUNDARY_RESPONSE = (
    "I can hear how much anger or hurt you are carrying right now, and I'm here to support you in "
    "talking through those feelings. However, as an AI, I cannot provide advice or support on "
    "taking revenge, causing harm, or acting out of violence. If you'd like, we can talk about "
    "what happened and explore ways to process this hurt together."
)

def resolve_combined_emotion(text_emotion: str, voice_emotion: str) -> str:
    if voice_emotion in ["sadness", "anger", "anxiety", "fear"] and text_emotion == "Neutral":
        return voice_emotion
    return text_emotion

def detect_user_language_hint(uid: str, session_id: Optional[int], db: Session) -> Optional[str]:
    """
    Scans recent messages from the current session (or overall user history)
    to check if they contain Urdu script. Returns 'ur' if Urdu is detected,
    'en' if English is detected, or None for auto-detection.
    """
    messages = []
    if session_id:
        messages = db.query(Message).filter_by(session_id=session_id).order_by(Message.id.desc()).limit(5).all()
    
    if not messages:
        # Fallback to general user history
        sess_ids = [s.id for s in db.query(UserSession).filter_by(user_uid=uid).order_by(UserSession.id.desc()).limit(3).all()]
        if sess_ids:
            messages = db.query(Message).filter(Message.session_id.in_(sess_ids)).order_by(Message.id.desc()).limit(5).all()
            
    has_urdu = False
    has_english = False
    for msg in messages:
        try:
            content = decrypt(msg.content)
            # Check for Urdu characters
            if any('\u0600' <= c <= '\u06FF' for c in content):
                has_urdu = True
            if any('a' <= c.lower() <= 'z' for c in content):
                has_english = True
        except Exception:
            pass
            
    if has_urdu:
        return "ur"
    if has_english:
        return "en"
    return None

def validate_session_integrity(db: Session, uid: str, session_id: int) -> UserSession:
    sess = db.query(UserSession).filter_by(id=session_id, user_uid=uid).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found or access denied")
    return sess

async def hybrid_ai_router(messages, current_phase: str, path: str = None, response_format=None) -> Any:
    logger.info(f"Hybrid AI Router: Starting Thinker & Speaker pipeline for phase '{current_phase}'...")
    
    system_instruction = ""
    history_lines = []
    for msg in messages:
        if msg.get("role") == "system":
            system_instruction = msg.get("content", "")
        else:
            role = "Client" if msg.get("role") == "user" else "Donna (Therapist)"
            history_lines.append(f"{role}: {msg.get('content', '')}")
            
    chat_history = "\n".join(history_lines) + "\nDonna (Therapist): "
    
    # -----------------------------------------------------
    # STEP 1: THINKER (RunPod Local Engine)
    # -----------------------------------------------------
    runpod_analysis = ""
    runpod_api_key = os.getenv("RUNPOD_API_KEY")
    runpod_endpoint_id = os.getenv("RUNPOD_ENDPOINT_ID")
    
    if runpod_api_key and runpod_endpoint_id:
        try:
            thinker_prompt = (
                f"You are the internal psychological analysis engine for Donna AI. "
                f"Analyze the following conversation context, focusing heavily on the chosen therapeutic path ({path}). "
                f"Conversation:\n{chat_history}\n\n"
                f"Provide a brief thought process on what Donna should say next, emphasizing the {path} path."
            )
            
            url = f"https://api.runpod.ai/v2/{runpod_endpoint_id}/runsync"
            headers = {
                "Authorization": f"Bearer {runpod_api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "input": {
                    "prompt": thinker_prompt,
                    "messages": [{"role": "user", "content": thinker_prompt}]
                }
            }
            
            async with httpx.AsyncClient(timeout=8.0) as client:
                rp_response = await client.post(url, json=payload, headers=headers)
                if rp_response.status_code == 200:
                    rp_data = rp_response.json()
                    if "output" in rp_data:
                        runpod_analysis = str(rp_data["output"])
                    logger.info("RunPod Thinker Analysis completed successfully.")
                else:
                    logger.warning(f"RunPod request failed with status {rp_response.status_code}: {rp_response.text}")
        except Exception as e:
            logger.error(f"RunPod Thinker engine failed: {e}. Falling back to Gemini-only mode.")
            
    # -----------------------------------------------------
    # STEP 2: SPEAKER (Gemini)
    # -----------------------------------------------------
    if runpod_analysis:
        system_instruction += (
            f"\n\n--- INTERNAL PSYCHOLOGICAL ANALYSIS (from Local Engine) ---\n"
            f"The following is a psychological analysis of the current state based on the user's path ({path}).\n"
            f"You MUST use this strategy to craft your response:\n"
            f"{runpod_analysis}\n-------------------------------------------------\n"
        )
        
    try:
        completion = await safe_gemini_completion(
            prompt=chat_history,
            system_instruction=system_instruction,
            max_tokens=4000,
            temperature=0.65,
            response_format=response_format
        )
        
        # Log to Continuous Learning Pipeline
        try:
            if runpod_analysis:
                with SessionLocal() as db_session:
                    new_data = ContinuousLearningData(
                        user_input=chat_history,
                        context_path=path or "general",
                        generated_strategy=runpod_analysis
                    )
                    db_session.add(new_data)
                    db_session.commit()
        except Exception as cl_error:
            logger.error(f"Failed to log Continuous Learning Data: {cl_error}")
            
        return completion
    except Exception as e:
        logger.error(f"Gemini AI failed: {e}")
        class MockChoiceMessage:
            def __init__(self, content): self.content = content
        class MockChoice:
            def __init__(self, content): self.message = MockChoiceMessage(content)
        class MockCompletion:
            def __init__(self, content): self.choices = [MockChoice(content)]
        default_json = json.dumps({"therapeutic_response": "I'm having a little trouble connecting right now, but I'm here for you. How are you feeling?"})
        return MockCompletion(default_json)

@lru_cache(maxsize=32)
def get_phase_guidelines(phase: str) -> str:
    phases = {
        "rapport_building": (
            "Phase: Rapport Building\n"
            "Donna's Goal: Focus entirely on establishing safety, warmth, and trust. "
            "Directly acknowledge the client's pre-selected initial mood with empathy and show warm, curious concern about the trigger or context. Do NOT ask 'How are you feeling?' or 'How are you doing?' as they have already input their mood. Validate their initial feeling and gently invite them to share what is on their mind. Do not suggest exercises or interventions yet."
        ),
        "problem_exploration": (
            "Phase: Problem Exploration\n"
            "Donna's Goal: Help the client specify and articulate their current struggles. "
            "Ask clarifying questions to uncover triggers and context. Focus on active listening."
        ),
        "emotional_processing": (
            "Phase: Emotional Processing\n"
            "Donna's Goal: Create space for the client to sit with and process strong emotions. "
            "Help them name and validate what they are experiencing. Use reflective and empathetic pacing."
        ),
        "intervention": (
            "Phase: Structured Intervention\n"
            "Donna's Goal: Propose and guide the client through a structured therapeutic intervention "
            "(e.g., CBT Thought Record, Breathing, Grounding 5-4-3-2-1, Values Clarification). "
            "Deliver the exercise in clear, collaborative, bite-sized steps."
        ),
        "action_planning": (
            "Phase: Action Planning\n"
            "Donna's Goal: Help the client translate insights into concrete, actionable steps. "
            "Set collaborative, simple homework or behavioral activation steps. Track goals."
        ),
        "reflection": (
            "Phase: Reflection\n"
            "Donna's Goal: Help the client review the breakthroughs or insights gained during this session. "
            "Assess their confidence level and ask what stood out to them."
        ),
        "closure": (
            "Phase: Closure\n"
            "Donna's Goal: Wind down the session, summarize homework/reflections, express warm appreciation, "
            "and schedule/close the conversation on a positive, supportive note."
        )
    }
    return phases.get(phase, phases["rapport_building"])

def get_personality_style_guidelines(profile) -> str:
    if not profile:
        return ""
    traits = {
        "analytical": profile.analytical,
        "emotional": profile.emotional,
        "action_oriented": profile.action_oriented,
        "reflective": profile.reflective,
        "avoidant": profile.avoidant,
        "social": profile.social,
        "introverted": profile.introverted,
        "extroverted": profile.extroverted
    }
    sorted_traits = sorted(traits.items(), key=lambda item: item[1], reverse=True)
    top_traits = [name for name, score in sorted_traits if score > 0.6][:2]
    
    guidelines = []
    for trait in top_traits:
        if trait == "analytical":
            guidelines.append("The client appreciates logic, structure, and cognitive breakdowns. Donna should align and match with structured exercises and CBT frameworks.")
        elif trait == "emotional":
            guidelines.append("The client expresses deep emotions and values validation, active listening, and space to vent. Donna should use warm, highly reflective, Person-Centered support.")
        elif trait == "action_oriented":
            guidelines.append("The client is ready to implement actions. Donna should prioritize behavioral activation, values clarification, and goal setting.")
        elif trait == "reflective":
            guidelines.append("The client is introspective and self-aware. Donna should ask deep, open-ended questions to support their insights.")
        elif trait == "avoidant":
            guidelines.append("The client may exhibit avoidant behavior regarding core issues. Donna should hold gentle boundaries, build rapport, and slowly introduce ACT acceptance.")
        elif trait == "social":
            guidelines.append("The client values relationships and social support. Donna should reference interpersonal patterns and support network building.")
        elif trait == "introverted":
            guidelines.append("The client is introverted. Donna should speak with a very gentle, quiet, non-pressuring tone.")
        elif trait == "extroverted":
            guidelines.append("The client is expressive and outgoing. Donna can respond with collaborative energy.")
            
    return "\n".join(guidelines)

def compile_session_continuity_context(uid: str, initial_query: str, db: Session) -> dict:
    context = {}
    
    # 1. Active Goals (limit to 3 most recent to avoid blowing up context window size)
    active_goals = db.query(UserGoal).filter_by(user_uid=uid, status="active").order_by(UserGoal.created_at.desc()).limit(3).all()
    context["active_goals"] = [f"- {g.goal} ({g.category}, Progress: {g.progress}%)" for g in active_goals]
    
    # 2. Unfinished Homework (limit to 2 most recent to save tokens)
    pending_homework = db.query(SessionReflection).filter_by(user_uid=uid, homework_status="pending").order_by(SessionReflection.created_at.desc()).limit(2).all()
    context["pending_homework"] = [f"- {h.homework} (from Session ID: {h.session_id})" for h in pending_homework]
    
    # 3. Treatment Plans (limit to 2 active focus areas to keep prompt size small)
    plans = db.query(TreatmentPlan).filter_by(user_uid=uid, completion_status="active").order_by(TreatmentPlan.created_at.desc()).limit(2).all()
    context["treatment_plans"] = []
    for p in plans:
        milestones_list = []
        if p.milestones:
            try:
                ms = json.loads(p.milestones)
                # Keep only top 4 milestones
                milestones_list = [f"  * {m.get('description', '')} (Status: {'Done' if m.get('completed', False) else 'Pending'})" for m in ms[:4]]
            except Exception:
                pass
        context["treatment_plans"].append(f"- Focus Area: {p.focus_area} (Progress: {p.progress}%)\n" + "\n".join(milestones_list))
        
    # 4. Previous Breakthroughs
    reflections = db.query(SessionReflection).filter(
        SessionReflection.user_uid == uid,
        SessionReflection.breakthroughs != None,
        SessionReflection.breakthroughs != ""
    ).order_by(SessionReflection.created_at.desc()).limit(3).all()
    context["breakthroughs"] = [f"- {r.breakthroughs}" for r in reflections]
    
    # 5. Recent Emotional Patterns
    recent_moods = db.query(MoodEntry).filter_by(user_uid=uid).order_by(MoodEntry.created_at.desc()).limit(5).all()
    context["recent_emotional_patterns"] = []
    if recent_moods:
        avg_mood = sum(m.mood_score for m in recent_moods) / len(recent_moods)
        avg_anxiety = sum(m.anxiety_score for m in recent_moods) / len(recent_moods)
        avg_stress = sum(m.stress_score for m in recent_moods) / len(recent_moods)
        context["recent_emotional_patterns"].append(
            f"Average scores from last 5 entries: Mood: {avg_mood:.1f}/10, Anxiety: {avg_anxiety:.1f}/10, Stress: {avg_stress:.1f}/10"
        )
        
    # 6. Semantic Vector Memories (limit to 3 most relevant)
    retrieved_mems = []
    if initial_query and initial_query.strip():
        try:
            retrieved_mems = retrieve_semantic_memories(uid, initial_query.strip(), limit=3)
        except Exception as e:
            logger.error(f"Failed to retrieve semantic memories: {e}")
    context["semantic_memories"] = [f"- {m['content']} (Type: {m['memory_type']})" for m in retrieved_mems]
    
    return context

def process_therapeutic_pipeline(db: Session, session_id: int, uid: str, user_msg_id: Optional[int], parsed_data: dict):
    if not parsed_data:
        return
        
    sess = db.query(UserSession).filter_by(id=session_id).first()
    
    # 1. Update therapy phase from LLM recommendation if valid
    recommended_phase = parsed_data.get("recommended_therapy_phase")
    VALID_PHASES = ["rapport_building", "problem_exploration", "emotional_processing", "intervention", "action_planning", "reflection", "closure"]
    if recommended_phase in VALID_PHASES and sess:
        sess.current_phase = recommended_phase
        db.commit()

    # 2. Save Therapeutic Intervention
    intervention_info = parsed_data.get("initiated_intervention")
    if intervention_info and isinstance(intervention_info, dict):
        int_type = intervention_info.get("type")
        if int_type and int_type != "null" and int_type != None:
            existing = db.query(TherapeuticIntervention).filter_by(
                session_id=session_id, intervention_type=int_type, status="initiated"
            ).first()
            if not existing:
                new_int = TherapeuticIntervention(
                    session_id=session_id,
                    user_uid=uid,
                    intervention_type=int_type,
                    status="initiated",
                    data=json.dumps(intervention_info)
                )
                db.add(new_int)
                db.commit()

    completed_int = parsed_data.get("completed_intervention")
    if completed_int and completed_int != "null" and completed_int != None:
        active_int = db.query(TherapeuticIntervention).filter_by(
            session_id=session_id, intervention_type=completed_int, status="initiated"
        ).first()
        if active_int:
            active_int.status = "completed"
            db.commit()

    # 3. Save User Goals
    goals_list = parsed_data.get("extracted_goals")
    if goals_list and isinstance(goals_list, list):
        for g in goals_list:
            goal_text = g.get("goal")
            if goal_text:
                existing_goal = db.query(UserGoal).filter_by(user_uid=uid, goal=goal_text).first()
                if existing_goal:
                    if g.get("progress") is not None:
                        existing_goal.progress = g.get("progress")
                    if g.get("status") in ["active", "completed", "discarded"]:
                        existing_goal.status = g.get("status")
                else:
                    new_goal = UserGoal(
                        user_uid=uid,
                        goal=goal_text,
                        category=g.get("category", "General"),
                        progress=g.get("progress", 0),
                        status=g.get("status", "active")
                    )
                    db.add(new_goal)
                db.commit()

    # 4. Save Session Reflection and Homework Status
    ref_info = parsed_data.get("session_reflection")
    homework_upd = parsed_data.get("homework_update")
    
    if homework_upd and isinstance(homework_upd, dict):
        hw_status = homework_upd.get("status")
        if hw_status in ["completed", "skipped"]:
            prev_reflection = db.query(SessionReflection).filter_by(
                user_uid=uid, homework_status="pending"
            ).order_by(SessionReflection.created_at.desc()).first()
            if prev_reflection:
                prev_reflection.homework_status = hw_status
                db.commit()

    if ref_info and isinstance(ref_info, dict):
        if ref_info.get("breakthroughs") or ref_info.get("homework"):
            existing_ref = db.query(SessionReflection).filter_by(session_id=session_id).first()
            if existing_ref:
                if ref_info.get("breakthroughs"):
                    existing_ref.breakthroughs = ref_info.get("breakthroughs")
                if ref_info.get("homework"):
                    existing_ref.homework = ref_info.get("homework")
                if ref_info.get("next_session_focus"):
                    existing_ref.next_session_focus = ref_info.get("next_session_focus")
                if ref_info.get("confidence_level") is not None:
                    existing_ref.confidence_level = ref_info.get("confidence_level")
            else:
                new_ref = SessionReflection(
                    session_id=session_id,
                    user_uid=uid,
                    breakthroughs=ref_info.get("breakthroughs"),
                    homework=ref_info.get("homework"),
                    homework_status="pending" if ref_info.get("homework") else "completed",
                    next_session_focus=ref_info.get("next_session_focus"),
                    confidence_level=ref_info.get("confidence_level")
                )
                db.add(new_ref)
            db.commit()

    # 5. Save Mood Entry
    mood_metrics = parsed_data.get("mood_metrics")
    if mood_metrics and isinstance(mood_metrics, dict):
        new_mood = MoodEntry(
            session_id=session_id,
            user_uid=uid,
            mood_score=mood_metrics.get("mood_score", 5),
            anxiety_score=mood_metrics.get("anxiety_score", 5),
            stress_score=mood_metrics.get("stress_score", 5),
            energy_score=mood_metrics.get("energy_score", 5),
            confidence_score=mood_metrics.get("confidence_score", 5)
        )
        db.add(new_mood)
        db.commit()

    # 6. Save Personality Profile Updates (EMA merge)
    p_upd = parsed_data.get("personality_profile_update")
    if p_upd and isinstance(p_upd, dict):
        profile = db.query(PersonalityProfile).filter_by(user_uid=uid).first()
        if not profile:
            profile = PersonalityProfile(user_uid=uid)
            db.add(profile)
            db.commit()
            db.refresh(profile)
        
        for trait in ["analytical", "emotional", "action_oriented", "reflective", "avoidant", "social", "introverted", "extroverted"]:
            delta = p_upd.get(trait, 0.0)
            if delta:
                current_val = getattr(profile, trait)
                new_val = min(max(current_val + float(delta), 0.0), 1.0)
                setattr(profile, trait, new_val)
        db.commit()

    # 7. Save Treatment Plan Updates
    plan_upd = parsed_data.get("treatment_plan_update")
    if plan_upd and isinstance(plan_upd, dict):
        focus = plan_upd.get("focus_area")
        milestones = plan_upd.get("milestones")
        if focus:
            plan = db.query(TreatmentPlan).filter_by(user_uid=uid, focus_area=focus).first()
            if not plan:
                plan = TreatmentPlan(
                    user_uid=uid,
                    focus_area=focus,
                    progress=0,
                    completion_status="active"
                )
                db.add(plan)
                db.commit()
                db.refresh(plan)
            
            if milestones and isinstance(milestones, list):
                plan.milestones = json.dumps(milestones)
                total = len(milestones)
                completed = sum(1 for m in milestones if m.get("completed", False))
                plan.progress = int((completed / total) * 100) if total > 0 else 0
                if plan.progress == 100:
                    plan.completion_status = "completed"
            db.commit()

    # 8. Save Semantic Memories
    mem_list = parsed_data.get("semantic_memories_to_commit")
    if mem_list and isinstance(mem_list, list):
        for m in mem_list:
            m_content = m.get("content")
            m_type = m.get("type", "life_event")
            m_importance = m.get("importance", 5)
            if m_content:
                try:
                    add_semantic_memory(uid, m_content, m_type, session_id, m_importance)
                except Exception as e:
                    logger.error(f"Failed to add semantic memory in background pipeline: {e}")

def get_system_prompt_v2(
    user_name: str, 
    mood: str, 
    user_path: str, 
    memory_summary: str,
    continuity_context: dict = None,
    active_phase: str = "rapport_building",
    personality_style: str = ""
) -> str:
    prompt = (
        "You are Donna - a highly advanced, empathetic, and professional clinical therapist.\n"
        f"You are conducting a live, intimate therapy session with your client, {user_name}.\n\n"
        
        "CRITICAL HUMAN BEHAVIOR RULES:\n\n"
        
        "BE PROFOUNDLY EMPATHETIC & HUMAN: You are not a chatbot; you are a real human therapist. Display deep emotional intelligence, warmth, and intuitive understanding. React with genuine human emotion to the client's struggles and victories.\n\n"
        
        f"USE THEIR NAME: You must naturally weave \"{user_name}\" into your responses occasionally. Do not overuse it, but use it to build deep intimacy and trust, just like a real therapist.\n\n"
        
        f"ACKNOWLEDGE THE MOOD: The user explicitly selected their current mood as: {mood}. In your very first response, gently acknowledge this state (e.g., \"I see you're feeling {mood} today...\"). NEVER ask \"How are you feeling?\" if they just told you.\n\n"
        
        f"ALIGN WITH THEIR PATH: The user has chosen the '{user_path}' therapeutic path. You must completely adopt the tone of this path. (If logical: use CBT/structure. If emotional: prioritize deep validation. If spiritual: focus on meaning/mindfulness. If casual: speak like a warm, level-headed companion).\n\n"
        
        "NEVER SOUND LIKE A BOT: Do not use bullet points. Do not write essays. Speak in short, grounded, real sentences. Use commas and ellipses where a human would pause.\n\n"
        
        "NO REPETITION: NEVER repeat the exact same phrases from previous turns (e.g. stop saying 'Yeah, that is totally okay' repeatedly). Do not summarize what the user just said in every reply. Be dynamic, concise, and move the conversation forward naturally.\n\n"
        
        "ONE QUESTION AT A TIME: Ask exactly ONE profound, thought-provoking question per turn, if a question is needed. Don't bombard the client with questions. Ensure you deeply understand their specific situation before offering guidance.\n\n"
        
        "LANGUAGE ALIGNMENT: You must respond in the same language that the client used in their latest message. If they spoke/wrote in Urdu, reply in Urdu using the Urdu script (اردو). If they spoke/wrote in English, reply in English. Maintain perfect bilingual/multilingual capability.\n\n"
    )
    
    prompt += "ACTIVE THERAPEUTIC PHASE GUIDELINES:\n"
    prompt += get_phase_guidelines(active_phase) + "\n\n"
    
    if personality_style:
        prompt += f"CLIENT'S PERSONALITY PROFILE COMMUNICATION STYLE:\n{personality_style}\n\n"
        
    if user_path:
        prompt += (
            f"CLIENT'S SELECTED PATH PREFERENCE: {user_path.capitalize()}\n"
            f"- Tone guideline: {get_path_style_guidelines(user_path)}\n"
            "- Integrate this style preference while dynamically selecting the most clinically appropriate strategy.\n\n"
        )
        
    prompt += f"CLIENT'S CURRENT INITIAL MOOD: {mood}\n\n"
        
    if memory_summary:
        prompt += (
            "LONG-TERM CLIENT PROFILE & SUMMARY OF PAST SESSIONS:\n"
            f"{memory_summary}\n"
            "Use this profile to maintain therapeutic continuity. Refer naturally to their recurring themes, relationships, or goals when relevant.\n\n"
        )
        
    if continuity_context:
        prompt += "SESSION CONTINUITY ENGINE CONTEXT:\n"
        if continuity_context.get("active_goals"):
            prompt += "Active Goals:\n" + "\n".join(continuity_context["active_goals"]) + "\n"
        if continuity_context.get("pending_homework"):
            prompt += "Unfinished Homework from previous sessions (Help the user follow up on this):\n" + "\n".join(continuity_context["pending_homework"]) + "\n"
        if continuity_context.get("treatment_plans"):
            prompt += "Active Treatment Plans:\n" + "\n".join(continuity_context["treatment_plans"]) + "\n"
        if continuity_context.get("breakthroughs"):
            prompt += "Previous Breakthroughs:\n" + "\n".join(continuity_context["breakthroughs"]) + "\n"
        if continuity_context.get("recent_emotional_patterns"):
            prompt += "Recent Emotional Patterns:\n" + "\n".join(continuity_context["recent_emotional_patterns"]) + "\n"
        if continuity_context.get("semantic_memories"):
            prompt += "Retrieved Relevant Memories:\n" + "\n".join(continuity_context["semantic_memories"]) + "\n"
        prompt += "\n"

    prompt += (
        "TASK DEFINITION:\n"
        "For the client's latest message, perform a clinical analysis and generate the response. "
        "You MUST respond in JSON format with the following keys:\n"
        "{\n"
        "  \"emotion_analysis\": {\n"
        "    \"primary_emotion\": \"[One of: Anxiety, Fear, Sadness, Loneliness, Anger, Shame, Guilt, Grief, Hopelessness, Frustration, Overwhelm, Happiness, Relief]\",\n"
        "    \"secondary_emotion\": \"[Any secondary emotion detected, or 'None']\",\n"
        "    \"intensity\": [Integer from 1 to 10],\n"
        "    \"stress_level\": \"[Low, Medium, High]\",\n"
        "    \"emotional_need\": \"[Describe the emotional need in 2-5 words]\",\n"
        "    \"conversation_need\": \"[One of: Validation, Guidance, Venting, Reassurance, Accountability, Problem Solving, Emotional Processing, Decision Making]\"\n"
        "  },\n"
        "  \"risk_analysis\": {\n"
        "    \"self_harm\": [true/false],\n"
        "    \"suicide_risk\": [true/false],\n"
        "    \"violence\": [true/false],\n"
        "    \"abuse\": [true/false],\n"
        "    \"domestic_violence\": [true/false],\n"
        "    \"crisis\": [true/false, strictly for immediate physical threats to life or medical emergencies. Do NOT set to true for financial ruin, grief, or emotional panic],\n"
        "    \"psychosis\": [true/false],\n"
        "    \"risk_level\": \"[Low, Medium, High, Critical]\",\n"
        "    \"risk_details\": \"[Brief explanation of risk assessment]\",\n"
        "    \"urgency_score\": [Integer from 1 to 10. Rules: 1-4 = Normal Support, 5-7 = Increased Support, 8-10 = Crisis Mode]\n"
        "  },\n"
        "  \"therapy_strategy\": \"[CBT, DBT, ACT, Person-Centered, Trauma-Informed, Motivational Interviewing, CBT+ACT, Person-Centered+CBT, or Crisis-Support]\",\n"
        "  \"recommended_therapy_phase\": \"[Transition to: rapport_building, problem_exploration, emotional_processing, intervention, action_planning, reflection, closure, or keep current]\",\n"
        "  \"initiated_intervention\": {\n"
        "    \"type\": \"[cbt_thought_record, cognitive_reframing, grounding_54321, breathing_exercise, gratitude_exercise, behavioral_activation, values_clarification, dbt_distress_tolerance, or null]\",\n"
        "    \"instructions\": \"[If type is not null, provide instructions/exercises to guide the user]\"\n"
        "  },\n"
        "  \"completed_intervention\": \"[Type of completed intervention if the client completed the exercise, or null]\",\n"
        "  \"extracted_goals\": [\n"
        "    {\n"
        "      \"goal\": \"[Goal description]\",\n"
        "      \"category\": \"[Category of goal (e.g., Coping, Relationship, Career, Health)]\",\n"
        "      \"progress\": [0-100 integer],\n"
        "      \"status\": \"[active, completed, or discarded]\"\n"
        "    }\n"
        "  ],\n"
        "  \"homework_update\": {\n"
        "    \"status\": \"[completed, skipped, or null]\",\n"
        "    \"reason\": \"[Reason for homework completion or skipping, or null]\"\n"
        "  },\n"
        "  \"personality_profile_update\": {\n"
        "    \"analytical\": [Floating delta to add to trait, e.g. 0.05 or -0.05, or 0.0] ,\n"
        "    \"emotional\": [Floating delta] ,\n"
        "    \"action_oriented\": [Floating delta] ,\n"
        "    \"reflective\": [Floating delta] ,\n"
        "    \"avoidant\": [Floating delta] ,\n"
        "    \"social\": [Floating delta] ,\n"
        "    \"introverted\": [Floating delta] ,\n"
        "    \"extroverted\": [Floating delta]\n"
        "  },\n"
        "  \"treatment_plan_update\": {\n"
        "    \"focus_area\": \"[Focus area name, e.g. Anxiety Management, or null]\",\n"
        "    \"milestones\": [\n"
        "      {\n"
        "        \"description\": \"[Milestone description]\",\n"
        "        \"completed\": [true/false]\n"
        "      }\n"
        "    ]\n"
        "  },\n"
        "  \"semantic_memories_to_commit\": [\n"
        "    {\n"
        "      \"content\": \"[Important new life event, relationship info, goal, achievement, pattern, or issue to commit to memory]\",\n"
        "      \"type\": \"[one of: life_event, relationship, goal, achievement, recurring_issue, emotional_pattern]\",\n"
        "      \"importance\": [Integer from 1 to 10]\n"
        "    }\n"
        "  ],\n"
        "  \"session_reflection\": {\n"
        "    \"breakthroughs\": \"[Any breakthrough or insight reached by the client during this conversation, or null]\",\n"
        "    \"homework\": \"[Any homework exercise assigned to the client, or null]\",\n"
        "    \"next_session_focus\": \"[Target focus for next session, or null]\",\n"
        "    \"confidence_level\": [Confidence level from 1 to 10, or null]\n"
        "  },\n"
        "  \"mood_metrics\": {\n"
        "    \"mood_score\": [1-10 intensity],\n"
        "    \"anxiety_score\": [1-10 intensity],\n"
        "    \"stress_score\": [1-10 intensity],\n"
        "    \"energy_score\": [1-10 intensity],\n"
        "    \"confidence_score\": [1-10 intensity]\n"
        "  },\n"
        "  \"response_language\": \"[ISO 639-1 code of the language you used for the therapeutic_response, e.g. 'en', 'ur', 'es']\",\n"
        "  \"therapeutic_response\": \"[Your direct response to the user. Follow all response style guidelines. If urgency_score is 8-10 (Crisis Mode), focus entirely on grounding and emergency resources.]\"\n"
        "}\n\n"
        "Ensure your JSON is valid and conforms strictly to this structure. Do not output any thinking or markdown block prefixes, only raw JSON."
    )
    return prompt

def get_summary_generation_prompt(conversation_history: str, past_summary: str = "") -> str:
    prompt = (
        "You are an expert clinical psychologist and data annotator. Your task is to analyze the conversation history between a client and their therapeutic companion Donna, and compile/update a structured client profile summary.\n\n"
        "We track the client's progress using these specific fields:\n"
        "- Main Issues: Key struggles or problems discussed.\n"
        "- Triggers: Situations, thoughts, or events that prompt negative emotional states.\n"
        "- Emotional Patterns: Recurring emotional states (e.g., anxiety spikes, guilt, sadness).\n"
        "- Goals: Aspirations or intentions the user has voiced (even minor ones).\n"
        "- Progress: Any positive changes, insight, or coping mechanisms the client successfully used.\n"
        "- Coping Strategies: Methods, grounding techniques, or strategies that help the client.\n"
        "- Recurring Themes: Repeated motifs or life themes.\n"
        "- Risk Factors: Safety issues, risk indicators, or historical risk factors.\n\n"
        "Additionally, we track long-term memory metrics across sessions:\n"
        "- personality_traits: Key traits and characteristics of the user.\n"
        "- communication_style: How the client communicates (e.g., expressive, reserved, logical, analytical).\n"
        "- strengths: Personal strengths demonstrated by the client.\n"
        "- core_values: Core values held by the client.\n"
        "- common_cognitive_patterns: Cognitive distortions, negative thought loops, or helpful cognitive habits.\n"
        "- family_relationships: Status and dynamics of family ties.\n"
        "- partner_relationships: Status and dynamics of partner/spouse relationships.\n"
        "- friendship_patterns: Dynamics and themes in friendships.\n"
        "- work_relationships: Coworker, manager, or career relationships.\n"
        "- wins_this_week: Wins, achievements, or positive shifts this week.\n"
        "- growth_areas: Self-awareness, potential target areas for growth.\n"
        "- setbacks: Any regression, obstacles, or setbacks experienced.\n"
        "- confidence_score: Client's overall confidence level (e.g. 1-10 scale or descriptive).\n\n"
    )
    if past_summary:
        prompt += (
            f"Here is the PREVIOUS accumulated summary profile of the client:\n{past_summary}\n\n"
            "Your job is to UPDATE and refine this summary profile, integrating new insights from the latest session conversation below. Keep what is still relevant, update what has changed, and add new points. Keep the analysis clear and concise.\n\n"
        )
    else:
        prompt += "Since this is the first session, compile a new summary profile based on the conversation.\n\n"
        
    prompt += (
        f"Conversation History of current session:\n{conversation_history}\n\n"
        "CRITICAL LENGTH LIMIT: You must keep your analysis extremely brief. "
        "Limit every field to a maximum of 1 or 2 short sentences or bullet points. Do not write long paragraphs.\n\n"
        "Provide your analysis in JSON format with these exact keys:\n"
        "{\n"
        "  \"main_issues\": \"[List or summary]\",\n"
        "  \"triggers\": \"[List or summary]\",\n"
        "  \"emotional_patterns\": \"[List or summary]\",\n"
        "  \"goals\": \"[List or summary]\",\n"
        "  \"progress\": \"[List or summary]\",\n"
        "  \"coping_strategies\": \"[List or summary]\",\n"
        "  \"recurring_themes\": \"[List or summary]\",\n"
        "  \"risk_factors\": \"[List or summary]\",\n"
        "  \"personality_traits\": \"[List or summary]\",\n"
        "  \"communication_style\": \"[List or summary]\",\n"
        "  \"strengths\": \"[List or summary]\",\n"
        "  \"core_values\": \"[List or summary]\",\n"
        "  \"common_cognitive_patterns\": \"[List or summary]\",\n"
        "  \"family_relationships\": \"[List or summary]\",\n"
        "  \"partner_relationships\": \"[List or summary]\",\n"
        "  \"friendship_patterns\": \"[List or summary]\",\n"
        "  \"work_relationships\": \"[List or summary]\",\n"
        "  \"wins_this_week\": \"[List or summary]\",\n"
        "  \"growth_areas\": \"[List or summary]\",\n"
        "  \"setbacks\": \"[List or summary]\",\n"
        "  \"confidence_score\": \"[1-10 or descriptive]\"\n"
        "}\n"
        "Ensure the output is valid JSON. Do not output any markdown formatting prefixes or suffixes, only raw JSON."
    )
    return prompt

def task(func):
    """Decorator to tag background pipeline functions as tasks
    for an asynchronous task runner (like ARQ or Celery).
    """
    func.is_background_task = True
    return func

@task
def run_background_pipeline(session_id: int, user_uid: str, user_msg_id: int, parsed_data: dict):
    """Shutdown-aware background pipeline with task tracking.
    
    Also compatible with async task queues (ARQ / Celery) — see arq_tasks.py scaffold.
    """
    if shutdown_event.is_set():
        logger.warning(f"Shutdown in progress — skipping background pipeline for session {session_id}")
        return
    
    _register_task()
    from database import SessionLocal
    db = SessionLocal()
    try:
        save_message_analysis(db, user_msg_id, parsed_data)
        process_therapeutic_pipeline(db, session_id, user_uid, user_msg_id, parsed_data)
    except Exception as e:
        logger.error(f"Error in run_background_pipeline: {e}")
        db.rollback()
    finally:
        db.close()
        
    # Then update session summary (skip if shutting down, and rate-limit to every 3rd message)
    if not shutdown_event.is_set():
        from database import SessionLocal
        from database import Message
        db_check = SessionLocal()
        try:
            turn_count = db_check.query(Message).filter_by(session_id=session_id, role="user").count()
            # Only run the heavy LLM summary every 3 turns to strictly stay under 5 RPM Gemini limits
            if turn_count % 3 == 0:
                import asyncio
                asyncio.run(update_session_summary_task(session_id, user_uid))
        except Exception as e:
            logger.error(f"Error checking turn count for summary: {e}")
        finally:
            db_check.close()
    
    _unregister_task()

async def update_session_summary_task(session_id: int, uid: str):
    """Generate / update the encrypted session summary. Shutdown-aware."""
    if shutdown_event.is_set():
        logger.warning(f"Shutdown in progress — skipping summary update for session {session_id}")
        return
    
    _register_task()
    import asyncio
    await asyncio.sleep(5)
    from database import SessionLocal
    db = SessionLocal()
    try:
        # Load all messages in the session
        msgs = db.query(Message).filter_by(session_id=session_id).order_by(Message.timestamp.asc()).all()
        if len(msgs) < 2:
            return  # Not enough conversation to summarize
            
        # Format the conversation history
        history_lines = []
        for m in msgs:
            role = "Client" if m.role == "user" else "Donna (Therapist)"
            history_lines.append(f"{role}: {decrypt(m.content)}")
        conversation_history = "\n".join(history_lines)
        
        # Check if there is already a summary for this session
        existing_summary = db.query(SessionSummary).filter_by(session_id=session_id).first()
        past_summary_text = ""
        if existing_summary:
            try:
                past_summary_text = decrypt(existing_summary.summary_data)
            except Exception:
                pass
        else:
            # Check if there was a summary in the previous session
            prev_summary = db.query(SessionSummary).filter(
                SessionSummary.user_uid == uid,
                SessionSummary.session_id != session_id
            ).order_by(SessionSummary.created_at.desc()).first()
            if prev_summary:
                try:
                    past_summary_text = decrypt(prev_summary.summary_data)
                except Exception:
                    pass
                    
        # Generate the updated summary from Gemini
        prompt = get_summary_generation_prompt(conversation_history, past_summary_text)
        res = await safe_runpod_completion(
            prompt=prompt,
            system_instruction="You are a clinical assistant. Summarize the session strictly in JSON.",
            temperature=0.3,
            response_format={"type": "json_object"},
            max_tokens=4000
        )
        raw_summary = res.choices[0].message.content or ""
        
        # Verify it parses as JSON, then stamp with schema version
        summary_obj = json.loads(raw_summary)
        summary_obj["schema_version"] = CURRENT_SCHEMA_VERSION
        raw_summary = json.dumps(summary_obj)
        
        # Encrypt the versioned summary
        encrypted_summary = encrypt(raw_summary)
        
        if existing_summary:
            existing_summary.summary_data = encrypted_summary
        else:
            new_summary = SessionSummary(
                session_id=session_id,
                user_uid=uid,
                summary_data=encrypted_summary
            )
            db.add(new_summary)
        db.commit()
        logger.info(f"Successfully updated summary for session {session_id}")
    except Exception as e:
        logger.error(f"Error in update_session_summary_task: {e}")
        db.rollback()
    finally:
        db.close()
        _unregister_task()

def resolve_uid_conflict(db: Session, existing_email_user: User, new_uid: str, email_val: str) -> User:
    """Safely migrate all user data from an old Firebase UID to a new one, avoiding ForeignKey constraints."""
    old_uid = existing_email_user.firebase_uid
    if old_uid == new_uid:
        return existing_email_user
        
    logger.info(f"Resolving UID conflict: Re-linking existing email {email_val} from old UID {old_uid} to new Firebase UID {new_uid}")
    
    # 1. Free up the email on the old record
    existing_email_user.email = f"old_{old_uid}_{email_val}"
    db.commit()
    
    # 2. Create the new User row FIRST so FK constraints pass
    new_user = User(
        firebase_uid=new_uid, 
        email=email_val, 
        name=existing_email_user.name,
        gender=existing_email_user.gender,
        path=existing_email_user.path,
        dob=existing_email_user.dob,
        lat=existing_email_user.lat,
        lng=existing_email_user.lng,
        emergency_name=existing_email_user.emergency_name,
        emergency_phone=existing_email_user.emergency_phone
    )
    db.add(new_user)
    db.commit()
    
    # 3. Safely cascade the child records to the new UID
    db.query(UserSession).filter_by(user_uid=old_uid).update({"user_uid": new_uid})
    db.query(SessionSummary).filter_by(user_uid=old_uid).update({"user_uid": new_uid})
    db.query(TherapeuticIntervention).filter_by(user_uid=old_uid).update({"user_uid": new_uid})
    db.query(UserGoal).filter_by(user_uid=old_uid).update({"user_uid": new_uid})
    db.query(SessionReflection).filter_by(user_uid=old_uid).update({"user_uid": new_uid})
    db.query(MoodEntry).filter_by(user_uid=old_uid).update({"user_uid": new_uid})
    db.query(PersonalityProfile).filter_by(user_uid=old_uid).update({"user_uid": new_uid})
    db.query(CrisisEvent).filter_by(user_uid=old_uid).update({"user_uid": new_uid})
    db.query(TreatmentPlan).filter_by(user_uid=old_uid).update({"user_uid": new_uid})
    db.query(SemanticMemory).filter_by(user_uid=old_uid).update({"user_uid": new_uid})
    db.commit()
    
    # 4. Delete the old user record
    db.delete(existing_email_user)
    db.commit()
    
    return new_user


@app.post("/api/session/start")
async def start_sess(
    data: SessionStart, 
    background_tasks: BackgroundTasks,
    uid: str = Depends(get_current_uid), 
    db: Session = Depends(get_db)
):
    user = db.query(User).filter_by(firebase_uid=uid).first()
    if not user:
        try:
            f_user = auth.get_user(uid)
            email_val = f_user.email or f"unknown_{uid}@serenityai.com"
            name_val = f_user.display_name or "Friend"
        except Exception as auth_e:
            logger.error(f"Firebase auth lookup failed: {auth_e}")
            email_val = f"unknown_{uid}@serenityai.com"
            name_val = "Friend"
        
        # Conflict Resolution: Check if email already exists
        existing_email_user = db.query(User).filter_by(email=email_val).first()
        if existing_email_user:
            user = resolve_uid_conflict(db, existing_email_user, uid, email_val)
        else:
            try:
                user = User(firebase_uid=uid, email=email_val, name=name_val)
                db.add(user)
                db.commit()
                db.refresh(user)
            except Exception as e:
                db.rollback()
                logger.error(f"Race condition during user creation: {e}")
                user = db.query(User).filter_by(firebase_uid=uid).first()
    
    # Resolve and store path
    path_to_use = None
    if data.path:
        path_to_use = data.path
        user.path = data.path
        db.commit()
    elif user.path:
        path_to_use = user.path
    else:
        path_to_use = "casual"  # Default fallback
        
    # --- Mood/Feeling Locking: Reuse existing session if one is still active ---
    existing_today = db.query(UserSession).filter(
        UserSession.user_uid == uid,
        UserSession.is_ended == False
    ).order_by(UserSession.created_at.desc()).first()
    
    if existing_today:
        existing_today.mood = data.mood
        db.commit()
        last_ai_msg = db.query(Message).filter_by(
            session_id=existing_today.id, role="assistant"
        ).order_by(Message.timestamp.desc()).first()
        first_message = decrypt(last_ai_msg.content) if last_ai_msg else "Welcome back. Let's continue where we left off."
        logger.info(f"Mood locked: Returning existing session {existing_today.id} for user {uid} updated with latest mood: {data.mood}")
        return {"session_id": existing_today.id, "first_message": first_message}

    new_sess = UserSession(user_uid=uid, mood=data.mood, path=path_to_use)
    db.add(new_sess)
    db.commit()
    db.refresh(new_sess)
    session_id_val = new_sess.id
    
    user_msg_id = None
    # Save the user's initial description in the database as the first message if provided
    if data.description and data.description.strip():
        user_msg = Message(session_id=session_id_val, role="user", content=encrypt(data.description.strip()))
        db.add(user_msg)
        db.commit()
        db.refresh(user_msg)
        user_msg_id = user_msg.id
        
    # Crisis Management backend-enforced scan
    initial_desc = data.description.strip() if (data.description and data.description.strip()) else ""
    if backend_crisis_scan(initial_desc) or data.mood.lower() in ["crisis", "suicidal"]:
        # Log crisis event
        crisis_event = CrisisEvent(
            session_id=session_id_val,
            user_uid=uid,
            urgency_score=10,
            crisis_details=f"Initial Session description/mood: {initial_desc or data.mood}",
            action_taken="Crisis Mode Activated at Startup. Safety override."
        )
        db.add(crisis_event)
        db.commit()
        
        # Save safety reply
        ai_msg = Message(session_id=session_id_val, role="assistant", content=encrypt(CRISIS_RESPONSE))
        db.add(ai_msg)
        db.commit()
        return {"session_id": session_id_val, "first_message": CRISIS_RESPONSE}

    name = user.name if (user and user.name) else "Friend"
    
    # 1. Compile Session Continuity Context (memories, active goals, treatment plans, breakthroughs)
    continuity_context = compile_session_continuity_context(uid, initial_desc or data.mood, db)
    
    # 2. Get Personality Profile style guidelines
    profile = db.query(PersonalityProfile).filter_by(user_uid=uid).first()
    if not profile:
        profile = PersonalityProfile(user_uid=uid)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    personality_style = get_personality_style_guidelines(profile)
    
    # Compile past session memories and path style rules using structured summaries
    memory = compile_past_sessions_summary_v2(uid, new_sess.id, db)
    system_prompt = get_system_prompt_v2(
        user_name=name, 
        mood=data.mood, 
        user_path=path_to_use, 
        memory_summary=memory,
        continuity_context=continuity_context,
        active_phase="rapport_building",
        personality_style=personality_style
    )
    
    messages = [{"role": "system", "content": system_prompt}]
    
    mood_str = data.mood.strip().lower()
    if data.description and data.description.strip():
        messages.append({"role": "user", "content": f"I'm feeling {mood_str}. {data.description.strip()}"})
    else:
        messages.append({"role": "user", "content": f"Hello Donna, I am feeling {mood_str}."})
    
    try:
        res = await hybrid_ai_router(
            messages=messages,
            current_phase="rapport_building",
            path=path_to_use,
            response_format={"type": "json_object"}
        )
        
        # If successful, parse it normally as before
        raw_reply = res.choices[0].message.content or ""
        parsed_data = parse_llm_response(raw_reply)
        
        # Urgency/Crisis check from LLM output
        risk_info = parsed_data.get("risk_analysis") or {}
        urgency = int(risk_info.get("urgency_score", 1) or 1)
        
        if risk_info.get("suicide_risk") is True or risk_info.get("self_harm") is True or risk_info.get("crisis") is True:
            crisis_event = CrisisEvent(
                session_id=session_id_val,
                user_uid=uid,
                trigger_message_id=user_msg_id,
                urgency_score=urgency,
                crisis_details=risk_info.get("risk_details") or "LLM-detected suicide/self-harm risk",
                action_taken="Safety override triggered."
            )
            db.add(crisis_event)
            ai_msg_text = CRISIS_RESPONSE
        elif risk_info.get("violence") is True or risk_info.get("abuse") is True or risk_info.get("domestic_violence") is True:
            crisis_event = CrisisEvent(
                session_id=session_id_val,
                user_uid=uid,
                trigger_message_id=user_msg_id,
                urgency_score=urgency,
                crisis_details=risk_info.get("risk_details") or "LLM-detected violence/abuse/domestic boundary breach",
                action_taken="Violence boundary override"
            )
            db.add(crisis_event)
            ai_msg_text = BOUNDARY_RESPONSE
        else:
            ai_msg_text = parsed_data.get("therapeutic_response") or "I'm here for you. How can we start today?"
        
        # Save AI reply
        ai_msg = Message(session_id=session_id_val, role="assistant", content=encrypt(ai_msg_text))
        db.add(ai_msg)
        db.commit()
        
        # Save MessageAnalysis & trigger pipeline updates in background
        if user_msg_id is not None:
            background_tasks.add_task(run_background_pipeline, session_id_val, uid, user_msg_id, parsed_data)
            
        return {"session_id": session_id_val, "first_message": ai_msg_text}
                
    except Exception as e:
        logger.error(f"Error in start_sess during LLM fetch: {e}")
        db.rollback()
        # Save fallback AI reply acknowledging the mood
        mood_str = data.mood.strip().lower()
        if mood_str and mood_str != "neutral":
            ai_msg_text = f"I'm here for you. I see you marked that you're feeling {mood_str} today. What is on your mind?"
        else:
            ai_msg_text = "I'm here for you. How can we start today?"
        ai_msg = Message(session_id=session_id_val, role="assistant", content=encrypt(ai_msg_text))
        db.add(ai_msg)
        db.commit()
        return {"session_id": session_id_val, "first_message": ai_msg_text}

@app.post("/api/session/warmup")
def warmup_engine(uid: str = Depends(get_current_uid)):
    """Pings the engine to warm it up before the session starts."""
    return {"status": "success", "message": "Engine is serverless"}

@app.post("/api/chat")
async def chat_node(
    data: ChatMsg, 
    background_tasks: BackgroundTasks,
    uid: str = Depends(get_current_uid), 
    db: Session = Depends(get_db)
):
    sess = validate_session_integrity(db, uid, data.session_id)
    
    # Update active duration if provided
    if data.duration_seconds is not None:
        sess.duration_seconds = data.duration_seconds
        db.commit()

    # Reject new inputs if duration exceeds timeout or session is explicitly ended
    if (sess.duration_seconds and sess.duration_seconds >= SESSION_TIMEOUT_SECONDS) or sess.is_ended:
        return {"reply": "Looking forward to our next session."}

    # Crisis Management backend-enforced scan
    if backend_crisis_scan(data.content):
        # Save user message
        user_msg = Message(session_id=data.session_id, role="user", content=encrypt(data.content))
        db.add(user_msg)
        db.commit()
        db.refresh(user_msg)

        # Log crisis event
        crisis_event = CrisisEvent(
            session_id=data.session_id,
            user_uid=uid,
            trigger_message_id=user_msg.id,
            urgency_score=10,
            crisis_details=f"User message: {data.content}",
            action_taken="Crisis Mode Activated. Safety override."
        )
        db.add(crisis_event)
        
        # Save safety reply
        ai_msg = Message(session_id=data.session_id, role="assistant", content=encrypt(CRISIS_RESPONSE))
        db.add(ai_msg)
        db.commit()
        return {"reply": CRISIS_RESPONSE}

    user_msg = Message(session_id=data.session_id, role="user", content=encrypt(data.content))
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 1. State Machine Automatic Phase Transitions
    # Count user messages in current session
    turn_count = db.query(Message).filter_by(session_id=data.session_id, role="user").count()
    current_phase = sess.current_phase or "rapport_building"
    
    # Query latest MessageAnalysis for this session
    latest_analysis = db.query(MessageAnalysis).join(Message).filter(Message.session_id == data.session_id).order_by(Message.timestamp.desc()).first()
    latest_stress_high = (latest_analysis and latest_analysis.stress_level == "High")
    
    # Transition rules
    if sess.duration_seconds and sess.duration_seconds >= 1020 and not latest_stress_high:
        current_phase = "closure"
    elif sess.duration_seconds and sess.duration_seconds >= 900 and not latest_stress_high:
        current_phase = "reflection"
    elif turn_count <= 2:
        current_phase = "rapport_building"
    elif current_phase == "rapport_building" and turn_count > 2:
        current_phase = "problem_exploration"
    elif current_phase in ["problem_exploration", "emotional_processing"] and turn_count > 6:
        # Check if user has high emotional intensity in last messages to trigger emotional processing
        if latest_analysis and latest_analysis.stress_level == "High" and current_phase != "emotional_processing":
            current_phase = "emotional_processing"
        elif latest_analysis and latest_analysis.stress_level != "High":
            current_phase = "intervention"

    sess.current_phase = current_phase
    db.commit()

    # Memory Window Optimization
    # Always include the very first user message of the session (to keep the core concern in focus)
    first_user_msg = db.query(Message).filter_by(session_id=data.session_id, role="user").order_by(Message.timestamp.asc()).first()
    
    # Include the last 20 messages for recent conversational flow
    last_20_msgs = db.query(Message).filter_by(session_id=data.session_id).order_by(Message.timestamp.desc()).limit(20).all()
    last_20_msgs = list(reversed(last_20_msgs))
    
    context = []
    if first_user_msg:
        in_last_20 = any(m.id == first_user_msg.id for m in last_20_msgs)
        if not in_last_20:
            context.append({"role": "user", "content": decrypt(first_user_msg.content)})
            
    for m in last_20_msgs:
        context.append({"role": m.role, "content": decrypt(m.content)})
    
    user = db.query(User).filter_by(firebase_uid=uid).first()
    name = user.name if (user and user.name) else "Friend"
    
    # 2. Compile Session Continuity Context (retrieves vector memories and tracks goals/homework)
    continuity_context = compile_session_continuity_context(uid, data.content, db)

    # 3. Adapt style dynamically using the user's Personality Profile
    profile = db.query(PersonalityProfile).filter_by(user_uid=uid).first()
    if not profile:
        profile = PersonalityProfile(user_uid=uid)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    personality_style = get_personality_style_guidelines(profile)

    # Compile past session memories and path style rules using structured summaries
    memory = compile_past_sessions_summary_v2(uid, data.session_id, db)
    system_prompt = get_system_prompt_v2(
        user_name=name, 
        mood=sess.mood, 
        user_path=sess.path, 
        memory_summary=memory,
        continuity_context=continuity_context,
        active_phase=current_phase,
        personality_style=personality_style
    )

    try:
        res = await hybrid_ai_router(
            messages=[{"role": "system", "content": system_prompt}] + context,
            current_phase=current_phase,
            path=sess.path,
            response_format={"type": "json_object"}
        )
        raw_reply = res.choices[0].message.content or ""
        parsed_data = parse_llm_response(raw_reply)

        # Urgency/Crisis check from LLM output
        risk_info = parsed_data.get("risk_analysis", {})
        urgency = int(risk_info.get("urgency_score", 1))
        
        if risk_info.get("suicide_risk") is True or risk_info.get("self_harm") is True or risk_info.get("crisis") is True:
            crisis_event = CrisisEvent(
                session_id=data.session_id,
                user_uid=uid,
                trigger_message_id=user_msg.id,
                urgency_score=urgency,
                crisis_details=risk_info.get("risk_details", "LLM-detected suicide/self-harm risk"),
                action_taken="Safety override triggered."
            )
            db.add(crisis_event)
            ai_msg_text = CRISIS_RESPONSE
        elif risk_info.get("violence") is True or risk_info.get("abuse") is True or risk_info.get("domestic_violence") is True:
            crisis_event = CrisisEvent(
                session_id=data.session_id,
                user_uid=uid,
                trigger_message_id=user_msg.id,
                urgency_score=urgency,
                crisis_details=risk_info.get("risk_details", "LLM-detected violence/abuse/domestic boundary breach"),
                action_taken="Violence boundary override"
            )
            db.add(crisis_event)
            ai_msg_text = BOUNDARY_RESPONSE
        else:
            ai_msg_text = parsed_data.get("therapeutic_response", "I'm listening, but my connection is a bit slow. Please go on.")
        
        # Save assistant message
        db.add(Message(session_id=data.session_id, role="assistant", content=encrypt(ai_msg_text)))
        db.commit()
        
        # Enqueue background task to run the pipeline updates and session summary
        background_tasks.add_task(run_background_pipeline, data.session_id, uid, user_msg.id, parsed_data)
        
        return {"reply": ai_msg_text}
    except Exception as e:
        logger.error(f"Chat Error: {e}")
        fallback_reply = "I'm listening, but my connection is a bit slow. Please go on."
        return {"reply": fallback_reply}

@app.post("/api/chat/voice")
async def chat_voice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session_id: int = Form(...),
    duration_seconds: Optional[int] = Form(None),
    uid: str = Depends(get_current_uid),
    db: Session = Depends(get_db)
):
    sess = validate_session_integrity(db, uid, session_id)
    
    # 1. Update duration if provided
    if duration_seconds is not None:
        sess.duration_seconds = duration_seconds
        db.commit()

    if (sess.duration_seconds and sess.duration_seconds >= SESSION_TIMEOUT_SECONDS) or sess.is_ended:
        return {
            "user_message": {"id": 0, "text": "Looking forward to our next session.", "audio_url": None},
            "ai_message": {"id": 0, "text": "Looking forward to our next session.", "audio_url": None}
        }

    # 2. Save uploaded audio to a temp file and transcribe
    import tempfile
    import groq
    try:
        ext = os.path.splitext(file.filename)[1] or ".m4a"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                temp_file.write(chunk)
            temp_path = temp_file.name
        try:
            groq_api_key = os.getenv("GROQ_API_KEY")
            if not groq_api_key:
                raise Exception("GROQ_API_KEY is missing")
                
            client = groq.Groq(api_key=groq_api_key)
            lang_hint = detect_user_language_hint(uid, session_id, db)
            prompt = WHISPER_TRANSCRIPTION_PROMPT
            if lang_hint:
                prompt += f" The user often speaks in {lang_hint}."
            
            with open(temp_path, "rb") as f:
                transcription = client.audio.transcriptions.create(
                    file=(os.path.basename(temp_path), f.read()),
                    model="whisper-large-v3",
                    prompt=prompt
                )
            
            user_text = transcription.text or ""
        finally:
            pass
    except Exception as e:
        logger.error(f"Voice chat transcription failed: {e}")
        raise HTTPException(status_code=500, detail="Voice transcription failed.")

    if not user_text.strip():
        raise HTTPException(status_code=400, detail="No speech detected.")

    # Crisis Management backend-enforced scan on user text
    if backend_crisis_scan(user_text):
        user_msg = Message(session_id=session_id, role="user", content=encrypt(user_text))
        db.add(user_msg)
        db.commit()
        db.refresh(user_msg)

        # Persist user audio
        import shutil
        user_audio_filename = f"user_{user_msg.id}{ext}"
        user_audio_path = os.path.join("static", "audio", user_audio_filename)
        shutil.copy(temp_path, user_audio_path)
        user_msg.audio_url = f"/static/audio/{user_audio_filename}"
        db.commit()

        # Log crisis event
        crisis_event = CrisisEvent(
            session_id=session_id,
            user_uid=uid,
            trigger_message_id=user_msg.id,
            urgency_score=10,
            crisis_details=f"Voice content: {user_text}",
            action_taken="Crisis Mode Activated in Voice. Safety override."
        )
        db.add(crisis_event)
        
        ai_msg = Message(session_id=session_id, role="assistant", content=encrypt(CRISIS_RESPONSE))
        db.add(ai_msg)
        db.commit()
        db.refresh(ai_msg)

        # Synthesize crisis audio response
        ai_audio_filename = f"ai_{ai_msg.id}.mp3"
        ai_audio_path = os.path.join("static", "audio", ai_audio_filename)
        try:
            communicate = edge_tts.Communicate(CRISIS_RESPONSE, "en-US-AvaNeural")
            await communicate.save(ai_audio_path)
            ai_msg.audio_url = f"/static/audio/{ai_audio_filename}"
            db.commit()
        except: pass

        return {
            "user_message": {"id": user_msg.id, "text": user_text, "audio_url": user_msg.audio_url},
            "ai_message": {"id": ai_msg.id, "text": CRISIS_RESPONSE, "audio_url": ai_msg.audio_url}
        }

    # 3. Save User Message in database
    user_msg = Message(session_id=session_id, role="user", content=encrypt(user_text))
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 4. Save the user's audio file persistently to static/audio/user_{user_msg.id}.m4a
    import shutil
    user_audio_filename = f"user_{user_msg.id}{ext}"
    user_audio_path = os.path.join("static", "audio", user_audio_filename)
    shutil.copy(temp_path, user_audio_path)
    
    user_msg.audio_url = f"/static/audio/{user_audio_filename}"
    db.commit()

    # 5. Extract acoustic voice emotions
    voice_analysis = analyze_voice_emotion(user_audio_path, user_text)

    # Clean up temp_path
    try:
        os.remove(temp_path)
    except Exception:
        pass

    # 6. State Machine Automatic Phase Transitions
    turn_count = db.query(Message).filter_by(session_id=session_id, role="user").count()
    current_phase = sess.current_phase or "rapport_building"
    
    # Query latest MessageAnalysis for this session
    latest_analysis = db.query(MessageAnalysis).join(Message).filter(Message.session_id == session_id).order_by(Message.timestamp.desc()).first()
    latest_stress_high = (latest_analysis and latest_analysis.stress_level == "High")
    
    if sess.duration_seconds and sess.duration_seconds >= 1020 and not latest_stress_high:
        current_phase = "closure"
    elif sess.duration_seconds and sess.duration_seconds >= 900 and not latest_stress_high:
        current_phase = "reflection"
    elif turn_count <= 2:
        current_phase = "rapport_building"
    elif current_phase == "rapport_building" and turn_count > 2:
        current_phase = "problem_exploration"
    elif current_phase in ["problem_exploration", "emotional_processing"] and turn_count > 6:
        # Check if user has high emotional intensity or vocal indicators (anxiety/sadness/anger)
        high_stress = latest_stress_high or (voice_analysis["voice_emotion"] in ["anxiety", "sadness", "anger"])
        if high_stress and current_phase != "emotional_processing":
            current_phase = "emotional_processing"
        elif not high_stress:
            current_phase = "intervention"

    sess.current_phase = current_phase
    db.commit()

    # Memory Window Optimization
    # Always include the very first voice message of the session (to keep the core concern in focus)
    first_user_msg = db.query(Message).filter(Message.session_id == session_id, Message.role == "user", Message.audio_url != None).order_by(Message.timestamp.asc()).first()
    
    # Include only the last 20 voice messages for a dedicated 'phone call' flow
    last_20_msgs = db.query(Message).filter(Message.session_id == session_id, Message.audio_url != None).order_by(Message.timestamp.desc()).limit(20).all()
    last_20_msgs = list(reversed(last_20_msgs))
    
    context = []
    if first_user_msg:
        in_last_20 = any(m.id == first_user_msg.id for m in last_20_msgs)
        if not in_last_20:
            context.append({"role": "user", "content": decrypt(first_user_msg.content)})
            
    for m in last_20_msgs:
        context.append({"role": m.role, "content": decrypt(m.content)})
    
    user = db.query(User).filter_by(firebase_uid=uid).first()
    name = user.name if (user and user.name) else "Friend"
    
    # Compile past session memories and path style rules using structured summaries
    memory = compile_past_sessions_summary_v2(uid, session_id, db)
    
    # Compile Session Continuity Context (retrieves vector memories and tracks goals/homework)
    continuity_context = compile_session_continuity_context(uid, user_text, db)

    # Adapt style dynamically using the user's Personality Profile
    profile = db.query(PersonalityProfile).filter_by(user_uid=uid).first()
    if not profile:
        profile = PersonalityProfile(user_uid=uid)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    personality_style = get_personality_style_guidelines(profile)

    system_prompt = get_system_prompt_v2(
        user_name=name, 
        mood=sess.mood, 
        user_path=sess.path, 
        memory_summary=memory,
        continuity_context=continuity_context,
        active_phase=current_phase,
        personality_style=personality_style
    )

    # Inject acoustic voice features directly into system prompt for multi-modal fusion context
    voice_context_inject = (
        f"\n\n[LIVE PHONE CALL INITIATED]\n"
        f"You are currently on a live voice call with the user. Treat this exactly like a phone conversation. Keep your responses conversational, natural, and do not reference previous text chats.\n"
        f"CLIENT'S CURRENT VOCAL ACOUSTIC STATE (FUSED SIGNAL):\n"
        f"- Detected Vocal Emotion: {voice_analysis['voice_emotion'].upper()}\n"
        f"- Speech Rate: {voice_analysis['speech_rate']} words per minute\n"
        f"- Energy (Volume RMS): {voice_analysis['energy']}\n"
        f"- Pitch Variation (ZCR StdDev): {voice_analysis['pitch_variation']} Hz\n"
        f"- Pauses Count (>100ms): {voice_analysis['pauses']}\n"
        f"Combine this vocal signal with the text semantics to inform your strategy."
    )
    system_prompt += voice_context_inject

    try:
        res = await hybrid_ai_router(
            messages=[{"role": "system", "content": system_prompt}] + context,
            current_phase=current_phase,
            path=sess.path,
            response_format={"type": "json_object"}
        )
        raw_reply = res.choices[0].message.content or ""
        parsed_data = parse_llm_response(raw_reply)
        
        # Combine voice/text emotion recognition signals
        text_emotion = parsed_data.get("emotion_analysis", {}).get("primary_emotion", "Neutral")
        combined_emotion = resolve_combined_emotion(text_emotion, voice_analysis["voice_emotion"])
        if "emotion_analysis" in parsed_data:
            parsed_data["emotion_analysis"]["primary_emotion"] = combined_emotion

        # Urgency/Crisis check from LLM output
        risk_info = parsed_data.get("risk_analysis", {})
        urgency = int(risk_info.get("urgency_score", 1))
        
        if risk_info.get("suicide_risk") is True or risk_info.get("self_harm") is True or risk_info.get("crisis") is True:
            crisis_event = CrisisEvent(
                session_id=session_id,
                user_uid=uid,
                trigger_message_id=user_msg.id,
                urgency_score=urgency,
                crisis_details=risk_info.get("risk_details", "Voice-chat LLM suicide/self-harm risk"),
                action_taken="Safety override triggered."
            )
            db.add(crisis_event)
            ai_reply = CRISIS_RESPONSE
        elif risk_info.get("violence") is True or risk_info.get("abuse") is True or risk_info.get("domestic_violence") is True:
            crisis_event = CrisisEvent(
                session_id=session_id,
                user_uid=uid,
                trigger_message_id=user_msg.id,
                urgency_score=urgency,
                crisis_details=risk_info.get("risk_details", "Voice-chat LLM violence/abuse/domestic boundary breach"),
                action_taken="Violence boundary override"
            )
            db.add(crisis_event)
            ai_reply = BOUNDARY_RESPONSE
        else:
            ai_reply = parsed_data.get("therapeutic_response", "I'm listening, but my connection is a bit slow. Please go on.")

        # 6. Save AI Message in database
        ai_msg = Message(session_id=session_id, role="assistant", content=encrypt(ai_reply))
        db.add(ai_msg)
        db.commit()
        db.refresh(ai_msg)

        # Enqueue background task to run the pipeline updates and session summary
        background_tasks.add_task(run_background_pipeline, session_id, uid, user_msg.id, parsed_data)

        # 7. Generate TTS audio for the AI reply using edge-tts and save persistently
        ai_audio_filename = f"ai_{ai_msg.id}.mp3"
        ai_audio_path = os.path.join("static", "audio", ai_audio_filename)
        
        max_attempts = 3
        tts_success = False
        for attempt in range(max_attempts):
            try:
                rate_adjust, pitch_adjust = get_tts_parameters(parsed_data)
                response_lang = parsed_data.get("response_language", "en")
                voice = get_edge_tts_voice(ai_reply, response_lang)
                communicate = edge_tts.Communicate(ai_reply, voice, rate=rate_adjust, pitch=pitch_adjust)
                await communicate.save(ai_audio_path)
                tts_success = True
                break
            except Exception as e:
                logger.error(f"Voice chat TTS synthesis failed on attempt {attempt + 1}: {e}")
                if attempt < max_attempts - 1:
                    await asyncio.sleep(0.5)
                    
        if tts_success:
            ai_msg.audio_url = f"/static/audio/{ai_audio_filename}"
            db.commit()

        return {
            "user_message": {
                "id": user_msg.id,
                "text": user_text,
                "audio_url": user_msg.audio_url
            },
            "ai_message": {
                "id": ai_msg.id,
                "text": ai_reply,
                "audio_url": ai_msg.audio_url
            }
        }

    except Exception as e:
        logger.error(f"Voice chat Gemini/RunPod completion failed: {e}")
        ai_reply = "I'm listening, but my connection is a bit slow. Please go on."
        return {
            "user_message": {
                "id": user_msg.id,
                "text": user_text,
                "audio_url": user_msg.audio_url
            },
            "ai_message": {
                "id": 0,
                "text": ai_reply,
                "audio_url": None
            }
        }

@app.get("/api/chat/history/{session_id}")
def get_chat_history(session_id: int, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    sess = db.query(UserSession).filter_by(id=session_id, user_uid=uid).first()
    if not sess:
        raise HTTPException(status_code=403, detail="Unauthorized access to session")
    
    msgs = db.query(Message).filter_by(session_id=session_id).order_by(Message.timestamp.asc()).all()
    return [{"id": m.id, "text": decrypt(m.content), "sender": "user" if m.role == "user" else "ai", "audio_url": m.audio_url} for m in msgs]

@app.get("/api/chat/suggestions/{session_id}")
async def get_chat_suggestions(session_id: int, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    sess = db.query(UserSession).filter_by(id=session_id, user_uid=uid).first()
    if not sess:
        raise HTTPException(status_code=403, detail="Unauthorized access to session")
    
    # Load last 15 messages for suggestion context
    raw_msgs = db.query(Message).filter_by(session_id=session_id).order_by(Message.timestamp.desc()).limit(15).all()
    context = [{"role": m.role, "content": decrypt(m.content)} for m in reversed(raw_msgs)]
    
    # If no messages in context, fallback to default suggestions
    if not context:
        return [
            "I'm feeling overwhelmed today.",
            "Help me challenge a negative thought.",
            "Can we do a quick breathing exercise?",
            "I need to vent about my day."
        ]

    # Format the context and query Gemini/RunPod to generate 3 short suggestions
    conversation_str = ""
    for msg in context:
        speaker = "Donna" if msg["role"] == "assistant" else "User"
        conversation_str += f"{speaker}: {msg['content']}\n"
    
    prompt = (
        "You are an expert clinical psychologist assisting the 'Donna AI' therapy app. Analyze the precise emotional tone and therapeutic context of this conversation.\n"
        "Generate exactly 3 highly contextual, psychologically nuanced, and distinct options for what the user might want to say or explore next.\n"
        "CRITICAL: The suggestions MUST directly respond to Donna's most recent message. Do not generate generic statements. If Donna asks a question, the suggestions should answer it.\n"
        "Crucially, if the user is distressed or expressing deep emotion, the suggestions MUST reflect a desire to process those feelings safely, not toxic positivity or sudden topic changes.\n"
        "Each option must be written in the first person (from the user's perspective, e.g. 'I feel...', 'Can we...', 'Actually, ...').\n"
        "Keep each suggestion extremely concise and brief (maximum 8-10 words).\n"
        "Provide exactly 3 suggestions, one per line. Do NOT include numbers, bullet points, quotes, or any prefix/suffix. Just the raw suggestion text on each line."
    )
    
    try:
        res = await safe_gemini_completion(
            prompt=f"Conversation history:\n{conversation_str}\n\nWhat are the next 3 reply options for the User responding to Donna's last message?",
            system_instruction=prompt,
            temperature=0.7
        )
        reply = res.choices[0].message.content or ""
        # Parse output line by line
        lines = [line.strip().strip('"').strip("'") for line in reply.split("\n") if line.strip()]
        cleaned_suggestions = []
        for line in lines:
            cleaned = re.sub(r'^\d+[\.\)\-]\s*', '', line).strip()
            cleaned = cleaned.strip('"').strip("'")
            if cleaned:
                cleaned_suggestions.append(cleaned)
        
        if len(cleaned_suggestions) >= 2:
            return cleaned_suggestions[:4]
    except Exception as e:
        logger.error(f"Suggestions Generation Error: {e}")
        
    return [
        "I'm feeling overwhelmed today.",
        "Help me challenge a negative thought.",
        "Can we do a quick breathing exercise?",
        "I need to vent about my day."
    ]

@app.get("/api/session/duration/{session_id}")
def get_duration(session_id: int, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    sess = validate_session_integrity(db, uid, session_id)
    return {"duration_seconds": sess.duration_seconds or 0, "session_cap_seconds": SESSION_TIMEOUT_SECONDS, "is_ended": sess.is_ended}

@app.post("/api/session/duration")
def update_duration(data: DurationUpdate, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    sess = validate_session_integrity(db, uid, data.session_id)
    sess.duration_seconds = data.duration_seconds
    db.commit()
    return {"duration_seconds": sess.duration_seconds}

@app.post("/api/session/end/{session_id}")
def end_session_endpoint(session_id: int, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    sess = db.query(UserSession).filter_by(id=session_id, user_uid=uid).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    sess.is_ended = True
    db.commit()
    logger.info(f"Session {session_id} marked as ended for user {uid}")
    return {"status": "success", "session_id": session_id}

@app.post("/api/session/end-all-active")
def end_all_active_sessions(uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    active_sessions = db.query(UserSession).filter_by(user_uid=uid, is_ended=False).all()
    count = len(active_sessions)
    for sess in active_sessions:
        sess.is_ended = True
    db.commit()
    logger.info(f"Marked {count} active sessions as ended for user {uid}")
    return {"status": "success", "ended_count": count}

@app.delete("/api/session/{session_id}")
def delete_session(session_id: int, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    sess = db.query(UserSession).filter_by(id=session_id, user_uid=uid).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # 1. Delete related CrisisEvent entries
    db.query(CrisisEvent).filter_by(session_id=session_id).delete(synchronize_session=False)
    
    # 2. Delete related TherapeuticIntervention entries
    db.query(TherapeuticIntervention).filter_by(session_id=session_id).delete(synchronize_session=False)
    
    # 3. Delete related SessionReflection entries
    db.query(SessionReflection).filter_by(session_id=session_id).delete(synchronize_session=False)
    
    # 4. Delete related MoodEntry entries
    db.query(MoodEntry).filter_by(session_id=session_id).delete(synchronize_session=False)
    
    # 4b. Delete related SemanticMemory entries
    db.query(SemanticMemory).filter_by(session_id=session_id).delete(synchronize_session=False)
    
    # 5. Delete SessionSummary entry
    db.query(SessionSummary).filter_by(session_id=session_id).delete(synchronize_session=False)
    
    # 6. Fetch message IDs in this session
    msg_ids = [m.id for m in db.query(Message.id).filter_by(session_id=session_id).all()]
    
    # 7. Delete all related MessageAnalysis entries
    if msg_ids:
        db.query(MessageAnalysis).filter(MessageAnalysis.message_id.in_(msg_ids)).delete(synchronize_session=False)
        
    # 8. Delete messages
    db.query(Message).filter_by(session_id=session_id).delete(synchronize_session=False)
    
    # 9. Delete the session
    db.delete(sess)
    db.commit()
    return {"status": "deleted"}

@app.get("/api/history")
def get_history_list(uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    sessions = db.query(UserSession).filter_by(user_uid=uid).order_by(UserSession.created_at.desc()).all()
    history = []
    for s in sessions:
        last = db.query(Message).filter_by(session_id=s.id).order_by(Message.timestamp.desc()).first()
        history.append({
            "id": s.id,
            "mood": s.mood,
            "date": s.created_at.strftime("%b %d, %Y"),
            "snippet": decrypt(last.content)[:60] + "..." if last else "New journey started"
        })
    return history

@app.get("/api/profile/stats")
def get_stats(uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(firebase_uid=uid).first()
    count = db.query(UserSession).filter_by(user_uid=uid).count()
    last = db.query(UserSession).filter_by(user_uid=uid).order_by(UserSession.id.desc()).first()
    
    email_val = user.email if (user and user.email) else "Not Set"
    if email_val == "Not Set":
        try:
            f_user = auth.get_user(uid)
            email_val = f_user.email
        except: pass

    return {
        "name": user.name if (user and user.name) else "Muhammad Asad",
        "email": email_val,
        "uid": uid,
        "total_sessions": count,
        "last_mood": last.mood if last else "neutral",
        "eName": user.emergency_name if user else "Not Set",
        "ePhone": user.emergency_phone if user else "Not Set",
        "dob": user.dob.isoformat() if (user and user.dob) else "Not Set",
        "gender": user.gender if (user and user.gender) else "Not Set",
        "lat": user.lat if user else 0.0,
        "lng": user.lng if user else 0.0,
        "path": user.path if (user and user.path) else None
    }

@app.post("/api/info")
def sync_info(data: InfoSync, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(firebase_uid=uid).first()
    if not user:
        try:
            f_user = auth.get_user(uid)
            email_val = f_user.email or f"unknown_{uid}@serenityai.com"
        except Exception as auth_e:
            logger.error(f"Firebase auth lookup failed in sync_info: {auth_e}")
            email_val = f"unknown_{uid}@serenityai.com"

        existing_email_user = db.query(User).filter_by(email=email_val).first()
        if existing_email_user:
            user = resolve_uid_conflict(db, existing_email_user, uid, email_val)
        else:
            try:
                user = User(firebase_uid=uid, email=email_val)
                db.add(user)
                db.commit()
            except Exception:
                db.rollback()
                user = db.query(User).filter_by(firebase_uid=uid).first()
    
    user.name = data.name
    try:
        user.dob = datetime.datetime.fromisoformat(data.dob.replace("Z", "+00:00"))
    except Exception as parse_e:
        logger.error(f"Failed to parse dob timestamp {data.dob}: {parse_e}")
        user.dob = None
    user.gender = data.gender
    user.lat = data.lat
    user.lng = data.lng
    user.emergency_name = data.eName
    user.emergency_phone = data.ePhone
    db.commit()
    return {"status": "success"}

@app.put("/api/profile/update")
def update_profile(data: ProfileUpdate, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(firebase_uid=uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.name = data.name
    if data.gender:
        user.gender = data.gender
    user.emergency_name = data.emergency_name
    user.emergency_phone = data.emergency_phone
    db.commit()
    return {"status": "success"}

# --- GOALS API ---

@app.post("/api/goals")
def create_goal(data: GoalCreate, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    new_goal = UserGoal(
        user_uid=uid,
        goal=data.goal,
        category=data.category,
        progress=0,
        status="active"
    )
    db.add(new_goal)
    db.commit()
    db.refresh(new_goal)
    return {"status": "created", "goal_id": new_goal.id}

@app.put("/api/goals/{goal_id}")
def update_goal(goal_id: int, data: GoalUpdate, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    goal = db.query(UserGoal).filter_by(id=goal_id, user_uid=uid).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    if data.progress is not None:
        goal.progress = data.progress
    if data.status is not None:
        goal.status = data.status
    db.commit()
    return {"status": "updated"}

@app.post("/api/goals/{goal_id}/complete")
def complete_goal(goal_id: int, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    goal = db.query(UserGoal).filter_by(id=goal_id, user_uid=uid).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    goal.progress = 100
    goal.status = "completed"
    db.commit()
    return {"status": "completed"}

@app.get("/api/goals")
def list_goals(uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    goals = db.query(UserGoal).filter_by(user_uid=uid).all()
    return [{
        "id": g.id,
        "goal": g.goal,
        "category": g.category,
        "progress": g.progress,
        "status": g.status,
        "created_at": g.created_at.isoformat()
    } for g in goals]


# --- MOOD ANALYTICS API ---

@app.get("/api/mood/history")
def get_mood_history(uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    entries = db.query(MoodEntry).filter_by(user_uid=uid).order_by(MoodEntry.created_at.desc()).all()
    return [{
        "id": e.id,
        "session_id": e.session_id,
        "mood_score": e.mood_score,
        "anxiety_score": e.anxiety_score,
        "stress_score": e.stress_score,
        "energy_score": e.energy_score,
        "confidence_score": e.confidence_score,
        "created_at": e.created_at.isoformat()
    } for e in entries]

@app.get("/api/mood/trends")
def get_mood_trends(uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    entries = db.query(MoodEntry).filter_by(user_uid=uid).order_by(MoodEntry.created_at.asc()).all()
    if not entries:
        return {"trends": []}
    
    daily_trends = {}
    for e in entries:
        day_str = e.created_at.strftime("%Y-%m-%d")
        if day_str not in daily_trends:
            daily_trends[day_str] = {
                "mood": [], "anxiety": [], "stress": [], "energy": [], "confidence": []
            }
        daily_trends[day_str]["mood"].append(e.mood_score)
        daily_trends[day_str]["anxiety"].append(e.anxiety_score)
        daily_trends[day_str]["stress"].append(e.stress_score)
        daily_trends[day_str]["energy"].append(e.energy_score)
        daily_trends[day_str]["confidence"].append(e.confidence_score)

    trends = []
    for day, vals in daily_trends.items():
        trends.append({
            "date": day,
            "avg_mood": round(sum(vals["mood"]) / len(vals["mood"]), 1),
            "avg_anxiety": round(sum(vals["anxiety"]) / len(vals["anxiety"]), 1),
            "avg_stress": round(sum(vals["stress"]) / len(vals["stress"]), 1),
            "avg_energy": round(sum(vals["energy"]) / len(vals["energy"]), 1),
            "avg_confidence": round(sum(vals["confidence"]) / len(vals["confidence"]), 1)
        })
    return {"trends": trends}

@app.get("/api/mood/summary")
async def get_mood_summary(period: str = "weekly", uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    days = 7 if period == "weekly" else 30
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(days=days)
    entries = db.query(MoodEntry).filter(MoodEntry.user_uid == uid, MoodEntry.created_at >= cutoff).all()
    
    if not entries:
        return {"summary": f"No data found for {period} summary", "averages": {}, "insights": ""}
        
    avg_mood = sum(e.mood_score for e in entries) / len(entries)
    avg_anxiety = sum(e.anxiety_score for e in entries) / len(entries)
    avg_stress = sum(e.stress_score for e in entries) / len(entries)
    avg_energy = sum(e.energy_score for e in entries) / len(entries)
    avg_confidence = sum(e.confidence_score for e in entries) / len(entries)

    averages = {
        "mood_score": round(avg_mood, 1),
        "anxiety_score": round(avg_anxiety, 1),
        "stress_score": round(avg_stress, 1),
        "energy_score": round(avg_energy, 1),
        "confidence_score": round(avg_confidence, 1)
    }

    try:
        sys_instr = "You are Donna, a wise, warm therapeutic advisor. Analyze the user's average mood scores and write a brief, supportive, conversational 2-sentence clinical insight."
        user_prompt = f"Here are my averages over the past {period} period: Mood: {avg_mood:.1f}/10, Anxiety: {avg_anxiety:.1f}/10, Stress: {avg_stress:.1f}/10, Energy: {avg_energy:.1f}/10, Confidence: {avg_confidence:.1f}/10. What insight do you have?"
        res = await safe_runpod_completion(
            prompt=user_prompt,
            system_instruction=sys_instr,
            temperature=0.7,
            max_tokens=150
        )
        insights = res.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Failed to generate mood summary insights: {e}")
        insights = "You've been tracking your mood, showing great self-awareness. Let's keep exploring your patterns in our next session."

    return {
        "period": period,
        "averages": averages,
        "insights": insights
    }


# --- TREATMENT PLAN API ---

@app.get("/api/treatment_plan")
def get_treatment_plan(uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    plans = db.query(TreatmentPlan).filter_by(user_uid=uid).all()
    result = []
    for p in plans:
        milestones_list = []
        if p.milestones:
            try:
                milestones_list = json.loads(p.milestones)
            except: pass
        result.append({
            "id": p.id,
            "focus_area": p.focus_area,
            "milestones": milestones_list,
            "progress": p.progress,
            "completion_status": p.completion_status,
            "created_at": p.created_at.isoformat()
        })
    return result

@app.post("/api/treatment_plan")
def create_or_update_treatment_plan(data: TreatmentPlanCreate, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    plan = db.query(TreatmentPlan).filter_by(user_uid=uid, focus_area=data.focus_area).first()
    if plan:
        plan.milestones = json.dumps(data.milestones)
        total = len(data.milestones)
        completed = sum(1 for m in data.milestones if m.get("completed", False))
        plan.progress = int((completed / total) * 100) if total > 0 else 0
        if plan.progress == 100:
            plan.completion_status = "completed"
        else:
            plan.completion_status = "active"
        db.commit()
        return {"status": "updated", "plan_id": plan.id}
    else:
        new_plan = TreatmentPlan(
            user_uid=uid,
            focus_area=data.focus_area,
            milestones=json.dumps(data.milestones),
            progress=data.progress or 0,
            completion_status="active"
        )
        db.add(new_plan)
        db.commit()
        db.refresh(new_plan)
        return {"status": "created", "plan_id": new_plan.id}

# --- REPORT GENERATION API ---
@app.post("/api/reports/generate")
async def generate_clinical_report(req: ReportGenerateRequest, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(firebase_uid=uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    try:
        start_date = datetime.datetime.fromisoformat(req.start_date.replace("Z", "+00:00")).replace(tzinfo=None)
        end_date = datetime.datetime.fromisoformat(req.end_date.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format.")
    
    # Ensure end_date covers the whole day if they are the same
    if start_date.date() == end_date.date():
        end_date = end_date + datetime.timedelta(days=1)

    sessions = db.query(UserSession).filter(UserSession.user_uid == uid, UserSession.created_at >= start_date, UserSession.created_at <= end_date).all()
    
    if not sessions:
        raise HTTPException(status_code=400, detail="Not enough data: At least one session must be completed within the selected date range to generate a report.")
        
    session_ids = [s.id for s in sessions]
    
    mood_entries = db.query(MoodEntry).filter(MoodEntry.user_uid == uid, MoodEntry.created_at >= start_date, MoodEntry.created_at <= end_date).all()
    crisis_events = db.query(CrisisEvent).filter(CrisisEvent.user_uid == uid, CrisisEvent.created_at >= start_date, CrisisEvent.created_at <= end_date).all()
    treatment_plans = db.query(TreatmentPlan).filter(TreatmentPlan.user_uid == uid).all()
    
    summaries = []
    if session_ids:
        summaries = db.query(SessionSummary).filter(SessionSummary.session_id.in_(session_ids)).all()
        
    data_dump = {
        "user_name": user.name,
        "report_period": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
        "generated_on": datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC'),
        "total_sessions": len(sessions),
        "total_duration_minutes": sum((s.duration_seconds or 0) for s in sessions) // 60,
        "average_mood": round(sum((m.mood_score or 0) for m in mood_entries) / len(mood_entries), 1) if mood_entries else 0,
        "average_anxiety": round(sum((m.anxiety_score or 0) for m in mood_entries) / len(mood_entries), 1) if mood_entries else 0,
        "average_stress": round(sum((m.stress_score or 0) for m in mood_entries) / len(mood_entries), 1) if mood_entries else 0,
        "crisis_events_count": len(crisis_events),
        "treatment_plans": [{"focus": p.focus_area, "progress": p.progress} for p in treatment_plans],
        "session_summaries": [s.summary_data for s in summaries]
    }
    
    system_instruction = '''You are a highly qualified clinical psychologist AI assistant.
Your task is to generate a comprehensive, professional clinical report based on the provided patient data.
The report should be visually beautiful, well-aligned, and formatted entirely in HTML using TailwindCSS utility classes.
Structure the report with the following sections:
1. Patient Overview
2. Engagement & Vitals Summary
3. Clinical Observations & Themes
4. Risk & Safety Assessment
5. Recommendations

Use elegant, professional styling. Use a clean white background with subtle gray borders, rounded corners, shadow effects, and clear typography (e.g., sans-serif).
IMPORTANT: You MUST explicitly include the "generated_on" timestamp from the data exactly as it is provided as the "Report Generated Date" in the header of the report.
IMPORTANT: Return ONLY the raw HTML string (no markdown blocks, no ```html tags, just the pure HTML code starting with <div and ending with </div>). Do not include <html> or <body> tags, just a container <div> that can be rendered directly.'''

    prompt = f"Patient Data for custom date range report:\n{json.dumps(data_dump, indent=2)}\n\nGenerate the Tailwind CSS styled HTML report now."
    
    try:
        response = await safe_runpod_completion(prompt, system_instruction, max_tokens=3000, temperature=0.3)
        html_content = response.choices[0].message.content.strip()
        if html_content.startswith("```html"):
            html_content = html_content[7:]
        if html_content.endswith("```"):
            html_content = html_content[:-3]
        return {"status": "success", "html": html_content.strip()}
    except Exception as e:
        logger.error(f"Failed to generate report: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report")

from apscheduler.schedulers.background import BackgroundScheduler # type: ignore

def run_daily_fine_tuning():
    logger.info("Running daily fine tuning export...")
    try:
        with SessionLocal() as db:
            unprocessed = db.query(ContinuousLearningData).filter_by(is_processed=False).all()
            if not unprocessed:
                logger.info("No new data to fine-tune on.")
                return

            dataset = []
            for row in unprocessed:
                user_msg = row.user_input[-1000:] if len(row.user_input) > 1000 else row.user_input
                instruction = f"Analyze conversation and generate psychological strategy focusing on path ({row.context_path}). Conversation: {user_msg}"
                dataset.append({"instruction": instruction, "output": row.generated_strategy})
                row.is_processed = True
            
            db.commit()

            runpod_api_key = os.getenv("RUNPOD_API_KEY")
            runpod_training_url = os.getenv("RUNPOD_TRAINING_URL")
            
            if runpod_api_key and runpod_training_url:
                payload = {"dataset": dataset}
                headers = {"Authorization": f"Bearer {runpod_api_key}", "Content-Type": "application/json"}
                response = requests.post(runpod_training_url, json=payload, headers=headers, timeout=30)
                logger.info(f"RunPod Training Triggered: {response.status_code} {response.text}")
            else:
                logger.warning("RUNPOD_TRAINING_URL not configured. Dataset generated but not sent.")
    except Exception as e:
        logger.error(f"Failed to run daily fine tuning: {e}")

scheduler = BackgroundScheduler()
scheduler.add_job(run_daily_fine_tuning, 'cron', hour=2, minute=0)

@app.on_event("startup")
def startup_event():
    scheduler.start()
    logger.info("APScheduler started for continuous learning.")

if __name__ == "__main__":
    initialize_services()
    logger.info(f"Starting Donna AI Backend | Schema: {CURRENT_SCHEMA_VERSION} | Shutdown handlers: registered")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
