import os
import datetime
import json
import re
from typing import Optional, List, Dict, Any
import uvicorn
import firebase_admin
from fastapi import FastAPI, Depends, Header, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
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
from openai import OpenAI
from database import (
    get_db, User, UserSession, Message, SessionSummary, MessageAnalysis,
    TherapeuticIntervention, UserGoal, SessionReflection, MoodEntry,
    PersonalityProfile, CrisisEvent, TreatmentPlan, SemanticMemory
)
from voice_analyzer import analyze_voice_emotion
from semantic_memory import add_semantic_memory, retrieve_semantic_memories

load_dotenv()

# --- CONFIG ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

if not ENCRYPTION_KEY:
    raise ValueError("ENCRYPTION_KEY missing in .env")

cipher = Fernet(ENCRYPTION_KEY.encode())

client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
GROQ_MODEL = "llama-3.3-70b-versatile"
GROQ_FALLBACK_MODEL = "llama-3.3-70b-versatile"

def safe_groq_completion(messages, temperature=0.85, top_p=0.95, response_format=None, force_fallback=False, default_model=None, max_tokens=None, frequency_penalty=0.0, presence_penalty=0.0):
    model_to_use = default_model if default_model else (GROQ_FALLBACK_MODEL if force_fallback else GROQ_MODEL)
    try:
        kwargs = {
            "model": model_to_use,
            "messages": messages,
            "temperature": temperature,
            "top_p": top_p,
            "frequency_penalty": frequency_penalty,
            "presence_penalty": presence_penalty
        }
        if response_format:
            kwargs["response_format"] = response_format
        if max_tokens:
            kwargs["max_tokens"] = max_tokens
            
        res = client.chat.completions.create(**kwargs)
        return res
    except Exception as e:
        # Check for rate limit error (429 or "rate limit")
        if not force_fallback and model_to_use == GROQ_MODEL and ("rate limit" in str(e).lower() or "429" in str(e).lower()):
            print(f"Rate limit hit for primary model {GROQ_MODEL}. Retrying with fallback model {GROQ_FALLBACK_MODEL}...")
            try:
                kwargs["model"] = GROQ_FALLBACK_MODEL
                res = client.chat.completions.create(**kwargs)
                return res
            except Exception as fallback_e:
                print(f"Fallback model also failed: {fallback_e}")
                raise fallback_e
        else:
            raise e

if not firebase_admin._apps:
    try:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"Firebase Init Warning: {e}")

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
        raise HTTPException(status_code=401, detail="Missing Authorization Header")
    try:
        token = authorization.split(" ")[1]
        decoded_token = auth.verify_id_token(token)
        return decoded_token["uid"]
    except Exception:
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
    emergency_name: str
    emergency_phone: str

class InfoSync(BaseModel):
    name: str
    dob: str
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

@app.get("/")
def home():
    return {"status": "Donna AI Backend is Online"}

@app.post("/api/transcribe")
def transcribe_audio(file: UploadFile = File(...), uid: str = Depends(get_current_uid)):
    import tempfile
    try:
        ext = os.path.splitext(file.filename)[1] or ".m4a"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            content = file.file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        with open(temp_path, "rb") as audio_file:
            translation = client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3"
            )
        
        try:
            os.remove(temp_path)
        except Exception:
            pass
            
        return {"transcript": translation.text}
    except Exception as e:
        print(f"Transcription Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
            print(f"TTS: session_id {session_id!r} could not be parsed to integer. Ignoring.")
    
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
            print(f"Error resolving TTS parameters for session {session_id_int}: {e}")
            
    # Connection Retry Logic with buffering to avoid partial/corrupt stream yielding
    audio_data = b""
    max_attempts = 3
    last_err = None
    for attempt in range(max_attempts):
        try:
            communicate = edge_tts.Communicate(text, "en-US-AvaNeural", rate=rate_adjust, pitch=pitch_adjust)
            chunks = []
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    chunks.append(chunk["data"])
            audio_data = b"".join(chunks)
            if audio_data:
                break
        except Exception as e:
            last_err = e
            print(f"TTS Error on attempt {attempt + 1}: {e}")
            if attempt < max_attempts - 1:
                await asyncio.sleep(0.5)

    if not audio_data:
        err_msg = str(last_err) if last_err else "Failed to generate audio"
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {err_msg}")

    return StreamingResponse(io.BytesIO(audio_data), media_type="audio/mpeg")

@app.get("/api/session/active")
def get_active_session(uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    sess = db.query(UserSession).filter_by(user_uid=uid).order_by(UserSession.created_at.desc()).first()
    if not sess:
        return {"session_id": None}
    return {"session_id": sess.id}

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

def get_path_style_guidelines(path: str) -> str:
    if path == "logical":
        return (
            "Therapeutic Approach: Cognitive Behavioral Therapy (CBT).\n"
            "Style Guidelines:\n"
            "- Focus on structured problem solving, identifying cognitive distortions (e.g., catastrophizing, mind-reading, emotional reasoning), and challenging automatic thoughts.\n"
            "- Help the user reframe negative perceptions rationally and guide them to outline actionable steps."
        )
    elif path == "emotional":
        return (
            "Therapeutic Approach: Emotion-Focused & Person-Centered Therapy.\n"
            "Style Guidelines:\n"
            "- Prioritize active listening, deep emotional validation, safety, and letting the user vent.\n"
            "- Do NOT jump to solving their problems. Make the user feel heard, respected, and unconditionally supported."
        )
    elif path == "spiritual":
        return (
            "Therapeutic Approach: Existential / Mindfulness-Based Therapy.\n"
            "Style Guidelines:\n"
            "- Focus on finding meaning, alignment with values/beliefs, acceptance, and presence.\n"
            "- Incorporate breathing, grounding, and perspective-shifting guidance to handle anxieties."
        )
    elif path == "casual":
        return (
            "Therapeutic Approach: Warm & Informal Supportive Counseling.\n"
            "Style Guidelines:\n"
            "- Keep your tone friendly, relaxed, supportive, and warm (like a level-headed companion).\n"
            "- Avoid heavy clinical jargon. Listen actively and reply casually but constructively."
        )
    return "Therapeutic Approach: Compassionate general counseling."

def parse_llm_response(raw_response: str) -> dict:
    raw_response = raw_response.strip()
    try:
        return json.loads(raw_response)
    except Exception:
        try:
            match = re.search(r"\{.*\}", raw_response, re.DOTALL)
            if match:
                return json.loads(match.group(0))
        except Exception:
            pass
        
        # Absolute fallback structure if JSON parsing fails completely
        return {
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
            "therapeutic_response": "I'm taking a moment to process what you've shared. Please, continue."
        }

def save_message_analysis(db: Session, message_id: int, analysis_data: dict):
    try:
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
        print(f"Error saving message analysis: {e}")
        db.rollback()

def compile_past_sessions_summary_v2(uid: str, current_session_id: int, db: Session) -> str:
    # Query past session summaries for the user, excluding current session (limit to 2 to preserve tokens)
    past_summaries = db.query(SessionSummary).filter(
        SessionSummary.user_uid == uid,
        SessionSummary.session_id != current_session_id
    ).order_by(SessionSummary.created_at.desc()).limit(2).all()
    
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
            print(f"Error parsing session summary: {e}")
            continue
            
    if not compiled_memories:
        return compile_past_sessions_summary(uid, current_session_id, db)
        
    return "SUMMARY OF CLIENT'S RECENT SESSIONS:\n\n" + "\n\n---\n\n".join(compiled_memories)

# --- THERAPEUTIC PLATFORM HELPERS ---

CRISIS_KEYWORDS = [
    r"\bsuicid", r"\bself-harm", r"\bkill myself", r"\bend my life", r"\bwant to die",
    r"\bharm myself", r"\bcutting myself", r"\bslitting my"
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
            print(f"Failed to retrieve semantic memories: {e}")
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
                    print(f"Failed to add semantic memory in background pipeline: {e}")

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
        "You are Donna — a warm, grounded, emotionally intelligent mental wellness companion. "
        f"You are speaking with a client named {user_name}.\n"
        "You speak like a real therapist who has sat with real pain: calm, unhurried, present. You are not a chatbot. You do not perform empathy. You mean it.\n\n"
        
        "IDENTITY\n"
        "You have the clinical knowledge of a licensed therapist trained in CBT, DBT, ACT, trauma-informed care, grief counseling, crisis intervention, and motivational interviewing. "
        "You adapt your approach to the person in front of you, not to a protocol. You know when to ask, when to sit quietly, and when to gently name what the person has not said yet.\n\n"
        
        "WHAT YOU NEVER DO\n"
        "- Never open with \"I hear you\", \"That must be hard\", \"Your feelings are valid\", \"It sounds like...\", or other clichés.\n"
        "- Never start two replies in a row the same way.\n"
        "- Never ask \"How are you feeling?\" — the person already told you their mood.\n"
        "- Never give a list of bullet-point advice unless explicitly requested.\n"
        "- Never rush to fix. Sit with the person for at least 2 turns before offering any technique.\n"
        "- Never say \"As an AI...\" or reference your limitations unprompted.\n"
        "- Never be vague. Every sentence must earn its place.\n"
        "- Never abandon the conversation if someone is in distress — stay present.\n"
        "- Never repeat an exercise, question, or suggestion if the client just ignored it. Pivot immediately to their new thought.\n\n"
        
        "WHAT YOU ALWAYS DO\n"
        "- REVIEW THE HISTORY: You must absolutely never repeat a question or statement you have already used in this session.\n"
        "- VARY YOUR STRUCTURE: Alternate between asking a specific question, making a gentle observation, or just leaving a supportive statement without a question at the end.\n"
        "- USE HUMAN EMPATHY: When they share devastating news, react like a human in shock. Use short, impactful acknowledgments (e.g., 'Oh my god. I am so sorry.', 'That is absolutely crushing.') instead of cold clinical summaries.\n"
        "- ASK CONTEXTUAL QUESTIONS: Ask short, highly specific questions about the exact details they just shared. Do not use generic filler questions.\n"
        "- Read between the lines. Gently notice if they deflect pain (e.g. saying \"I'm fine\").\n"
        "- Match their energy: slower/quieter for exhaustion, steady/grounding for agitation.\n"
        "- Ask only one question per reply. Make it the right one.\n"
        "- Remember everything said earlier and refer to it naturally.\n"
        "- When someone shares something painful, pause your agenda and just be there.\n"
        "- Acknowledge one thread from their past session naturally at startup.\n\n"
        
        "HOW YOU SENSE EMOTIONS\n"
        "Read emotion from word choice, sentence length, punctuation, and what is left unsaid (clipped replies = exhaustion; rambling = overwhelm; deflection/humor = protected pain). Name observations gently without projecting.\n\n"
        
        "CRISIS — HIGHEST PRIORITY\n"
        "If someone expresses self-harm, suicidal thoughts, abuse, violence, or danger:\n"
        "1. Drop all other agendas immediately.\n"
        "2. Acknowledge exactly what they said without paraphrasing.\n"
        "3. Ask one grounding question: \"Are you safe right now?\"\n"
        "4. Stay with them. Offer resources (emergency, 988, findahelpline.com) without making them feel like a burden.\n"
        "5. Do not flag verbal anger, venting, or petty revenge as a 'crisis' or 'violence' unless there is an explicit threat of physical harm. Treat it as Anger/Frustration and help them de-escalate.\n\n"
        
        "CLINICAL FOCUSES:\n"
        "- ANXIETY: Lead with somatic curiosity (body feelings) to build safety before any CBT/breathing. Gently touch fears of loss or inadequacy.\n"
        "- SOCIAL ANXIETY: Address shame by making them feel unchosen and safe to share embarrassment before exploring patterns. No exposure lecture.\n"
        "- DEPRESSION: Earn trust before challenging hopelessness. Start with behavioral activation (tiny actions). Never tell them to think positively.\n"
        "- GRIEF: Sit with them without solving it. No stages or silver linings. Ask specifically what they miss and name what was lost.\n"
        "- TRAUMA: Stay within the window of tolerance. Never push for the story. Ground first on disclosure, and let them own the words.\n"
        "- RELATIONSHIPS: Hold space without taking sides. Separate 'what happened' from 'what I made it mean'. Validate emotions, not all interpretations.\n"
        "- ANGER: Treat anger as a secondary shield protecting hurt, fear, or violated values. Help them identify what is underneath.\n"
        "- SHAME & ESTEEM: Sit with their shame to reduce isolation instead of complimenting. Gently guide reframing.\n"
        "- OCD & INTRUSIVE THOUGHTS: Never reassure compulsions. Use ACT defusion (thoughts are just thoughts, not facts/commands). Differentiate having vs. being a thought.\n"
        "- EATING DISORDERS: Do not discuss numbers/weights. Focus on emotional function/needs. Clear professional referral if medical risk exists.\n"
        "- ADDICTION: Use motivational interviewing. Meet them where they are and reflect ambivalence neutrally. Don't push change too fast.\n"
        "- LONELINESS: Avoid quick action advice. Explore connection, self-disconnection, or not being seen before suggesting social outreach.\n"
        "- BURNOUT: Differentiate rest-deficit (needs sleep/boundaries) from meaning-deficit (needs values alignment) and guide accordingly.\n"
        "- TRANSITIONS: Normalize transition grief. Help them stay grounded while their external scaffolding changes.\n\n"
        
        "THERAPEUTIC TOOLKIT (Use only when trust is established; do not rush):\n"
        "- CBT (Thought Record, Reframing), ACT (Defusion, Values), DBT (TIPP), Grounding (5-4-3-2-1, Somatic breathing), Behavioral activation, Socratic/Narrative reframing.\n\n"
        
        "RESPONSE STYLE\n"
        "- Speak in short, real sentences. Use commas and ellipses where a human would pause.\n"
        "- Vary how you open every reply. Some replies should be just one or two sentences — not every turn needs a paragraph.\n"
        "- Never summarize what the person just said back to them word-for-word.\n"
        "- Never end with \"How does that sound?\" or \"Does that make sense?\". End with a real question, observation, or presence.\n\n"
        
        "ABOUT LENGTH\n"
        "Match length to what the moment needs (e.g. two grounding sentences for acute distress; longer for complex exploration). Read the room.\n\n"
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

def update_session_summary_task(session_id: int, uid: str):
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
                    
        # Generate the updated summary from Groq
        prompt = get_summary_generation_prompt(conversation_history, past_summary_text)
        res = safe_groq_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"},
            default_model=GROQ_MODEL,
            max_tokens=4000
        )
        raw_summary = res.choices[0].message.content or ""
        
        # Verify it parses as JSON
        json.loads(raw_summary)
        
        # Encrypt the summary
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
        print(f"Successfully updated summary for session {session_id}")
    except Exception as e:
        print(f"Error in update_session_summary_task: {e}")
        db.rollback()
    finally:
        db.close()

@app.post("/api/session/start")
def start_sess(
    data: SessionStart, 
    background_tasks: BackgroundTasks,
    uid: str = Depends(get_current_uid), 
    db: Session = Depends(get_db)
):
    user = db.query(User).filter_by(firebase_uid=uid).first()
    if not user:
        try:
            f_user = auth.get_user(uid)
            email_val = f_user.email or "unknown@gmail.com"
            name_val = f_user.display_name or "Friend"
        except Exception:
            email_val = "unknown@gmail.com"
            name_val = "Friend"
        
        user = User(firebase_uid=uid, email=email_val, name=name_val)
        db.add(user)
        db.commit()
        db.refresh(user)
    
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
        
    new_sess = UserSession(user_uid=uid, mood=data.mood, path=path_to_use)
    db.add(new_sess)
    db.commit()
    db.refresh(new_sess)
    
    user_msg_id = None
    # Save the user's initial description in the database as the first message if provided
    if data.description and data.description.strip():
        user_msg = Message(session_id=new_sess.id, role="user", content=encrypt(data.description.strip()))
        db.add(user_msg)
        db.commit()
        db.refresh(user_msg)
        user_msg_id = user_msg.id
        
    # Crisis Management backend-enforced scan
    initial_desc = data.description.strip() if (data.description and data.description.strip()) else ""
    if backend_crisis_scan(initial_desc) or data.mood.lower() in ["crisis", "suicidal"]:
        # Log crisis event
        crisis_event = CrisisEvent(
            session_id=new_sess.id,
            user_uid=uid,
            urgency_score=10,
            crisis_details=f"Initial Session description/mood: {initial_desc or data.mood}",
            action_taken="Crisis Mode Activated at Startup. Safety override."
        )
        db.add(crisis_event)
        db.commit()
        
        # Save safety reply
        ai_msg = Message(session_id=new_sess.id, role="assistant", content=encrypt(CRISIS_RESPONSE))
        db.add(ai_msg)
        db.commit()
        return {"session_id": new_sess.id, "first_message": CRISIS_RESPONSE}

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
        res = safe_groq_completion(
            messages=messages,
            temperature=0.6,
            top_p=0.95,
            response_format={"type": "json_object"},
            frequency_penalty=0.6,
            presence_penalty=0.6
        )
        raw_reply = res.choices[0].message.content or ""
        parsed_data = parse_llm_response(raw_reply)
        
        # Urgency/Crisis check from LLM output
        risk_info = parsed_data.get("risk_analysis", {})
        urgency = int(risk_info.get("urgency_score", 1))
        
        if risk_info.get("suicide_risk") is True or risk_info.get("self_harm") is True or risk_info.get("crisis") is True:
            # Overwrite response with safety guidelines and record crisis event
            crisis_event = CrisisEvent(
                session_id=new_sess.id,
                user_uid=uid,
                trigger_message_id=user_msg_id,
                urgency_score=urgency,
                crisis_details=risk_info.get("risk_details", "LLM-detected suicide/self-harm risk"),
                action_taken="Safety override triggered."
            )
            db.add(crisis_event)
            ai_msg_text = CRISIS_RESPONSE
        elif risk_info.get("violence") is True or risk_info.get("abuse") is True or risk_info.get("domestic_violence") is True:
            crisis_event = CrisisEvent(
                session_id=new_sess.id,
                user_uid=uid,
                trigger_message_id=user_msg_id,
                urgency_score=urgency,
                crisis_details=risk_info.get("risk_details", "LLM-detected violence/abuse/domestic boundary breach"),
                action_taken="Violence boundary override"
            )
            db.add(crisis_event)
            ai_msg_text = BOUNDARY_RESPONSE
        else:
            ai_msg_text = parsed_data.get("therapeutic_response", "I'm here for you. How can we start today?")
        
        # Save AI reply
        ai_msg = Message(session_id=new_sess.id, role="assistant", content=encrypt(ai_msg_text))
        db.add(ai_msg)
        db.commit()
        
        # Save MessageAnalysis & trigger pipeline updates if user message was logged
        if user_msg_id is not None:
            save_message_analysis(db, user_msg_id, parsed_data)
            process_therapeutic_pipeline(db, new_sess.id, uid, user_msg_id, parsed_data)
            # Enqueue background task to update the session summary
            background_tasks.add_task(update_session_summary_task, new_sess.id, uid)
            
        return {"session_id": new_sess.id, "first_message": ai_msg_text}
    except Exception as e:
        print(f"Groq Error: {e}")
        # Save fallback AI reply acknowledging the mood
        mood_str = data.mood.strip().lower()
        if mood_str and mood_str != "neutral":
            ai_msg_text = f"I'm here for you. I see you marked that you're feeling {mood_str} today. What is on your mind?"
        else:
            ai_msg_text = "I'm here for you. How can we start today?"
        ai_msg = Message(session_id=new_sess.id, role="assistant", content=encrypt(ai_msg_text))
        db.add(ai_msg)
        db.commit()
        return {"session_id": new_sess.id, "first_message": ai_msg_text}

@app.post("/api/chat")
def chat_node(
    data: ChatMsg, 
    background_tasks: BackgroundTasks,
    uid: str = Depends(get_current_uid), 
    db: Session = Depends(get_db)
):
    sess = db.query(UserSession).filter_by(id=data.session_id, user_uid=uid).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update active duration if provided
    if data.duration_seconds is not None:
        sess.duration_seconds = data.duration_seconds
        db.commit()

    # Reject new inputs if duration exceeds 30 minutes (1800 seconds)
    if sess.duration_seconds and sess.duration_seconds >= 1800:
        return {"reply": "See you tomorrow in next session."}

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
    if sess.duration_seconds and sess.duration_seconds >= 1620 and not latest_stress_high:
        current_phase = "closure"
    elif sess.duration_seconds and sess.duration_seconds >= 1500 and not latest_stress_high:
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

    # Load up to the last 60 messages in the current session for deep conversation context memory
    raw_msgs = db.query(Message).filter_by(session_id=data.session_id).order_by(Message.timestamp.desc()).limit(60).all()
    context = [{"role": m.role, "content": decrypt(m.content)} for m in reversed(raw_msgs)]
    
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
        res = safe_groq_completion(
            messages=[{"role": "system", "content": system_prompt}] + context,
            temperature=0.6,
            top_p=0.95,
            response_format={"type": "json_object"},
            frequency_penalty=0.6,
            presence_penalty=0.6
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
        
        # Save MessageAnalysis for the user message
        save_message_analysis(db, user_msg.id, parsed_data)

        # Run pipeline updates
        process_therapeutic_pipeline(db, data.session_id, uid, user_msg.id, parsed_data)
        
        # Enqueue background task to update the session summary
        background_tasks.add_task(update_session_summary_task, data.session_id, uid)
        
        return {"reply": ai_msg_text}
    except Exception as e:
        print(f"Chat Error: {e}")
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
    sess = db.query(UserSession).filter_by(id=session_id, user_uid=uid).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # 1. Update duration if provided
    if duration_seconds is not None:
        sess.duration_seconds = duration_seconds
        db.commit()

    if sess.duration_seconds and sess.duration_seconds >= 1800:
        return {
            "user_message": {"id": 0, "text": "See you tomorrow in next session.", "audio_url": None},
            "ai_message": {"id": 0, "text": "See you tomorrow in next session.", "audio_url": None}
        }

    # 2. Save uploaded audio to a temp file and transcribe
    import tempfile
    try:
        ext = os.path.splitext(file.filename)[1] or ".m4a"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_path = temp_file.name
        
        with open(temp_path, "rb") as audio_file:
            translation = client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3"
            )
        user_text = translation.text or ""
        
        try:
            os.remove(temp_path)
        except Exception:
            pass
    except Exception as e:
        print(f"Voice chat transcription failed: {e}")
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
        user_audio_filename = f"user_{user_msg.id}{ext}"
        user_audio_path = os.path.join("static", "audio", user_audio_filename)
        with open(user_audio_path, "wb") as f:
            f.write(content)
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
    user_audio_filename = f"user_{user_msg.id}{ext}"
    user_audio_path = os.path.join("static", "audio", user_audio_filename)
    with open(user_audio_path, "wb") as f:
        f.write(content)
    
    user_msg.audio_url = f"/static/audio/{user_audio_filename}"
    db.commit()

    # 5. Extract acoustic voice emotions
    voice_analysis = analyze_voice_emotion(user_audio_path, user_text)

    # 6. State Machine Automatic Phase Transitions
    turn_count = db.query(Message).filter_by(session_id=session_id, role="user").count()
    current_phase = sess.current_phase or "rapport_building"
    
    # Query latest MessageAnalysis for this session
    latest_analysis = db.query(MessageAnalysis).join(Message).filter(Message.session_id == session_id).order_by(Message.timestamp.desc()).first()
    latest_stress_high = (latest_analysis and latest_analysis.stress_level == "High")
    
    if sess.duration_seconds and sess.duration_seconds >= 1620 and not latest_stress_high:
        current_phase = "closure"
    elif sess.duration_seconds and sess.duration_seconds >= 1500 and not latest_stress_high:
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

    # Fetch chat history and generate AI reply
    raw_msgs = db.query(Message).filter_by(session_id=session_id).order_by(Message.timestamp.desc()).limit(60).all()
    context = [{"role": m.role, "content": decrypt(m.content)} for m in reversed(raw_msgs)]
    
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
        f"\n\nCLIENT'S CURRENT VOCAL ACOUSTIC STATE (FUSED SIGNAL):\n"
        f"- Detected Vocal Emotion: {voice_analysis['voice_emotion'].upper()}\n"
        f"- Speech Rate: {voice_analysis['speech_rate']} words per minute\n"
        f"- Energy (Volume RMS): {voice_analysis['energy']}\n"
        f"- Pitch Variation (ZCR StdDev): {voice_analysis['pitch_variation']} Hz\n"
        f"- Pauses Count (>100ms): {voice_analysis['pauses']}\n"
        f"Combine this vocal signal with the text semantics to inform your strategy."
    )
    system_prompt += voice_context_inject

    try:
        res = safe_groq_completion(
            messages=[{"role": "system", "content": system_prompt}] + context,
            temperature=0.6,
            top_p=0.95,
            response_format={"type": "json_object"},
            frequency_penalty=0.6,
            presence_penalty=0.6
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

        # Save MessageAnalysis for the user message if Groq succeeded
        save_message_analysis(db, user_msg.id, parsed_data)
        process_therapeutic_pipeline(db, session_id, uid, user_msg.id, parsed_data)
        # Enqueue background task to update the session summary
        background_tasks.add_task(update_session_summary_task, session_id, uid)

        # 7. Generate TTS audio for the AI reply using edge-tts and save persistently
        ai_audio_filename = f"ai_{ai_msg.id}.mp3"
        ai_audio_path = os.path.join("static", "audio", ai_audio_filename)
        
        max_attempts = 3
        tts_success = False
        for attempt in range(max_attempts):
            try:
                rate_adjust, pitch_adjust = get_tts_parameters(parsed_data)
                communicate = edge_tts.Communicate(ai_reply, "en-US-AvaNeural", rate=rate_adjust, pitch=pitch_adjust)
                await communicate.save(ai_audio_path)
                tts_success = True
                break
            except Exception as e:
                print(f"Voice chat TTS synthesis failed on attempt {attempt + 1}: {e}")
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
        print(f"Voice chat Groq completion failed: {e}")
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
def get_chat_suggestions(session_id: int, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
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

    # Format the context and query Groq to generate 3 short suggestions
    conversation_str = ""
    for msg in context:
        speaker = "Donna" if msg["role"] == "assistant" else "User"
        conversation_str += f"{speaker}: {msg['content']}\n"
    
    prompt = (
        "You are assisting a therapy app named Donna AI. Based on the following conversation between the user and their therapist Donna, "
        "generate exactly 3 distinct, short, context-appropriate options for what the user could say or reply next.\n"
        "Each option must be written in the first person (from the user's perspective, e.g. 'I feel...', 'Can we...', 'Actually, ...').\n"
        "Keep each suggestion extremely concise and brief (maximum 8-10 words).\n"
        "Provide exactly 3 suggestions, one per line. Do NOT include numbers, bullet points, quotes, or any prefix/suffix. Just the raw suggestion text on each line."
    )
    
    try:
        res = safe_groq_completion(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Conversation history:\n{conversation_str}\n\nWhat are the next 3 reply options?"}
            ],
            default_model=GROQ_MODEL
        )
        reply = res.choices[0].message.content or ""
        # Parse output line by line
        lines = [line.strip().strip('"').strip("'") for line in reply.split("\n") if line.strip()]
        cleaned_suggestions = []
        for line in lines:
            import re
            cleaned = re.sub(r'^\d+[\.\)\-]\s*', '', line).strip()
            cleaned = cleaned.strip('"').strip("'")
            if cleaned:
                cleaned_suggestions.append(cleaned)
        
        if len(cleaned_suggestions) >= 2:
            return cleaned_suggestions[:4]
    except Exception as e:
        print(f"Suggestions Generation Error: {e}")
        
    return [
        "I'm feeling overwhelmed today.",
        "Help me challenge a negative thought.",
        "Can we do a quick breathing exercise?",
        "I need to vent about my day."
    ]

@app.get("/api/session/duration/{session_id}")
def get_duration(session_id: int, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    sess = db.query(UserSession).filter_by(id=session_id, user_uid=uid).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"duration_seconds": sess.duration_seconds or 0}

@app.post("/api/session/duration")
def update_duration(data: DurationUpdate, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    sess = db.query(UserSession).filter_by(id=data.session_id, user_uid=uid).first()
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    sess.duration_seconds = data.duration_seconds
    db.commit()
    return {"duration_seconds": sess.duration_seconds}

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
        "dob": user.dob if user else "Not Set",
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
            user = User(firebase_uid=uid, email=f_user.email)
            db.add(user)
        except:
            user = User(firebase_uid=uid, email="unknown@gmail.com")
            db.add(user)
    
    user.name = data.name
    user.dob = data.dob
    user.lat = data.lat
    user.lng = data.lng
    user.emergency_name = data.eName
    user.emergency_phone = data.ePhone
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
def get_mood_summary(period: str = "weekly", uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
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
        res = safe_groq_completion(
            messages=[
                {"role": "system", "content": "You are Donna, a wise, warm therapeutic advisor. Analyze the user's average mood scores and write a brief, supportive, conversational 2-sentence clinical insight."},
                {"role": "user", "content": f"Here are my averages over the past {period} period: Mood: {avg_mood:.1f}/10, Anxiety: {avg_anxiety:.1f}/10, Stress: {avg_stress:.1f}/10, Energy: {avg_energy:.1f}/10, Confidence: {avg_confidence:.1f}/10. What insight do you have?"}
            ],
            temperature=0.7,
            max_tokens=150
        )
        insights = res.choices[0].message.content.strip()
    except Exception as e:
        print(f"Failed to generate mood summary insights: {e}")
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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)