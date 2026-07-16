import os
import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, validates

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("No DATABASE_URL found in .env file")

if "sslmode=" not in DATABASE_URL:
    DATABASE_URL += "?sslmode=require"

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Run automatic migration check for new is_ended column
from sqlalchemy import inspect
try:
    inspector = inspect(engine)
    if 'users' in inspector.get_table_names():
        user_columns = [c['name'] for c in inspector.get_columns('users')]
        if 'emergency_email' not in user_columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN emergency_email VARCHAR"))
                conn.commit()
    if 'sessions' in inspector.get_table_names():
        columns = [c['name'] for c in inspector.get_columns('sessions')]
        if 'is_ended' not in columns:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE sessions ADD COLUMN is_ended BOOLEAN DEFAULT FALSE"))
                conn.commit()
except Exception as e:
    print(f"Automatic migration notice: {e}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    firebase_uid = Column(String, unique=True, index=True)
    email = Column(String, unique=True)
    name = Column(String)
    dob = Column(DateTime, nullable=True)
    gender = Column(String, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    emergency_name = Column(String, nullable=True)
    emergency_phone = Column(String, nullable=True)
    emergency_email = Column(String, nullable=True)
    path = Column(String, nullable=True)

class UserSession(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_uid = Column(String, ForeignKey("users.firebase_uid"))
    mood = Column(String)
    path = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    duration_seconds = Column(Integer, default=0)
    current_phase = Column(String, default="rapport_building")
    is_ended = Column(Boolean, default=False)

    @validates('mood')
    def validate_mood(self, key, value):
        if self.mood is not None:
            return self.mood
        return value

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    role = Column(String) 
    content = Column(Text) 
    audio_url = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

class SessionSummary(Base):
    __tablename__ = "session_summaries"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), unique=True)
    user_uid = Column(String, ForeignKey("users.firebase_uid"))
    summary_data = Column(Text)  # Encrypted JSON containing main_issues, triggers, emotional_patterns, etc.
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class MessageAnalysis(Base):
    __tablename__ = "message_analyses"
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), unique=True)
    primary_emotion = Column(String)
    secondary_emotion = Column(String)
    emotion_intensity = Column(Integer)
    stress_level = Column(String)
    emotional_need = Column(String)
    conversation_need = Column(String, nullable=True) # New column
    risk_level = Column(String)
    risk_details = Column(String, nullable=True)
    urgency_score = Column(Integer, default=1) # New column
    selected_strategy = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TherapeuticIntervention(Base):
    __tablename__ = "therapeutic_interventions"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    user_uid = Column(String, ForeignKey("users.firebase_uid"))
    intervention_type = Column(String)
    status = Column(String) # initiated, in_progress, completed
    data = Column(Text, nullable=True) # Encrypted JSON
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class UserGoal(Base):
    __tablename__ = "user_goals"
    id = Column(Integer, primary_key=True, index=True)
    user_uid = Column(String, ForeignKey("users.firebase_uid"))
    goal = Column(Text)
    category = Column(String)
    progress = Column(Integer, default=0)
    status = Column(String, default="active") # active, completed, discarded
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class SessionReflection(Base):
    __tablename__ = "session_reflections"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), unique=True)
    user_uid = Column(String, ForeignKey("users.firebase_uid"))
    breakthroughs = Column(Text, nullable=True)
    homework = Column(Text, nullable=True)
    homework_status = Column(String, default="pending") # pending, completed, skipped
    next_session_focus = Column(Text, nullable=True)
    confidence_level = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class MoodEntry(Base):
    __tablename__ = "mood_entries"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    user_uid = Column(String, ForeignKey("users.firebase_uid"))
    mood_score = Column(Integer)
    anxiety_score = Column(Integer)
    stress_score = Column(Integer)
    energy_score = Column(Integer)
    confidence_score = Column(Integer)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PersonalityProfile(Base):
    __tablename__ = "personality_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_uid = Column(String, ForeignKey("users.firebase_uid"), unique=True)
    analytical = Column(Float, default=0.5)
    emotional = Column(Float, default=0.5)
    action_oriented = Column(Float, default=0.5)
    reflective = Column(Float, default=0.5)
    avoidant = Column(Float, default=0.5)
    social = Column(Float, default=0.5)
    introverted = Column(Float, default=0.5)
    extroverted = Column(Float, default=0.5)
    confidence_data = Column(Text, nullable=True) # JSON serialized confidence levels
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class CrisisEvent(Base):
    __tablename__ = "crisis_events"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    user_uid = Column(String, ForeignKey("users.firebase_uid"))
    trigger_message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    urgency_score = Column(Integer)
    crisis_details = Column(Text, nullable=True)
    action_taken = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TreatmentPlan(Base):
    __tablename__ = "treatment_plans"
    id = Column(Integer, primary_key=True, index=True)
    user_uid = Column(String, ForeignKey("users.firebase_uid"))
    focus_area = Column(String)
    milestones = Column(Text, nullable=True) # JSON serialized list of milestones
    progress = Column(Integer, default=0)
    completion_status = Column(String, default="active") # active, completed, paused
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class SemanticMemory(Base):
    __tablename__ = "semantic_memories_db"
    id = Column(String, primary_key=True, index=True)
    user_uid = Column(String, ForeignKey("users.firebase_uid"))
    content = Column(Text)
    memory_type = Column(String)
    session_id = Column(Integer, nullable=True)
    importance = Column(Integer, default=5)
    vector_data = Column(Text)  # Serialized JSON list of floats
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class ContinuousLearningData(Base):
    __tablename__ = "continuous_learning_data"
    id = Column(Integer, primary_key=True, index=True)
    user_input = Column(Text)
    context_path = Column(String)
    generated_strategy = Column(Text)
    is_processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(bind=engine)

# Fail-safe DB migrations for existing databases
from sqlalchemy import text
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE sessions ADD COLUMN duration_seconds INTEGER DEFAULT 0"))
        conn.commit()
except Exception:
    pass

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE sessions ADD COLUMN current_phase VARCHAR DEFAULT 'rapport_building'"))
        conn.commit()
except Exception:
    pass

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN path VARCHAR"))
        conn.commit()
except Exception:
    pass

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN gender VARCHAR"))
        conn.commit()
except Exception:
    pass

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE messages ADD COLUMN audio_url VARCHAR"))
        conn.commit()
except Exception:
    pass

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE message_analyses ADD COLUMN conversation_need VARCHAR"))
        conn.commit()
except Exception:
    pass

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE message_analyses ADD COLUMN urgency_score INTEGER DEFAULT 1"))
        conn.commit()
except Exception:
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()