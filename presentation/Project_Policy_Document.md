# SERENITY AI (DONNA AI)
## Project Policy Document
**BS Computer Science — Final Year Project (FYP) Report Section**

---

## 1. Introduction

### 1.1 Purpose of the Policy Document
This document establishes the official regulatory, operational, ethical, and technical policies governing the development, deployment, and usage of the Final Year Project **Serenity AI** (also referred to as **Donna AI**). As a university-level BS Computer Science project, it is essential to establish formal compliance policies that address security, data integrity, AI safety, and clinical ethics. This document provides a framework to ensure that the application operates securely and responsibly.

### 1.2 Scope
This policy document applies to:
1. **The Software Product:** The mobile client built with React Native and the backend services powered by FastAPI, PostgreSQL, and Firebase.
2. **The Development Team:** All student developers, project supervisors, and future maintainers.
3. **The User Base:** Students, young adults, administrators, and testing agents interacting with the application.
4. **Third-Party Integrations:** Cloud databases (Firebase Auth/Firestore), APIs (Google Gemini, Groq Whisper, Microsoft Edge-TTS), and location providers.

### 1.3 Intended Audience
This document is prepared for:
* **Academic Examiners & Evaluators:** To verify the system's compliance with engineering, security, and ethical standards.
* **Project Supervisor:** To assess the architectural and operational governance of the project.
* **Development Team:** To guide current implementation decisions and code consistency.
* **Future Maintainers:** To support codebase transfers, API updates, and scaling efforts.

### 1.4 Objectives
* **Maintain Code Quality & Consistency:** Standardize repository practices, directory structures, and code styles.
* **Protect Sensitive User Data:** Implement strict data protection, access controls, and encryption standards.
* **Ensure AI Safety:** Mitigate risks related to AI hallucinations, enforce clinical boundaries, and establish crisis protocols.
* **Mitigate Technical Risks:** Outline testing, deployment, backup, and error recovery plans.

---

## 2. Project Overview

### 2.1 Project Name and Brand Identity
The project is registered under the academic title **Serenity AI**, with the AI persona named **Donna AI** (Donna).

### 2.2 System Purpose and Objectives
Serenity AI is an AI-powered conversational agent designed to support young adults and university students dealing with stress, anxiety, academic pressure, and loneliness. It acts as an empathetic digital companion, using evidence-based cognitive behavioral therapy (CBT) techniques to help users manage their mental well-being.

### 2.3 Target Users
* **Primary Target:** BS/MS university students experiencing academic stress and imposter syndrome.
* **Secondary Target:** Young adults and software professionals experiencing workplace burnout or isolation.
* **Secondary Audience:** Clinical supervisors or university counselors analyzing anonymized emotional reports.

### 2.4 Technology Stack
The application architecture is divided into two primary subsystems:

```
                  +-----------------------------------------+
                  |           REACT NATIVE CLIENT           |
                  |  - Expo Framework                       |
                  |  - NativeWind (Tailwind CSS Styling)    |
                  |  - Moti & Reanimated (Micro-animations) |
                  |  - Expo-AV (Audio Recording/Playback)   |
                  +--------------------+--------------------+
                                       |
                       HTTPS Requests  |  Firebase JWT Auth
                                       v
                  +--------------------+--------------------+
                  |           FASTAPI BACKEND               |
                  |  - Python 3.10+                         |
                  |  - SQLAlchemy ORM                       |
                  |  - Firebase Admin SDK                   |
                  |  - Cryptography.fernet AES Encryption   |
                  +---------+--------------------+----------+
                            |                    |
             Read/Write SQL |                    | API Integrations
                            v                    v
         +------------------+---+    +-----------+-----------+
         |  POSTGRESQL DATABASE |    |   EXTERNAL SERVICES   |
         |  - Relational Schema |    |  - Groq Whisper V3    |
         |  - Secure Storage    |    |  - Gemini 3.1 Flash   |
         |  - Encrypted Messages|    |  - Edge-TTS engine    |
         +----------------------+    +-----------------------+
```

### 2.5 System Architecture Summary
* **Mobile Client:** Built using Expo (React Native), supporting cross-platform deployment. Uses NativeWind for utility-first styling and Moti/Reanimated for smooth UI transitions.
* **FastAPI Backend Server:** An asynchronous API gateway that handles authentication checks, manages user profiles, processes transcriptions, manages databases, and coordinates AI services.
* **Database Layer:** Uses Firebase Firestore for real-time onboarding states, and PostgreSQL (managed via SQLAlchemy ORM) to store encrypted conversation histories, user statistics, and session details.
* **External AI Models:** Integrates Whisper-Large-V3 (via Groq) for near-instant transcription, Gemini 3.1 Flash-Lite for conversational reasoning, and Edge-TTS for voice synthesis.

---

## 3. Project Governance Policy

### 3.1 Development Methodology
The project follows an **Agile-Scrum** development lifecycle. Development is divided into two-week sprints. Each sprint focus is defined by the project supervisor's backlog milestones:
* *Sprint 1-2:* Requirements engineering, data schemas, and API architecture.
* *Sprint 3-4:* Onboarding implementation, Firebase Auth, and Leaflet location integration.
* *Sprint 5-6:* Voice processing pipeline, Whisper transcription, and Gemini prompts.
* *Sprint 7-8:* Security implementation (Fernet encryption, JWT validation), PDF reports, and bug fixing.

### 3.2 Decision-Making Process
* **Architectural Decisions:** Technical decisions (such as choosing FastAPI over Node.js, or PostgreSQL over MongoDB) are documented as Architectural Decision Records (ADRs) and must be approved by the project supervisor.
* **API Schema Changes:** Modifications to the database schema or endpoint patterns must be reviewed by the backend team to avoid breaking changes in the mobile client.

### 3.3 Documentation Standards
All project components must maintain clear documentation:
* **Source Code:** Standard Python docstrings (PEP 257) and TypeScript comments are required for complex functions.
* **API Documentation:** The FastAPI backend must expose interactive OpenAPI documentation at `/docs` or `/redoc`.
* **Deployment Guide:** A comprehensive system configuration manual must be maintained in the root `README.md`.

### 3.4 Project Ownership
The source code, database structures, trained prompts, and design assets are the intellectual property of the developers and the university. Redistribution, licensing, or commercial deployment requires written permission from both the development team and the university.

---

## 4. Development Policy

### 4.1 Coding Standards
Developers must follow official language standards:
* **Frontend (TypeScript):** Follow the Airbnb JavaScript Style Guide. Code formatting is managed via ESLint and Prettier.
* **Backend (Python):** Enforce compliance with PEP 8 standards. Code must be checked using formatting tools (like Black or Flake8).

### 4.2 Naming Conventions
* **Directories & Files:** Use camelCase or kebab-case for React Native screens (`ProfileInfo.tsx`, `EmailVerify.tsx`). Use lowercase snake_case for Python modules (`database.py`, `semantic_memory.py`).
* **Variables & Functions:** TypeScript uses camelCase (`isProfileComplete`, `handleGetLocation`). Python uses snake_case (`get_current_uid`, `generate_clinical_report`).
* **Database Elements:** PostgreSQL tables and columns use snake_case (`user_session`, `session_id`, `created_at`).

### 4.3 Folder Structure
The workspace enforces a clear separation of concerns, dividing the frontend and backend into independent directories:

```
SerenityAI (Workspace Root)
├── Frontend (Expo App)
│   ├── app
│   │   ├── (auth)              # Authentication screen routes
│   │   ├── (components)        # Reusable buttons, cards, and tab navigation
│   │   └── (screens)           # Conversational, profile, and history screens
│   ├── assets                  # Images and audio assets
│   ├── constants               # Configurations and server URL resolver
│   └── package.json
└── Backend (FastAPI App)
    ├── main.py                 # Core API endpoints and orchestration
    ├── database.py             # PostgreSQL SQLAlchemy setup and schemas
    ├── semantic_memory.py      # LLM memory structures
    ├── voice_analyzer.py       # Voice analytics and metadata
    └── requirements.txt
```

### 4.4 Version Control Practices
* **Branch Strategy:** Developers must use Git. The `main` branch is protected and contains stable, deployable code. Active development must occur on feature branches (e.g., `feat/auth-integration`, `bug/voice-latency`).
* **Commit Messages:** Commits must follow the Conventional Commits specification (e.g., `feat(auth): validate password input rules`, `fix(voice): optimize audio recording timeout`).
* **Merge Requests:** Code must be merged through pull requests, requiring at least one developer review and passing compilation checks.

---

## 5. User Management & Authentication Policy

### 5.1 Registration & Sign-Up Flow
The sign-up flow is designed as a sequential wizard to prevent user confusion:
1. **Terms Acceptance:** The user must review and accept the privacy policy.
2. **Account Creation:** The user enters an email address and password.
3. **Email Verification:** The system sends a verification link to the user's inbox, blocking access to the rest of the application until verified.
4. **Profile Onboarding:** The user completes their profile details (Name, DOB, Gender, Location, and Emergency Contact).

### 5.2 Password Security Rules
To ensure account security, passwords must meet complexity requirements verified by backend and frontend validators:
* **Minimum Length:** Must be at least 8 characters long.
* **Character Diversity:** Must include at least one uppercase letter (A-Z), one lowercase letter (a-z), one number (0-9), and one special character (e.g., `!@#$%^&*`).

```python
# Implemented password validation check (Backend fallback)
def validate_password_complexity(password: str) -> bool:
    if len(password) < 8:
        return False
    if not any(char.isupper() for char in password):
        return False
    if not any(char.islower() for char in password):
        return False
    if not any(char.isdigit() for char in password):
        return False
    if not any(char in '!@#$%^&*(),.?":{}|<>' for char in password):
        return False
    return True
```

### 5.3 Authentication Mechanism
The system uses **Firebase Auth** for user authentication:
* The client authenticates against Firebase and retrieves a JSON Web Token (JWT).
* For every API call to the backend, the client includes this token in the `Authorization: Bearer <token>` header.
* The backend verifies the token using the Firebase Admin SDK (`firebase_admin.auth.verify_id_token`) before processing requests, ensuring secure access control.

### 5.4 Session Management
* **Capped Conversations:** Sessions are capped at 24 hours to prevent unauthorized access.
* **Session Lifecycle Hook:** Closing or minimizing the app triggers a lifecycle hook to notify the backend (`end-all-active`), ending active database sessions and securing user data.

---

## 6. Privacy Policy

### 6.1 Data Collection Principles
Serenity AI is designed to protect user privacy. It collects only the information necessary to provide therapeutic support:

| Data Class | Collection Purpose | Storage Location | Encryption Status |
| :--- | :--- | :--- | :--- |
| **Credentials** | Authentication and login checks | Firebase Auth | Hashed by Firebase |
| **Profile Data** | Basic details (Name, DOB, Gender) | PostgreSQL & Firestore | Plain text in secure database |
| **Conversations** | Chat history and context | PostgreSQL (`message` table) | **Symmetric AES-128 Encrypted** |
| **Vitals & Mood** | Mood tracking and report summaries | PostgreSQL (`mood_entry`) | Plain text, restricted access |
| **Emergency Info**| Safety planning and crisis support | PostgreSQL & Firestore | Plain text, restricted access |
| **Location Coords**| Local crisis hotline lookup | PostgreSQL & Firestore | Plain text, restricted access |

### 6.2 Data Processing & Anonymization
* **On-Device Processing:** Voice transcription and playback are processed on the device whenever possible, transmitting only the necessary text inputs to backend services.
* **Anonymization:** For research or clinical studies, developers must anonymize database exports, removing identifiers (Names, Emails, Locations, and Contact Details) to protect user identity.

### 6.3 User Rights
The application respects user rights:
1. **Right to Access:** Users can request a complete copy of their conversation history, exported as a PDF report in the profile screen.
2. **Right to Erasure (Recommended):** Users should have a single-click option in settings to delete their account. This will trigger a cascading delete in the database, removing all related records.

---

## 7. Security Policy

### 7.1 Symmetric Encryption for Conversations
To protect sensitive mental health discussions, conversation histories are never stored in plain text. The system implements **symmetric AES-128 encryption** via Python's `cryptography.fernet` library:
* **The Process:** The backend encrypts messages before saving them to the database and decrypts them before sending them to the mobile client.
* **Key Storage:** The encryption key must be loaded as an environment variable (`ENCRYPTION_KEY`), ensuring it is never committed directly to version control.

```
       USER INPUT                              POSTGRESQL DB
  +------------------+    Encrypt (Fernet)    +-------------------+
  | "I feel anxious" | ─────────────────────► | gAAAAABmXo8...    |
  +------------------+                        +-------------------+
                                                        │
       USER CLIENT        Decrypt (Fernet)              │
  +------------------+ ◄────────────────────────────────+
  | "I feel anxious" |
  +------------------+
```

### 7.2 Secure API Communications
* **HTTPS Protocol:** All communications between the mobile client and backend must use HTTPS. Plain HTTP connections are rejected.
* **CORS Policy:** The backend restricts cross-origin resource sharing (CORS) to approved origins, preventing unauthorized requests.

### 7.3 Database Access Protection
* **Environment Variables:** Credentials for PostgreSQL and third-party APIs are managed using environment variables (`.env`), protecting sensitive keys.
* **Parameterized Queries:** The system uses SQLAlchemy's object-relational mapping (ORM) to handle database queries, preventing SQL injection vulnerabilities.

---

## 8. AI Usage Policy

### 8.1 Clinical Guardrails & Prompts
Donna is designed as a supportive companion, not a replacement for professional clinical therapy. The Gemini model prompt enforces strict guidelines:
* Donna must introduce herself as a supportive AI companion.
* She must not issue medical diagnoses or prescribe medication.
* She must use evidence-based CBT techniques (such as cognitive reframing) to guide the conversation.
* She must remain supportive, warm, and non-judgmental.

### 8.2 Transparency
The application must clearly communicate its AI-powered nature:
* Users must be notified during onboarding that they are interacting with an AI system.
* Subtitle windows and typing indicators must make it clear that responses are dynamically generated.

### 8.3 Mitigating Hallucinations
To reduce AI errors and ensure reliable support:
* The model's temperature parameter is set to `0.3`, prioritizing consistent and grounded responses over creative ones.
* Context histories are appended to each query, helping Donna maintain conversational context and recall previous statements.

---

## 9. Mental Health Safety & Crisis Policy

### 9.1 Self-Harm and Crisis Screening
Serenity AI includes safety protocols to support users in crisis. The backend checks incoming messages against a list of crisis keywords (such as suicide, self-harm, self-injury, and death):

```python
# Implemented crisis detection list
CRISIS_KEYWORDS = [
    "suicide", "kill myself", "want to die", "end my life", 
    "self-harm", "cutting myself", "overdose", "hanging"
]
```

### 9.2 Therapeutic Redirection Protocol
If a crisis keyword is detected:
1. The AI model shifts its tone, prioritizing user safety over continuing the standard therapeutic dialogue.
2. It refuses to act as a medical professional, advising the user to seek immediate human help.
3. It displays emergency contact information based on the user's location, helping them connect with local crisis hotlines.

```
+--------------------------------------------------------+
|                   Safety Alert                         |
|                                                        |
|  It sounds like you might be going through a difficult |
|  time. Please know that you are not alone.             |
|                                                        |
|  Donna is an AI companion and cannot replace           |
|  professional crisis support.                          |
|                                                        |
|  Please reach out to a trusted professional or contact |
|  your local crisis hotline immediately:                |
|                                                        |
|  * National Helpline: 111-111-321                      |
|  * Emergency Services: 15                              |
|                                                        |
|  We are here to support you.                           |
+--------------------------------------------------------+
```

---

## 10. Acceptable Use Policy

### 10.1 Appropriate Use Cases
Serenity AI is designed to support users dealing with daily stressors, academic challenges, anxiety, and mild loneliness. It is intended to help users build coping strategies and reflect on their emotions in a safe space.

### 10.2 Prohibited Behaviors
Users are prohibited from:
* Using the application to seek emergency medical treatment.
* Attempting to exploit, scrape, or reverse-engineer the API endpoints.
* Inputting offensive, hateful, or inappropriate content.
* Bypassing security checks or authentication steps.

---

## 11. Content Moderation Policy

### 11.1 Moderation Flow
Content moderation is handled through a combination of frontend validation and backend prompt controls:
* **Frontend Filters:** Prevents users from submitting offensive language or inappropriate queries.
* **Gemini Safety Settings:** Enforces strict filters for hate speech, harassment, sexual content, and dangerous activities.
* **System Prompt Guardrails:** Donna is instructed to reject inappropriate requests and redirect the conversation back to a supportive, helpful space.

---

## 12. Accessibility Policy

To ensure the application is accessible to all users, it implements several accessibility design practices:
* **Voice Integration:** Users can speak instead of typing, with transcriptions processed via Groq Whisper and responses read aloud via Edge-TTS.
* **Readable Typography:** Text scales dynamically with system settings, using clean, high-contrast sans-serif fonts to ensure legibility.
* **Accessible Touch Targets:** Buttons and interactive elements maintain a minimum target size of `48dp x 48dp` to accommodate users with motor impairments.
* **Responsive Layouts:** The user interface adjusts dynamically to different screen sizes and orientations, ensuring usability across various device types.

---

## 13. Data Management Policy

### 13.1 Database Management
The application manages relational data using a **PostgreSQL** database organized through the SQLAlchemy ORM:
* Schemas are defined in `database.py`, using foreign keys to maintain relationship integrity between users, sessions, and messages.
* The system performs automated migrations and updates using Alembic.

### 13.2 Data Integrity and Validation
To prevent invalid database entries:
* Data models enforce data type validation, ensuring that emails, phone numbers, and coordinates match required formats.
* Emergency contact fields use regular expressions (`/^\+\d{1,4}\d{10}$/`) to enforce valid country-coded phone numbers (e.g., `+92` followed by exactly 10 digits).

### 13.3 Data Backups (Recommended)
For production-ready systems, developers should set up:
* Daily automated backups of the PostgreSQL database, stored securely in an isolated cloud storage bucket.
* A retention policy that keeps daily backups for 30 days and monthly backups for 1 year, ensuring reliable recovery options in case of system failures.

---

## 14. API Usage Policy

### 14.1 API Architecture
The system utilizes a structured, modular API design built on FastAPI:
* Endpoints are organized by function, separating authentication, profile management, sessions, and AI generation tasks.
* Responses are standardized using Pydantic models, ensuring consistent output formats.

### 14.2 Rate Limiting (Recommended)
To prevent API abuse and manage operation costs:
* Implement rate limiting on sensitive endpoints (such as transcription and text generation).
* Example rule: Limit text chat endpoints to 20 requests per minute per authenticated user, preventing system overload.

---

## 15. Logging and Monitoring Policy

### 15.1 System Logs
The FastAPI backend uses Python's standard logging library to record system events:
* Logs are categorized by severity levels: `INFO` for routine events, `WARNING` for non-critical warnings, and `ERROR`/`CRITICAL` for system failures.
* Log entries must contain timestamps, event summaries, and associated request IDs, helping developers debug issues quickly.

### 15.2 Monitoring (Recommended)
For production systems, developers should set up:
* System performance monitoring (e.g., tracking CPU and memory usage of the backend server).
* Automated alerts that notify developers if server response times exceed 2 seconds or if error rates increase significantly.

---

## 16. Testing Policy

### 16.1 Testing Methodology
To verify system stability, the project implements a multi-layered testing workflow:

```
                  +-----------------------------------------+
                  |            UNIT TESTING                 |
                  |  - Validate validation helpers          |
                  |  - Test encryption utility functions    |
                  +--------------------+--------------------+
                                       |
                                       v
                  +--------------------+--------------------+
                  |         INTEGRATION TESTING             |
                  |  - Verify API endpoints return 200 OK   |
                  |  - Validate DB schema transactions      |
                  +--------------------+--------------------+
                                       |
                                       v
                  +--------------------+--------------------+
                  |            UAT TESTING                  |
                  |  - Manual user testing of features      |
                  |  - Check voice response latency         |
                  +-----------------------------------------+
```

* **Unit Testing:** Validate utility functions, encryption components, and validation helpers.
* **Integration Testing:** Test API endpoints and database operations using mock data.
* **User Acceptance Testing (UAT):** Conduct manual testing sessions with students to evaluate conversational flows, voice call quality, and general usability.

---

## 17. Deployment Policy

### 17.1 Build and Compilation
* **Frontend:** Expo builds the application bundle (`.apk` or `.ipa`) using Expo Application Services (EAS).
* **Backend:** Compiled into a Docker container image, ensuring consistent execution environments across staging and production.

### 17.2 Production Release
* **Backend Hosting:** Deployed to a secure cloud platform (such as Render or AWS), connected to a managed PostgreSQL instance.
* **Database Updates:** Database schema updates must be executed using migration scripts, preventing data loss or downtime during releases.

### 17.3 Rollback Strategy
If a deployment fails:
1. Revert the application stack to the previous stable container build.
2. If database schemas were updated, run rollback migration scripts to restore the database to its previous stable state.

---

## 18. Maintenance Policy

### 18.1 Routine Maintenance Tasks
* **Library Updates:** Dependency versions must be updated quarterly, ensuring third-party packages receive security patches and updates.
* **Database Optimization:** Perform database maintenance (e.g., query tuning and indexing) regularly to maintain fast response times.

### 18.2 Security Updates
Critical security patches must be applied immediately. If a vulnerability is found in a dependency (e.g., Django, PyJWT, or Expo), developers must update the library and redeploy the system within 48 hours.

---

## 19. Legal and Ethical Compliance

### 19.1 Third-Party Libraries and Licensing
The application uses open-source software libraries. Developers must verify that all dependencies use permissive licenses (such as MIT, Apache 2.0, or BSD), avoiding copyleft licenses (like GPLv3) that could restrict project distribution.

### 19.2 Academic Integrity
As a Final Year Project, all implementations, research findings, and documentation must be the original work of the student team. External resources, academic papers, and third-party code must be properly cited and credited.

---

## 20. Roles and Responsibilities

### 20.1 Role Descriptions
* **Student Developers:** Responsible for code implementation, security enforcement, bug fixes, and system deployment.
* **Administrator:** Responsible for database management, cloud configuration, and reviewing anonymized usage statistics.
* **Project Supervisor:** Responsible for overseeing development milestones, ensuring compliance with academic standards, and reviewing project policies.
* **Future Maintainers:** Responsible for addressing bug reports, updating API connections, and scaling the system after the initial release.

---

## 21. Risk Management Policy

### 21.1 Risk Identification and Mitigation

| Risk Area | Risk Description | Severity | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Data Leakage** | Unauthorized database access exposing user conversations | **High** | Implement symmetric AES-128 Fernet encryption for message databases. |
| **AI Hallucinations** | AI provides inappropriate advice or incorrect information | **Medium** | Set LLM temperature to `0.3` and instruct the model to refuse medical diagnoses. |
| **System Downtime** | Cold starts or backend server outages halt services | **Medium** | Implement connection timeouts, automated retries, and offline warning screens. |
| **Weak Credentials**| Users register with simple, easily guessed passwords | **Low** | Enforce password complexity rules on both backend and frontend inputs. |

---

## 22. Future Policy Improvements

To prepare the application for a wider, production-ready release, future developers should consider:
1. **Clinical Peer Review:** Have professional clinical psychologists review the AI system prompts, ensuring Donna's advice aligns with therapeutic standards.
2. **HIPAA Compliance Auditing:** If deploying the app commercially, audit database infrastructure, encryption keys, and log systems to satisfy HIPAA compliance requirements.
3. **Automated Vulnerability Scanning:** Integrate automated security scanning tools (such as Snyk or Dependabot) into the version control workflow, catching package vulnerabilities before deployment.

---

## 23. Conclusion

This Project Policy Document provides a robust governance, security, and operational framework for **Serenity AI**. By establishing policies for user authentication, message encryption, AI safety protocols, and crisis management, the document ensures the system operates in a secure, stable, and ethically responsible manner. 

Adhering to these guidelines supports academic standards, protects user privacy, and creates a safe environment for students and young adults seeking mental health companion support, fulfilling the requirements for a BS Computer Science Final Year Project.
