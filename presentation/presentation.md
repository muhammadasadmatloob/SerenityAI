---
marp: true
theme: default
class: lead
paginate: true
backgroundColor: #f8fafc
---

# SerenityAI
### An Empathetic Mental Wellness & Therapeutic Support System

**Final Year Project Presentation**

---

## 1. Introduction & Problem Statement

**The Problem:**
* Global rise in anxiety, depression, and stress.
* Access to professional therapy is often expensive, delayed, or stigmatized.
* Traditional mental health apps lack dynamic conversational empathy and feel robotic.

**Our Solution: SerenityAI**
A 24/7 empathetic AI companion ("Donna") trained in clinical psychology principles (CBT, DBT). It acts as a safe space for users to track emotions, vent, and receive therapeutic dialogue without judgment.

---

## 2. Technology Stack & Languages

### Why this stack?
We chose a modern, scalable, and highly performant stack to ensure seamless user experience and real-time AI interactions.

**Languages:** 
* **TypeScript / JavaScript** (Frontend)
* **Python 3.10+** (Backend)

**Frontend (Mobile App):**
* **React Native & Expo:** Allows cross-platform deployment (iOS & Android) from a single codebase.
* **NativeWind (Tailwind CSS):** For rapid, highly responsive, and beautiful UI styling.
* **Moti / Reanimated:** Powers the smooth, liquid micro-animations that make the app feel "alive."
* **Expo AV & Location:** Handles background audio recording/playback and real-time location mapping.

---

## 3. Technology Stack: Backend & Database

**Backend Server:**
* **FastAPI (Python):** Chosen for its extreme speed, asynchronous capabilities, and excellent integration with AI/ML libraries.

**Database & Security:**
* **Firebase Authentication:** Handles secure user sign-ups, logins, and token management.
* **PostgreSQL (via SQLAlchemy):** A robust relational database to store sessions, messages, and emotional analytics.
* **Cryptography (Fernet):** All chat logs and personal thoughts are AES-encrypted at rest.

---

## 4. AI Models, APIs & Logic

We use a sophisticated multi-model architecture to balance speed, cost, and psychological depth.

* **Groq API (Whisper-Large-V3):** Transcribes user voice messages instantly. Groq's LPU architecture provides near-zero latency, crucial for "real phone call" experiences.
* **Google Generative AI (Gemini 3.1 Flash-Lite):** The core "Brain" of Donna. Chosen for its massive context window and reasoning capabilities. It maintains conversational memory and applies clinical psychology frameworks.
* **Microsoft Edge-TTS:** Synthesizes the AI's empathetic voice responses dynamically, adjusting pitch and speed based on the detected emotion.

---

## 5. Emotion Detection: Voice & Text

How does the app actually *know* how the user is feeling?

**1. Text-Based Semantic Analysis:**
When a user types or speaks, the LLM analyzes semantic markers.
* *Example:* Short, clipped sentences ("I'm fine.", "Whatever.") are flagged as withdrawal or frustration.
* The system evaluates a 1-10 intensity scale for primary emotions (Anxiety, Sadness, Anger, Joy).

**2. Voice & Tone Adaptation:**
* When the user speaks, their emotional state is passed to the TTS Engine.
* If **Anxiety** is detected (Intensity 8/10), the AI voice slows down by 10% and lowers pitch to sound grounding and soothing.
* If **Sadness** is detected, the AI uses a softer, empathetic tone.

---

## 6. App Workflow & User Experience

1. **Onboarding & Auth:** Secure login via Firebase. Users consent to privacy terms.
2. **Profile & Context:** App gathers name, gender, and live location (for emergency grounding exercises).
3. **The 'Feel' Check-in:** Users rate their day. This sets the initial emotional context for the session.
4. **Therapeutic Dialogue:** 
   * Users can type or use the **Call Mode** (Voice-to-Voice).
   * AI remembers previous sessions (Long-term Memory) and references past struggles organically.
   * AI limits probing questions to avoid overwhelming the user.
5. **Analytics & Reports:** Users can generate PDF reports of their emotional progress over time.

---

## 7. Data Management & Security Workflow

Mental health data is highly sensitive. Security was a primary architectural driver.

* **No Plain-Text Chats:** Before saving to PostgreSQL, every message is encrypted using symmetric AES encryption (`cryptography.fernet`).
* **Stateless AI:** When passing data to the LLM (Gemini/Groq), we strip PII (Personally Identifiable Information) where possible.
* **Secure Tokens:** Frontend communicates with the Backend via JWT tokens verified against Firebase Admin SDK.
* **Session Cleanup:** When the app is closed, a lifecycle event (`end-all-active`) automatically terminates active database sessions to prevent data leakage.

---

## 8. Potential FYP Defense Questions & Answers

**Q: Why didn't you build the LLM from scratch?**
*A:* Training a foundational model requires millions of dollars in compute. Our innovation is in the *orchestration, prompting architecture, and emotional TTS adaptation*, not the base neural network.

**Q: How do you handle a user in a severe crisis (e.g., self-harm)?**
*A:* The system prompt includes strict guardrails. If crisis keywords are detected, the AI safely pivots, provides emergency hotline numbers, and refuses to act as a medical professional.

**Q: Is the voice call actually real-time?**
*A:* It is a highly optimized pipeline: Expo Audio -> FastAPI -> Groq Whisper (transcription) -> Gemini (response) -> Edge-TTS (audio). Because Groq and Edge-TTS are incredibly fast, the latency mimics a real conversation.

---

## 9. Conclusion

SerenityAI proves that AI can go beyond robotic chatbots. By combining ultra-fast transcription, contextual LLM memory, dynamic emotional voice synthesis, and strict cryptographic security, we have built a companion that genuinely feels empathetic.

**Thank You.**
*Any Questions?*
