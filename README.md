# SerenityAI

SerenityAI is a comprehensive mental wellness and therapeutic support application featuring a dynamic React Native Frontend (built with Expo) and a FastAPI Backend powered by AI capabilities.

## Project Structure

The project is split into two main components:
- **`Frontend/`**: Expo React Native mobile application.
- **`Backend/`**: FastAPI python backend database, user sessions, text-to-speech, and transcription.

---

## Getting Started

### 1. Backend Setup

1. Navigate to the `Backend` directory:
   ```bash
   cd Backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   - Copy the template file: `cp .env.example .env` (or rename manually).
   - Fill in your database URL (PostgreSQL), encryption key, and Groq API key in `.env`.
5. Configure Firebase Admin:
   - Generate a new private key from your Firebase Console (Project Settings > Service accounts).
   - Save the key file as `serviceAccountKey.json` inside the `Backend` directory. You can refer to `serviceAccountKey.json.example` for the required format.
6. Run the backend development server:
   ```bash
   uvicorn main:app --reload
   ```

### 2. Frontend Setup

1. Navigate to the `Frontend` directory:
   ```bash
   cd Frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Copy the template file: `cp .env.example .env` (or rename manually).
   - Fill in your Firebase config values.
4. Run the frontend application:
   ```bash
   npx expo start
   ```

---

## Security & Environment Variables

All API keys, database credentials, and private files (such as the Firebase Admin Service Account JSON) are ignored from Git via `.gitignore` to prevent leakage. Never commit these files. Always use the `.env` files for configuration.
