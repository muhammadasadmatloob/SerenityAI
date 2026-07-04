# SerenityAI - Mental Wellness & Therapeutic Support

## 1. Introduction & Overview
SerenityAI is a comprehensive mental wellness and therapeutic support application. It provides users with a 24/7 empathetic AI companion ("Donna") trained in clinical psychology. The app aims to provide a safe space for users to track their emotional state, engage in therapeutic dialogue, and build mental resilience.

## 2. Technology Stack
*   **Frontend**: React Native & Expo (Mobile application for iOS & Android)
*   **Backend**: FastAPI (Python-based high-performance scalable server)
*   **Database**: 
    *   Firebase (Authentication & User Document storage)
    *   PostgreSQL / Supabase (Relational data & Session logs)
*   **AI & NLP**: 
    *   Groq & RunPod for fast, private LLM inference
    *   Custom tuned system prompts for Cognitive Behavioral Therapy (CBT), DBT, and ACT
    *   Whisper model for high-accuracy Voice Recognition

## 3. App Flow & User Experience
1.  **Onboarding**: Secure authentication via Firebase and privacy agreements.
2.  **Profile Creation**: Gathering initial mental health context (demographics, goals, triggers).
3.  **The 'Feel' Screen**: A daily check-in interface where users speak or type their current emotional state.
4.  **Therapeutic Chat (Donna)**: A highly contextual chat interface supporting text and voice messages, acting as the core of the therapeutic experience.
5.  **Profile & Analytics**: A hub for tracking mental wellness over time, viewing session durations, and revisiting privacy policies.

## 4. Emotion Detection (Text & Voice)
*   **Text Analysis**: The AI backend processes the semantic meaning, sentence length, and word choice to detect subtle emotions. For example, it detects clipped replies as exhaustion, and deflection as protected pain.
*   **Voice Analysis**: 
    *   Raw audio is recorded strictly at 16kHz for maximum fidelity and accurate Whisper transcription.
    *   The backend processes the audio through FFmpeg.
    *   It extracts RMS energy (volume), speech rate, and pauses (silent frames).
    *   A specialized algorithmic analyzer detects emotions like anxiety, sadness, anger, or fear based on pitch variations, speech speed, and breathing pauses.

## 5. How the App Responds
*   **Intelligent Contextual AI**: Donna uses a centralized `AIRouter` with automatic failovers between heavy and light models depending on the complexity of the therapeutic task.
*   **Therapist Persona**: Donna doesn't act like a robotic chatbot. She uses the user's name organically, sits quietly with their pain, validates their feelings, and limits probing questions (less than 20% of the time).
*   **Contextual Auto-Suggestions**: The app dynamically generates exactly 3 highly contextual, 1st-person reply suggestions (e.g., "I feel overwhelmed") tailored specifically to the user's immediate emotional state, avoiding toxic positivity.

## 6. Key Features
*   **Real-time Voice & Text Chat**: Seamless toggling between voice recordings and typing.
*   **Deep Memory**: The AI stores semantic memory, remembering past sessions and acknowledging previous threads naturally at the start of new sessions.
*   **Offline / Network Resilience**: Advanced navigation guards and offline states ensure the app does not crash or misroute users without internet.
*   **Privacy First**: SecureStore encryption and minimal data retention strictly protect user privacy.
