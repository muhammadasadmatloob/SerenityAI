import os
import datetime
import json
import re
from typing import Optional
import uvicorn
import firebase_admin
from fastapi import FastAPI, Depends, Header, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
import edge_tts
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from cryptography.fernet import Fernet
from dotenv import load_dotenv
from firebase_admin import auth, credentials
from pydantic import BaseModel
from openai import OpenAI
from database import get_db, User, UserSession, Message, SessionSummary, MessageAnalysis

load_dotenv()

# --- CONFIG ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

if not ENCRYPTION_KEY:
    raise ValueError("ENCRYPTION_KEY missing in .env")

cipher = Fernet(ENCRYPTION_KEY.encode())

client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
GROQ_MODEL = "llama-3.3-70b-versatile" 

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

@app.get("/api/tts")
async def text_to_speech(text: str):
    try:
        # en-US-AvaNeural is a very realistic, soothing, warm female therapist voice
        communicate = edge_tts.Communicate(text, "en-US-AvaNeural")
        
        async def audio_generator():
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    yield chunk["data"]
                    
        return StreamingResponse(audio_generator(), media_type="audio/mpeg")
    except Exception as e:
        print(f"TTS Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
                "emotional_need": "Supportive listening"
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
                "risk_details": "Failed to parse LLM JSON analysis. Defaulted to Low."
            },
            "therapy_strategy": "Compassionate general counseling",
            "therapeutic_response": raw_response
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
            risk_level=risk.get("risk_level", "Low"),
            risk_details=risk.get("risk_details", "No detailed risk analysis parsed."),
            selected_strategy=strategy
        )
        db.add(analysis)
        db.commit()
    except Exception as e:
        print(f"Error saving message analysis: {e}")
        db.rollback()

def compile_past_sessions_summary_v2(uid: str, current_session_id: int, db: Session) -> str:
    # Query past session summaries for the user, excluding current session
    past_summaries = db.query(SessionSummary).filter(
        SessionSummary.user_uid == uid,
        SessionSummary.session_id != current_session_id
    ).order_by(SessionSummary.created_at.desc()).limit(3).all()
    
    if not past_summaries:
        # Fallback to the original simple compiler if no structured summaries exist yet
        return compile_past_sessions_summary(uid, current_session_id, db)
        
    compiled_memories = []
    for ps in past_summaries:
        try:
            decrypted_data = decrypt(ps.summary_data)
            summary_json = json.loads(decrypted_data)
            
            summary_text = (
                f"Session on {ps.created_at.strftime('%b %d, %Y')}:\n"
                f"- Main Issues: {summary_json.get('main_issues', 'None')}\n"
                f"- Triggers: {summary_json.get('triggers', 'None')}\n"
                f"- Emotional Patterns: {summary_json.get('emotional_patterns', 'None')}\n"
                f"- Goals: {summary_json.get('goals', 'None')}\n"
                f"- Progress: {summary_json.get('progress', 'None')}\n"
                f"- Coping Strategies: {summary_json.get('coping_strategies', 'None')}\n"
                f"- Important Relationships: {summary_json.get('important_relationships', 'None')}\n"
                f"- Recurring Themes: {summary_json.get('recurring_themes', 'None')}\n"
                f"- Risk Factors: {summary_json.get('risk_factors', 'None')}"
            )
            compiled_memories.append(summary_text)
        except Exception as e:
            print(f"Error parsing session summary: {e}")
            continue
            
    if not compiled_memories:
        return compile_past_sessions_summary(uid, current_session_id, db)
        
    return "SUMMARY OF CLIENT'S RECENT SESSIONS:\n\n" + "\n\n---\n\n".join(compiled_memories)

def get_system_prompt_v2(user_name: str, mood: str, user_path: str, memory_summary: str) -> str:
    prompt = (
        "You are Donna, a world-class virtual clinical therapist and mental wellness companion. "
        f"You are working with a client named {user_name}.\n"
        "Your purpose is to help the client explore their thoughts, emotions, behaviors, and life experiences "
        "in a safe, supportive, and thoughtful way.\n\n"
        
        "DISCLAIMER & SCOPE:\n"
        "- You do not claim to diagnose mental illnesses or be a licensed therapist.\n"
        "- Act as a therapeutic support companion.\n\n"
        
        "CLINICAL THEORIES & PRINCIPLES TO DRAW FROM:\n"
        "- Cognitive Behavioral Therapy (CBT): Identify cognitive distortions, challenge automatic thoughts, structure problem-solving.\n"
        "- Acceptance and Commitment Therapy (ACT): Cultivate mindfulness, acceptance of difficult emotions, commitment to core values, address avoidance.\n"
        "- Dialectical Behavior Therapy (DBT): Teach emotional regulation, distress tolerance, and interpersonal effectiveness.\n"
        "- Motivational Interviewing: Resolve ambivalence, explore motivation for change, support autonomy.\n"
        "- Person-Centered Therapy: Provide unconditional positive regard, active listening, and empathetic validation (especially for grief).\n"
        "- Trauma-Informed Care: Prioritize safety, choice, collaboration, trustworthiness, and never pressure disclosure.\n\n"
        
        "DONNA RESPONSE STYLE GUIDELINES:\n"
        "- Sound warm, calm, natural, and human. Avoid robotic language, bullet points, or list-like advice.\n"
        "- Avoid generic therapy clichés and repetitive openings. Do NOT repeatedly say: 'I hear you', 'It sounds like...', 'That must be hard', or 'It is completely valid to...'. Use natural variation.\n"
        "- Typically respond in 2 to 5 sentences. Focus on depth, quality, and direct emotional engagement rather than length.\n"
        "- Do not rush into solutions. Most responses should follow the structure: One emotional reflection, one helpful insight, and one thoughtful, open-ended question.\n\n"
    )
    
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
        "    \"emotional_need\": \"[Describe the primary emotional need in 2-5 words]\"\n"
        "  },\n"
        "  \"risk_analysis\": {\n"
        "    \"self_harm\": [true/false],\n"
        "    \"suicide_risk\": [true/false],\n"
        "    \"violence\": [true/false],\n"
        "    \"abuse\": [true/false],\n"
        "    \"domestic_violence\": [true/false],\n"
        "    \"crisis\": [true/false],\n"
        "    \"psychosis\": [true/false],\n"
        "    \"risk_level\": \"[Low, Medium, High, Critical]\",\n"
        "    \"risk_details\": \"[Brief explanation of risk assessment]\"\n"
        "  },\n"
        "  \"therapy_strategy\": \"[CBT, DBT, ACT, Person-Centered, Trauma-Informed, Motivational Interviewing, or Crisis-Support]\",\n"
        "  \"therapeutic_response\": \"[Your direct response to the user. Follow all response style guidelines. If risk is High or Critical, you MUST switch to a calm crisis-support mode: prioritize safety, provide brief grounding, and direct the user to trusted support/emergency resources.]\"\n"
        "}\n\n"
        "Ensure your JSON is valid and conforms strictly to this structure. Do not output any thinking or markdown block prefixes, only raw JSON."
    )
    return prompt

def get_summary_generation_prompt(conversation_history: str, past_summary: str = "") -> str:
    prompt = (
        "You are an expert clinical psychologist and data annotator. Your task is to analyze the conversation history between a client and their therapeutic AI companion Donna, and compile a structured, clinically insightful summary.\n\n"
        "We track the client's progress using these specific fields:\n"
        "- Main Issues: Key struggles or problems discussed.\n"
        "- Triggers: Situations, thoughts, or events that prompt negative emotional states.\n"
        "- Emotional Patterns: Recurring emotional states (e.g., anxiety spikes, guilt, sadness).\n"
        "- Important Relationships: Key people mentioned (partners, parents, coworkers) and the dynamics.\n"
        "- Goals: Aspirations or intentions the user has voiced (even minor ones).\n"
        "- Progress: Any positive changes, insight, or coping mechanisms the client successfully used.\n"
        "- Coping Strategies: Methods, grounding techniques, or strategies that help the client.\n"
        "- Recurring Themes: Repeated motifs or life themes.\n"
        "- Risk Factors: Safety issues, risk indicators, or historical risk factors.\n\n"
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
        "Provide your analysis in JSON format with these exact keys:\n"
        "{\n"
        "  \"main_issues\": \"[List or summary]\",\n"
        "  \"triggers\": \"[List or summary]\",\n"
        "  \"emotional_patterns\": \"[List or summary]\",\n"
        "  \"important_relationships\": \"[List or summary]\",\n"
        "  \"goals\": \"[List or summary]\",\n"
        "  \"progress\": \"[List or summary]\",\n"
        "  \"coping_strategies\": \"[List or summary]\",\n"
        "  \"recurring_themes\": \"[List or summary]\",\n"
        "  \"risk_factors\": \"[List or summary]\"\n"
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
        res = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
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
        
    name = user.name if (user and user.name) else "Friend"
    
    # Compile past session memories and path style rules using structured summaries
    memory = compile_past_sessions_summary_v2(uid, new_sess.id, db)
    system_prompt = get_system_prompt_v2(name, data.mood, path_to_use, memory)
    
    messages = [{"role": "system", "content": system_prompt}]
    
    if data.description and data.description.strip():
        messages.append({"role": "user", "content": data.description.strip()})
    else:
        messages.append({"role": "user", "content": "Hello Donna."})
    
    try:
        res = client.chat.completions.create(
            model=GROQ_MODEL, 
            messages=messages,
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        raw_reply = res.choices[0].message.content or ""
        parsed_data = parse_llm_response(raw_reply)
        ai_msg_text = parsed_data.get("therapeutic_response", "I'm here for you. How can we start today?")
        
        # Save AI reply
        ai_msg = Message(session_id=new_sess.id, role="assistant", content=encrypt(ai_msg_text))
        db.add(ai_msg)
        db.commit()
        
        # Save MessageAnalysis if user message was logged
        if user_msg_id is not None:
            save_message_analysis(db, user_msg_id, parsed_data)
            # Enqueue background task to update the session summary
            background_tasks.add_task(update_session_summary_task, new_sess.id, uid)
            
        return {"session_id": new_sess.id, "first_message": ai_msg_text}
    except Exception as e:
        print(f"Groq Error: {e}")
        # Save fallback AI reply
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

    user_msg = Message(session_id=data.session_id, role="user", content=encrypt(data.content))
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Load up to the last 60 messages in the current session for deep conversation context memory
    raw_msgs = db.query(Message).filter_by(session_id=data.session_id).order_by(Message.timestamp.desc()).limit(60).all()
    context = [{"role": m.role, "content": decrypt(m.content)} for m in reversed(raw_msgs)]
    
    user = db.query(User).filter_by(firebase_uid=uid).first()
    name = user.name if (user and user.name) else "Friend"
    
    # Compile past session memories and path style rules using structured summaries
    memory = compile_past_sessions_summary_v2(uid, data.session_id, db)
    system_prompt = get_system_prompt_v2(name, sess.mood, sess.path, memory)

    try:
        res = client.chat.completions.create(
            model=GROQ_MODEL, 
            messages=[{"role": "system", "content": system_prompt}] + context,
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        raw_reply = res.choices[0].message.content or ""
        parsed_data = parse_llm_response(raw_reply)
        ai_msg_text = parsed_data.get("therapeutic_response", "I'm listening, but my connection is a bit slow. Please go on.")
        
        # Save assistant message
        db.add(Message(session_id=data.session_id, role="assistant", content=encrypt(ai_msg_text)))
        db.commit()
        
        # Save MessageAnalysis for the user message
        save_message_analysis(db, user_msg.id, parsed_data)
        
        # Enqueue background task to update the session summary
        background_tasks.add_task(update_session_summary_task, data.session_id, uid)
        
        return {"reply": ai_msg_text}
    except Exception as e:
        print(f"Chat Error: {e}")
        fallback_reply = "I'm listening, but my connection is a bit slow. Please go on."
        db.add(Message(session_id=data.session_id, role="assistant", content=encrypt(fallback_reply)))
        db.commit()
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

    # 5. Fetch chat history and generate AI reply (same prompt logic as chat_node!)
    raw_msgs = db.query(Message).filter_by(session_id=session_id).order_by(Message.timestamp.desc()).limit(60).all()
    context = [{"role": m.role, "content": decrypt(m.content)} for m in reversed(raw_msgs)]
    
    user = db.query(User).filter_by(firebase_uid=uid).first()
    name = user.name if (user and user.name) else "Friend"
    memory = compile_past_sessions_summary_v2(uid, session_id, db)
    system_prompt = get_system_prompt_v2(name, sess.mood, sess.path, memory)

    try:
        res = client.chat.completions.create(
            model=GROQ_MODEL, 
            messages=[{"role": "system", "content": system_prompt}] + context,
            temperature=0.7,
            response_format={"type": "json_object"}
        )
        raw_reply = res.choices[0].message.content or ""
        parsed_data = parse_llm_response(raw_reply)
        ai_reply = parsed_data.get("therapeutic_response", "I'm listening, but my connection is a bit slow. Please go on.")
    except Exception as e:
        print(f"Voice chat Groq completion failed: {e}")
        parsed_data = {}
        ai_reply = "I'm listening, but my connection is a bit slow. Please go on."

    # 6. Save AI Message in database
    ai_msg = Message(session_id=session_id, role="assistant", content=encrypt(ai_reply))
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

    # Save MessageAnalysis for the user message if Groq succeeded
    if parsed_data:
        save_message_analysis(db, user_msg.id, parsed_data)
        # Enqueue background task to update the session summary
        background_tasks.add_task(update_session_summary_task, session_id, uid)

    # 7. Generate TTS audio for the AI reply using edge-tts and save persistently
    ai_audio_filename = f"ai_{ai_msg.id}.mp3"
    ai_audio_path = os.path.join("static", "audio", ai_audio_filename)
    try:
        communicate = edge_tts.Communicate(ai_reply, "en-US-AvaNeural")
        await communicate.save(ai_audio_path)
        ai_msg.audio_url = f"/static/audio/{ai_audio_filename}"
        db.commit()
    except Exception as e:
        print(f"Voice chat TTS synthesis failed: {e}")

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
        res = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": f"Conversation history:\n{conversation_str}\n\nWhat are the next 3 reply options?"}
            ]
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
    # Delete all messages in the session
    db.query(Message).filter_by(session_id=session_id).delete()
    # Delete the session
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

@app.put("/api/profile/update")
def update_profile(data: ProfileUpdate, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(firebase_uid=uid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")
    
    user.name = data.name
    user.emergency_name = data.emergency_name
    user.emergency_phone = data.emergency_phone
    db.commit()
    return {"status": "updated"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)