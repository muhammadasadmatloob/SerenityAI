# SERENITY AI (DONNA AI)
## Final Year Project Standee Content & Design Guide

This document contains the exact textual content and diagram descriptions for the Serenity AI (Donna AI) Final Year Project roll-up standee banner, matching the layout structure and color theme of the Department of Computer Science.

---

### 1. TOP HEADER (Blue Backdrop)
* **Left Side:** [DHA Suffa University Logo / Seal]
* **Center Text:**
  * **DEPARTMENT OF COMPUTER SCIENCE**
  * **FYP FINAL YEAR PROJECT**
* **Right Side:** [Serenity AI Minimalist Brain-AI Logo]

---

### 2. MAIN TITLE (Bold Sans-Serif, Dark Blue)
* **Title:** **SERENITY AI: AN AI-POWERED MENTAL HEALTH COMPANION**
* **Subtitle:** *(Using Real-Time Emotion Analysis & Adaptive Voice Synthesis)*

---

### 3. PROJECT OBJECTIVE (Bullet Points, High-Contrast Black/Slate)
* **Objective Title:** 📌 **PROJECT OBJECTIVE**
* **Bullet Points:**
  * **24/7 Empathetic Chat Companion ("Donna"):** Integrates cognitive behavioral therapy (CBT) and clinical psychology prompt architectures for student support.
  * **Real-Time Voice Call Interface:** WhatsApp-style overlay using Groq Whisper-Large-V3 for transcription and Edge-TTS for voice generation.
  * **Adaptive Tone Adaptation:** Mathematically adjusts voice pitch and speaking rate based on user stress and anxiety levels.
  * **RunPod GPU Serverless Engine:** Powers fast, low-latency execution of the deep learning model pipeline, reducing cold start delays.
  * **Symmetric Database Encryption:** Enforces AES-128 (Fernet) encryption for sensitive conversations and session data logs.

---

### 4. TECHNICAL INFRASTRUCTURE ILLUSTRATION
* **Visual Components:**
  * **React Native / Expo Client:** Touch interface, audio recording, and Moti micro-animations.
  * **FastAPI Backend Gateway:** Verifies Firebase JWTs and manages real-time AI API orchestrations.
  * **RunPod Serverless GPU Container:** Hosts the deep learning model instances for zero-latency execution.
  * **AI Services Layer:** Whisper V3 (speech-to-text), Google Gemini (empathy engine), and Edge-TTS (voice synthesis).
  * **PostgreSQL Relational DB:** ACID-compliant, encrypted message storage, and clinical report metrics.

---

### 5. SYSTEM ARCHITECTURE & WORKFLOW DIAGRAMS (Side-by-Side)

#### A. System Architecture Diagram
```
  +--------------+        HTTPS / REST       +-----------------+
  | User Mobile  | <───────────────────────> | FastAPI Backend |
  | React Native |       Firebase JWT        | Server (Python) |
  +--------------+                           +--------+--------+
                                                      │
                       +──────────────────────────────+──────────────────────────────+
                       │                              │                              │
                       v                              v                              v
             +------------------+           +------------------+           +------------------+
             | PostgreSQL DB    |           | RunPod GPU Cloud |           | External APIs    |
             | - User Sessions  |           | - Model Inference|           | - Groq Whisper   |
             | - Encrypted Chat |           | - Warmup Handler |           | - Gemini Flash   |
             | - Vitals & Mood  |           +------------------+           | - Microsoft TTS  |
             +------------------+                                          +------------------+
```

#### B. System Workflow Diagram
1. **Mood Entry:** User registers mood (visual emoji check-in / text / voice description).
2. **Path Selection:** User selects therapeutic style (Logical CBT, Emotional, Spiritual, Casual).
3. **Session Start / RunPod Warmup:** Backend starts session, triggers RunPod serverless warmup to reduce latency, and queries the LLM.
4. **Conversation Loop:**
   - User speaks $\rightarrow$ Groq transcribes $\rightarrow$ RunPod/Gemini processes primary emotion/intensity.
   - Edge-TTS synthesizes voice matching emotion.
   - Message is Fernet-encrypted and saved to database.
5. **Closure:** User generates clinical PDF report of progress.

---

### 6. FOOTER (Blue Backdrop)
* **Left Column:**
  * **Supervisor:**
  * **SIR WAQAS AHMED SIDDIQUE**
  * *Department of Computer Science*
* **Right Column:**
  * **Group Members:**
  * 1. **Raza Ali** (cs221136)
  * 2. **Muhammad Hassan Khan** (cs221145)
  * 3. **Muhammad Asad Matloob** (cs221127)
  * 4. **Iliyan Rahim** (cs221131)
