import os
import datetime
from typing import Optional
import uvicorn
import firebase_admin
from fastapi import FastAPI, Depends, Header, HTTPException, UploadFile, File, Form
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
from database import get_db, User, UserSession, Message

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

def get_system_prompt(user_name: str, mood: str, path: str, memory: str) -> str:
    system_prompt = (
        f"You are Donna AI, recognized as the best virtual clinical therapist in the world. You possess world-class clinical expertise and know how to treat any mental health condition, validate deep emotional struggles, and guide the user's mind in a positive direction. User: {user_name}.\n"
        f"Current Mood: {mood}.\n\n"
        f"{get_path_style_guidelines(path)}\n\n"
    )
    if memory:
        system_prompt += memory + "\n\n"
        
    system_prompt += (
        "Core Directives:\n"
        "1. Never break character. You must sound like a real, world-class clinical therapist, not a generic AI assistant. Avoid robotic summaries, list-like advice, or overly technical jargon.\n"
        "2. Response Length & Flow: Keep responses conversational, engaging, and moderate in length (typically 3 to 4 sentences, maximum 5). If guiding the user through a specific therapeutic exercise (like breathing or CBT cognitive reframing), you may use up to 5 sentences to ensure depth and clarity.\n"
        "3. Highly Context-Aware: Actively listen and respond directly to the details and emotions the user shares. Tailor your wisdom precisely to their situation, showing deep understanding and clinical insight.\n"
        "4. Mental Health Expertise: You know how to treat any condition given to you. Use your world-class understanding of human psychology to help the user reframe thoughts, heal emotional pain, and find healthy coping mechanisms.\n"
        "5. Crisis Intervention & Mind Guidance: If the user is feeling self-harm, suicidal ideation, abuse, violence, or any dangerous situation, prioritize safety immediately. Calmly and warmly take charge, validating their emotional pain without ever validating self-destructive actions. Use expert therapeutic redirection to guide their mind away from doing anything wrong that could harm them, outlining brief grounding actions and directing them to immediate support.\n"
        "6. Address their current feelings and condition using the therapeutic approach guidelines outlined above.\n"
        "7. Draw on current conversation history and past session patterns to support their growth.\n"
        "8. Pay close attention to any tone/emotion indicators in the user's speech (e.g. '[User speaks softly...]'). Acknowledge and reflect their vocal tone and emotional state to show deep empathy.\n"
        "9. Avoid repetitive openings, canned therapeutic responses (like 'I hear you' or 'It sounds like you're feeling...'), and generic phrases. Every response must directly engage with the specific detail, emotion, and context of the user's last message, ensuring high variety and personalized depth."
    )
    return system_prompt

@app.post("/api/session/start")
def start_sess(data: SessionStart, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
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
    
    # Save the user's initial description in the database as the first message if provided
    if data.description and data.description.strip():
        db.add(Message(session_id=new_sess.id, role="user", content=encrypt(data.description.strip())))
        db.commit()
        
    name = user.name if (user and user.name) else "Friend"
    
    # Compile past session memories and path style rules
    memory = compile_past_sessions_summary(uid, new_sess.id, db)
    system_prompt = get_system_prompt(name, data.mood, path_to_use, memory)
    
    messages = [{"role": "system", "content": system_prompt}]
    
    if data.description and data.description.strip():
        messages.append({"role": "user", "content": data.description.strip()})
    else:
        messages.append({"role": "user", "content": "Hello Donna."})
    
    try:
        res = client.chat.completions.create(
            model=GROQ_MODEL, 
            messages=messages,
            temperature=0.7
        )
        ai_msg = res.choices[0].message.content
        db.add(Message(session_id=new_sess.id, role="assistant", content=encrypt(ai_msg)))
        db.commit()
        return {"session_id": new_sess.id, "first_message": ai_msg}
    except Exception as e:
        print(f"Groq Error: {e}")
        return {"session_id": new_sess.id, "first_message": "I'm here for you. How can we start today?"}

@app.post("/api/chat")
def chat_node(data: ChatMsg, uid: str = Depends(get_current_uid), db: Session = Depends(get_db)):
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

    db.add(Message(session_id=data.session_id, role="user", content=encrypt(data.content)))
    db.commit()

    # Load up to the last 30 messages in the current session for deep conversation context memory
    raw_msgs = db.query(Message).filter_by(session_id=data.session_id).order_by(Message.timestamp.desc()).limit(30).all()
    context = [{"role": m.role, "content": decrypt(m.content)} for m in reversed(raw_msgs)]
    
    user = db.query(User).filter_by(firebase_uid=uid).first()
    name = user.name if (user and user.name) else "Friend"
    
    # Compile past session memories and path style rules
    memory = compile_past_sessions_summary(uid, data.session_id, db)
    system_prompt = get_system_prompt(name, sess.mood, sess.path, memory)

    try:
        res = client.chat.completions.create(
            model=GROQ_MODEL, 
            messages=[{"role": "system", "content": system_prompt}] + context,
            temperature=0.7
        )
        reply = res.choices[0].message.content
        db.add(Message(session_id=data.session_id, role="assistant", content=encrypt(reply)))
        db.commit()
        return {"reply": reply}
    except Exception as e:
        print(f"Chat Error: {e}")
        return {"reply": "I'm listening, but my connection is a bit slow. Please go on."}

@app.post("/api/chat/voice")
async def chat_voice(
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
    raw_msgs = db.query(Message).filter_by(session_id=session_id).order_by(Message.timestamp.desc()).limit(30).all()
    context = [{"role": m.role, "content": decrypt(m.content)} for m in reversed(raw_msgs)]
    
    user = db.query(User).filter_by(firebase_uid=uid).first()
    name = user.name if (user and user.name) else "Friend"
    memory = compile_past_sessions_summary(uid, session_id, db)
    system_prompt = get_system_prompt(name, sess.mood, sess.path, memory)

    try:
        res = client.chat.completions.create(
            model=GROQ_MODEL, 
            messages=[{"role": "system", "content": system_prompt}] + context,
            temperature=0.7
        )
        ai_reply = res.choices[0].message.content or ""
    except Exception as e:
        print(f"Voice chat Groq completion failed: {e}")
        ai_reply = "I'm listening, but my connection is a bit slow. Please go on."

    # 6. Save AI Message in database
    ai_msg = Message(session_id=session_id, role="assistant", content=encrypt(ai_reply))
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

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