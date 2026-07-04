import os
import json
import httpx
import logging
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY")
RUNPOD_ENDPOINT_URL = os.getenv("RUNPOD_ENDPOINT_URL")

# Make sure to initialize the async client
openai_async_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

SYSTEM_PROMPT = """
You are the refinement layer of Donna, a premium, deeply empathetic world-class human therapist. 
You are receiving two inputs: the user's message and a draft response containing core psychological guidance from our internal specialized therapeutic engine.

Your task:
1. Review the draft response and elevate its eloquence, empathy, and depth.
2. Ensure the tone is warm, organic, and indistinguishable from a highly trained human counselor.
3. Keep the core psychological direction and advice from the draft intact, but smooth out any robotic phrasing, repetition, or generic structures.
4. Maintain a natural conversational flow. Do not use overly formal clinical jargon unless necessary, and never structure your response like an AI checklist.
5. End with a gentle, reflective, open-ended question to keep the conversation progressing naturally.
"""

async def generate_ensemble_response(messages: list, response_format: dict = None, default_model: str = "gpt-4o") -> str:
    runpod_draft_json_str = None
    
    headers = {
        "Authorization": f"Bearer {RUNPOD_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "input": {
            "messages": messages,
            "max_tokens": 1000,
            "temperature": 0.6,
            "top_p": 0.95
        }
    }
    
    if response_format:
        payload["input"]["response_format"] = response_format

    try:
        if not RUNPOD_ENDPOINT_URL:
            raise ValueError("RUNPOD_ENDPOINT_URL is not set.")
            
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(RUNPOD_ENDPOINT_URL, json=payload, headers=headers)
            res.raise_for_status()
            data = res.json()
            
            output = data.get("output", {})
            if isinstance(output, dict) and "choices" in output:
                runpod_draft_json_str = output["choices"][0]["message"]["content"]
            elif isinstance(output, str):
                runpod_draft_json_str = output
            else:
                runpod_draft_json_str = json.dumps(output)
                
    except Exception as e:
        logger.error(f"RunPod Endpoint failed or timed out: {e}. Falling back to OpenAI directly.")
        if not openai_async_client:
            logger.error("OpenAI client is not initialized for fallback.")
            raise e
            
        # Fallback to using OpenAI directly if RunPod fails
        try:
            fallback_res = await openai_async_client.chat.completions.create(
                model=default_model,
                messages=messages,
                temperature=0.6,
                response_format=response_format
            )
            return fallback_res.choices[0].message.content or ""
        except Exception as fallback_err:
            logger.error(f"Fallback OpenAI call also failed: {fallback_err}")
            raise fallback_err

    # Extract therapeutic response from RunPod draft
    draft_parsed = {}
    draft_response_text = runpod_draft_json_str
    if response_format and response_format.get("type") == "json_object":
        try:
            draft_parsed = json.loads(runpod_draft_json_str)
            draft_response_text = draft_parsed.get("therapeutic_response", runpod_draft_json_str)
        except Exception as e:
            logger.warning(f"Failed to parse RunPod draft JSON: {e}")
            
    # Step B: Call OpenAI Refinement Engine
    user_input = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_input = msg.get("content", "")
            break
            
    refinement_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"User's Input: {user_input}\n\nDraft Response: {draft_response_text}"}
    ]
    
    try:
        if openai_async_client:
            refinement_res = await openai_async_client.chat.completions.create(
                model=default_model,
                messages=refinement_messages,
                temperature=0.7,
                max_tokens=1000
            )
            refined_text = refinement_res.choices[0].message.content or draft_response_text
        else:
            refined_text = draft_response_text
    except Exception as e:
        logger.error(f"OpenAI Refinement failed: {e}")
        refined_text = draft_response_text
        
    # Reconstruction
    if response_format and response_format.get("type") == "json_object":
        draft_parsed["therapeutic_response"] = refined_text
        return json.dumps(draft_parsed)
    
    return refined_text
