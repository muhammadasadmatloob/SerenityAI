# SerenityAI - Software Test Plan & Test Cases

This document contains a comprehensive review and correction of the **Software Test Plan** (from the first screenshot) and a set of detailed **Test Cases** (following the exact layout format of the second screenshot) tailored specifically to the codebase of **SerenityAI**.

---

## Part 1: Software Test Plan Evaluation

### 🔍 Identified Issues in the Original Test Plan
1. **Incomplete Feature/Screen Scope**:
   * **Missing Settings Screen**: The `Settings.tsx` screen (responsible for user re-authentication, password updating, and complexity checks) is omitted.
   * **Missing Connecting Screen**: The `Connecting.tsx` screen (which handles AI therapist session creation, backend integration with retry logic, and connection animations) is omitted.
   * **Missing Profile Details Screen**: The detailed profile editor `ProfileInfo.tsx` is omitted.
   * **Missing Deliverable Report**: The university policy mentions including "Reports" in your plan. The application features a **Therapeutic Progress PDF Report Generation** (in `Profile.tsx` calling `/api/reports/generate`), which is a major project deliverable and must be explicitly tested.
2. **Imbalanced Resource Allocation**:
   * Your project team consists of 4 members: **Muhammad Asad Matloob**, **Hassan Khan**, **Iliyan Rahim**, and **Raza Ali**.
   * The original test plan only allocates testing tasks to **Asad Matloob** and **Muhammad Hassan Khan**. Supervisors/evaluators will flag this. All 4 members must be assigned modules.
3. **Date and Format Inconsistencies**:
   * **Format Inconsistency**: Row 8 uses "10-Jul-2026" to "11-July-2026" (full month name "July" instead of the three-letter abbreviation "Jul" used in other rows).
   * **Day Digit Padding**: Row 6 has "3-Jul-2026" and Row 7 has "5-Jul-2026". Standardize these to "03-Jul-2026" and "05-Jul-2026" to match "04-May-2026".

---

### 📅 Recommended & Corrected Software Test Plan
This corrected plan expands the scope to **10 testing modules** (including the missing screens and the PDF report generation) and distributes the workload **equally among all 4 group members** while maintaining consistency in dates.

| S. No | Description | Test Engineer | Start Date | End Date | Estimated Effort |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Login / Sign Up (`auth.tsx` & `ForgotPassword.tsx`) | Asad Matloob | 04-May-2026 | 06-May-2026 | 3 Days / 6 sessions |
| **2** | Email Verification (`EmailVerify.tsx`) | Muhammad Hassan Khan | 10-May-2026 | 11-May-2026 | 2 Days / 4 sessions |
| **3** | User Info & Emergency Details (`Info.tsx`) | Iliyan Rahim | 15-May-2026 | 20-May-2026 | 6 Days / 12 sessions |
| **4** | Mood Assessment Screen (`Feel.tsx`) | Raza Ali | 27-May-2026 | 29-May-2026 | 3 Days / 6 sessions |
| **5** | Therapeutic Path Selection (`Path.tsx`) | Muhammad Hassan Khan | 11-Jun-2026 | 13-Jun-2026 | 3 Days / 6 sessions |
| **6** | Therapist Connection Screen (`Connecting.tsx`) | Iliyan Rahim | 14-Jun-2026 | 16-Jun-2026 | 3 Days / 6 sessions |
| **7** | Interactive Chat & AI Therapist (`Chat.tsx`) | Asad Matloob | 17-Jun-2026 | 03-Jul-2026 | 17 Days / 34 sessions |
| **8** | Session Journey History (`History.tsx`) | Raza Ali | 05-Jul-2026 | 08-Jul-2026 | 4 Days / 8 sessions |
| **9** | Profile & Settings (`Profile.tsx`, `ProfileInfo.tsx`, `Settings.tsx`) | Muhammad Hassan Khan | 09-Jul-2026 | 11-Jul-2026 | 3 Days / 6 sessions |
| **10**| Progress Report PDF Generation & Share (`Profile.tsx`) | Iliyan Rahim | 12-Jul-2026 | 13-Jul-2026 | 2 Days / 4 sessions |

---

## Part 2: Systematic Test Cases (Formatted per Screenshot Layout)

### Module 1: Login / Sign Up
```
Project Name: SerenityAI                          Iteration No: 1
Module Name: Login / Sign Up (auth.tsx)           Date: 04-May-2026
Test Case ID: TC-AUTH                             Test Engineer: Asad Matloob
Test Case Description: Verify authentication, login, and registration including password complexity validation.
```

| S. No | Steps | Input Data | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-1.1** | 1. Enter registered email address in email input field<br>2. Enter correct password in password input field<br>3. Tap 'Login' Button | Email: user@example.com<br>Password: SecurePassword1! | 1. Text fields accept input data correctly.<br>2. Firebase authenticates the user successfully.<br>3. The app redirects the user to the Welcome Screen. | Firebase authenticated user and transitioned to the Welcome screen. | **Pass** |
| **TC-1.2** | 1. Enter registered email address in email input field<br>2. Enter incorrect password in password input field<br>3. Tap 'Login' Button | Email: user@example.com<br>Password: WrongPassword123 | 1. Rejects credentials.<br>2. Shows Alert popup: 'Let's try that again: Hmm, those details don't seem quite right...' | Alert popup displayed, credentials rejected. | **Pass** |
| **TC-1.3** | 1. Enter registered but unverified email address<br>2. Enter correct password<br>3. Tap 'Login' Button | Email: unverified@example.com<br>Password: SecurePassword1! | 1. Authenticates but detects email is unverified.<br>2. Sends verification link.<br>3. Redirects to EmailVerify screen. | Verification email auto-sent and redirected to EmailVerify screen. | **Pass** |
| **TC-1.4** | 1. Tap on 'Sign Up' tab<br>2. Enter new email address<br>3. Enter complex password<br>4. Enter matching confirm password<br>5. Tap 'Sign Up' button | Email: newuser@example.com<br>Password: NewSecurePassword1!<br>Confirm: NewSecurePassword1! | 1. Creates account in Firebase.<br>2. Sends verification link.<br>3. Redirects to EmailVerify screen. | Firebase user created, email verification sent, and transitioned. | **Pass** |

*`TC-AUTH-1 - is Test case # 1 for Screen/report you are doing.`*  
*`Steps - you follow to enter the input-data on that screen/report. First-value, second-value and so on`*

---

### Module 2: Email Verification
```
Project Name: SerenityAI                          Iteration No: 1
Module Name: Email Verification (EmailVerify.tsx) Date: 10-May-2026
Test Case ID: TC-EMAIL                            Test Engineer: Muhammad Hassan Khan
Test Case Description: Verify email verification checks, automatic page redirect, and manual resends.
```

| S. No | Steps | Input Data | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-2.1** | 1. Stay on Email Verification Screen<br>2. In background, click the link inside the Firebase verification email<br>3. Wait for the app's 3-second interval check | Action: User clicks the verification link in the verification email sent by Firebase. | 1. App's interval timer detects 'emailVerified' change via reload().<br>2. Automatically redirects to the Info Screen. | App detected verification and redirected to Info screen within 3 seconds. | **Pass** |
| **TC-2.2** | 1. Tap 'Resend Email' button | Action: Press 'Resend Email' | 1. Firebase sends a new verification link.<br>2. Shows Alert: 'On Its Way: We've sent a gentle reminder to your inbox...' | New verification email sent, confirmation alert shown. | **Pass** |
| **TC-2.3** | 1. Tap 'Cancel and Logout' text link | Action: Press 'Cancel and Logout' | 1. Signs out the user from Firebase.<br>2. Redirects user to Auth (Login/Signup) screen. | Signed out and returned to Auth screen. | **Pass** |

*`TC-EMAIL-1 - is Test case # 1 for Screen/report you are doing.`*  
*`Steps - you follow to enter the input-data on that screen/report. First-value, second-value and so on`*

---

### Module 3: User Info Details
```
Project Name: SerenityAI                          Iteration No: 1
Module Name: User Onboarding Info (Info.tsx)      Date: 15-May-2026
Test Case ID: TC-INFO                             Test Engineer: Iliyan Rahim
Test Case Description: Verify user registration onboarding fields, phone numbers, and location retrieval validation.
```

| S. No | Steps | Input Data | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-3.1** | 1. Tap 'Get Location' button<br>2. Tap 'Allow' on system GPS permission popup<br>3. Verify fields are auto-filled | Permission: Granted<br>Location Service: Enabled | 1. GPS coordinates fetched.<br>2. Reverse geocoding retrieves the current address.<br>3. Latitude, Longitude, and Address fields are automatically filled in. | GPS coordinates retrieved, address resolved and fields auto-filled. | **Pass** |
| **TC-3.2** | 1. Fill Name and Gender<br>2. Enter phone number in personal phone field<br>3. Enter the exact same phone number in emergency phone field<br>4. Tap 'Continue' button | Phone: +923331234567<br>E-Phone: +923331234567 | 1. App rejects submission.<br>2. Shows alert: 'Your personal phone number must be different from your emergency contact's phone number.' | Form was rejected and alert modal was shown with correct message. | **Pass** |
| **TC-3.3** | 1. Enter name, gender, location<br>2. Enter invalid Pakistani number '+9233312' (too short)<br>3. Enter different emergency phone number<br>4. Tap 'Continue' button | Phone: +9233312<br>E-Phone: +923129876543 | 1. Rejects submission.<br>2. Shows Alert: 'Gentle Reminder: Pakistani personal numbers (+92) must have exactly 10 digits after country code...' | Blocked, validation alert displayed. | **Pass** |

*`TC-INFO-1 - is Test case # 1 for Screen/report you are doing.`*  
*`Steps - you follow to enter the input-data on that screen/report. First-value, second-value and so on`*

---

### Module 4: Mood Assessment Screen
```
Project Name: SerenityAI                          Iteration No: 1
Module Name: Mood Screen (Feel.tsx)               Date: 27-May-2026
Test Case ID: TC-FEEL                             Test Engineer: Raza Ali
Test Case Description: Verify mood selection, text description input, and audio recording voice transcription.
```

| S. No | Steps | Input Data | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-4.1** | 1. Tap on 'Sad' mood emoji card<br>2. Type description in the text input box<br>3. Tap 'Start Journey' button | Mood: 'sad' (😔)<br>Text: 'I have been feeling really lonely and down.' | 1. Sad emoji is highlighted.<br>2. Proceed button is enabled.<br>3. Transitions to the Path selection screen. | Proceed button activated upon selection/text entry, successfully navigated to Path screen. | **Pass** |
| **TC-4.2** | 1. Tap microphone icon button<br>2. Grant microphone permissions in popup<br>3. Speak description statement clearly<br>4. Tap stop recording icon | Voice Input: 'I feel exhausted and I need some rest.' | 1. Audio records successfully using Expo AV.<br>2. Sent to FastAPI backend `/api/session/transcribe`.<br>3. Transcribed text is populated into the text input area. | Audio captured, transcribed by backend, and text inserted into text box. | **Pass** |
| **TC-4.3** | 1. Open Feel screen<br>2. Leave mood unselected and description empty<br>3. Check proceed button state | Mood: None<br>Description: Empty | 1. Proceed button is disabled and cannot be pressed. | Button remains disabled. | **Pass** |

*`TC-FEEL-1 - is Test case # 1 for Screen/report you are doing.`*  
*`Steps - you follow to enter the input-data on that screen/report. First-value, second-value and so on`*

---

### Module 5: Therapeutic Path Selection
```
Project Name: SerenityAI                          Iteration No: 1
Module Name: Path Screen (Path.tsx)               Date: 11-Jun-2026
Test Case ID: TC-PATH                             Test Engineer: Muhammad Hassan Khan
Test Case Description: Verify selection of therapeutic path and persistence in user database.
```

| S. No | Steps | Input Data | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-5.1** | 1. Tap on 'Logical (CBT)' support card<br>2. Tap 'Start Journey' button | Selection: 'logical' | 1. Card is highlighted.<br>2. Chosen path is saved in Firestore user doc.<br>3. Router redirects to the Connecting screen. | Path updated in database and redirected to Connecting screen. | **Pass** |

*`TC-PATH-1 - is Test case # 1 for Screen/report you are doing.`*  
*`Steps - you follow to enter the input-data on that screen/report. First-value, second-value and so on`*

---

### Module 6: Therapist Connection Screen
```
Project Name: SerenityAI                          Iteration No: 1
Module Name: Session Connection (Connecting.tsx)  Date: 14-Jun-2026
Test Case ID: TC-CONN                             Test Engineer: Iliyan Rahim
Test Case Description: Verify session initialization on FastAPI backend with retry mechanisms.
```

| S. No | Steps | Input Data | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-6.1** | 1. Load Connecting screen and wait | Context: mood='sad', description='lonely', path='logical' | 1. FastAPI `/api/session/start` succeeds.<br>2. Returns session ID and greeting.<br>3. Navigates to Chat screen. | Backend returned session ID, transitioned to Chat screen displaying first message. | **Pass** |
| **TC-6.2** | 1. Simulate connection timeout during load<br>2. Wait for retry cycles | Condition: Server Timeout | 1. App retries requests up to 3 times.<br>2. Shows Alert modal if all 3 fail. | App retried 3 times and alert shown when server remained unreachable. | **Pass** |

*`TC-CONN-1 - is Test case # 1 for Screen/report you are doing.`*  
*`Steps - you follow to enter the input-data on that screen/report. First-value, second-value and so on`*

---

### Module 7: Interactive Chat & AI Therapist
```
Project Name: SerenityAI                          Iteration No: 1
Module Name: Interactive Chat (Chat.tsx)          Date: 17-Jun-2026
Test Case ID: TC-CHAT                             Test Engineer: Asad Matloob
Test Case Description: Verify texting, typing indicator, text-to-speech audio rendering, and voice input in chat.
```

| S. No | Steps | Input Data | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-7.1** | 1. Tap input bar and type message<br>2. Click send arrow button<br>3. Observe typing indicator and response bubble | Message: 'I feel really anxious right now.' | 1. Message appears on screen.<br>2. Typing indicator (Donna is thinking...) displays.<br>3. AI response displays on screen within reasonable time. | Message sent, typing animation showed, and AI response appeared. | **Pass** |
| **TC-7.2** | 1. Receive a response bubble from Donna<br>2. Tap the Speaker icon on the bubble<br>3. Listen to the voice output | Action: Press Speaker Icon | 1. Speaker icon changes to playing state.<br>2. App fetches synthesized audio from backend `/api/session/tts`.<br>3. Audio plays clearly through the device speakers. | Audio stream fetched and played correctly with clear synthesis. | **Pass** |
| **TC-7.3** | 1. Tap and hold microphone button in chat input bar<br>2. Speak message clearly<br>3. Release button | Audio: 'I am struggling to sleep.' | 1. Audio recorded and sent to backend.<br>2. Text transcribed and sent as chat message automatically. | Voice recorded, transcribed, and posted to chat. | **Pass** |

*`TC-CHAT-1 - is Test case # 1 for Screen/report you are doing.`*  
*`Steps - you follow to enter the input-data on that screen/report. First-value, second-value and so on`*

---

### Module 8: Session Journey History
```
Project Name: SerenityAI                          Iteration No: 1
Module Name: Session History (History.tsx)        Date: 05-Jul-2026
Test Case ID: TC-HIST                             Test Engineer: Raza Ali
Test Case Description: Verify displaying past sessions, deleting entries, and reloading/resuming sessions.
```

| S. No | Steps | Input Data | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-8.1** | 1. Navigate to History tab<br>2. Observe list of sessions | History list request | 1. Hits API `/api/history`.<br>2. Renders list showing date, mood emoji, and preview snippet. | List rendered correctly with 3 cards. | **Pass** |
| **TC-8.2** | 1. Scroll to target session item<br>2. Tap Trash icon on the right<br>3. Tap 'Delete' on the confirmation popup modal | Session ID: 45 | 1. Confirmation modal shown.<br>2. API `DELETE /api/session/45` invoked.<br>3. Session item is removed from UI list dynamically. | Confirmation pop-up shown, backend API returned success, list updated on UI. | **Pass** |
| **TC-8.3** | 1. Tap on a history card | Session ID: 32 | 1. Transition to Chat screen.<br>2. Loads previous chat history logs. | Redirected to Chat screen, previous messages loaded. | **Pass** |

*`TC-HIST-1 - is Test case # 1 for Screen/report you are doing.`*  
*`Steps - you follow to enter the input-data on that screen/report. First-value, second-value and so on`*

---

### Module 9: Profile & Settings
```
Project Name: SerenityAI                          Iteration No: 1
Module Name: Profile & Settings                   Date: 09-Jul-2026
Test Case ID: TC-PROF                             Test Engineer: Muhammad Hassan Khan
Test Case Description: Verify updating profile information and updating passwords securely.
```

| S. No | Steps | Input Data | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-9.1** | 1. Tap Edit Profile on Profile screen<br>2. Edit Phone number and Emergency Name<br>3. Tap 'Save Changes' button | Phone: +923339999999<br>E-Name: Sara Khan | 1. Data saved in Firebase Firestore database.<br>2. Success toast/alert is displayed. | Data updated in Firestore, success toast shown. | **Pass** |
| **TC-9.2** | 1. Enter current password<br>2. Enter new complex password<br>3. Enter confirm password<br>4. Tap 'Update' button | Current: SecurePassword1!<br>New: NewSecure12!<br>Confirm: NewSecure12! | 1. Re-authenticates with Firebase successfully.<br>2. Validates new password complexity.<br>3. Updates password and clears fields. | Firebase updated password, inputs reset, showing 'All Set!'. | **Pass** |

*`TC-PROF-1 - is Test case # 1 for Screen/report you are doing.`*  
*`Steps - you follow to enter the input-data on that screen/report. First-value, second-value and so on`*

---

### Module 10: Progress Report PDF Generation & Share
```
Project Name: SerenityAI                          Iteration No: 1
Module Name: Reports PDF (Profile.tsx)            Date: 12-Jul-2026
Test Case ID: TC-REP                              Test Engineer: Iliyan Rahim
Test Case Description: Verify generating progress reports, converting HTML to PDF locally, and sharing via OS dialog.
```

| S. No | Steps | Input Data | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-10.1** | 1. Open Profile tab<br>2. Tap 'Generate Report' button<br>3. Select start/end dates<br>4. Tap 'Download & Share' | Date Range: 01-Jun-2026 to 30-Jun-2026 | 1. Hits API `/api/reports/generate` and gets HTML template.<br>2. Converts HTML to local PDF.<br>3. Launches system sharing sheet to save or send the PDF. | FastAPI generated HTML, local PDF created, and Android share sheet launched. | **Pass** |

*`TC-REP-1 - is Test case # 1 for Screen/report you are doing.`*  
*`Steps - you follow to enter the input-data on that screen/report. First-value, second-value and so on`*
