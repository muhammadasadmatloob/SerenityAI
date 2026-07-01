<div align="center">

# 🌟 SerenityAI
### Final Year Project - DHA Suffa University

</div>

SerenityAI is a comprehensive mental wellness and therapeutic support application featuring a dynamic React Native Frontend (built with Expo) and a FastAPI Backend powered by AI capabilities.

## 👥 Group Members

| Name | Roll Number |
| :--- | :--- |
| **MUHAMMAD ASAD MATLOOB** | `CS221127` |
| **HASSAN KHAN** | `CS221145` |
| **ILIYAN RAHIM** | `CS221131` |
| **RAZA ALI** | `CS221136` |

<br />

## 📱 Download the Android APK

You can download the compiled production-ready Android APK directly from this repository:

👉 **[Download SerenityAI.apk](https://github.com/muhammadasadmatloob/SerenityAI/raw/main/APK/SerenityAI.apk)**

### Installation Instructions:
1. Click the download link above on your Android device (or download it on your PC and transfer it to your phone).
2. Tap the downloaded file to begin the installation.
3. If prompted by **Play Protect** that the application is from an "Unknown developer", tap **More details** and select **Install anyway** (since it is a self-signed package).

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
