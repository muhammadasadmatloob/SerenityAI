# SerenityAI Firebase Security Rules

To apply these rules, go to the Firebase Console -> Firestore Database -> Rules, and paste the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // Fields your app is allowed to write to /users/{userId}
    function allowedUserFields() {
      return ['uid', 'name', 'birthDate', 'gender', 'location', 'emergencyContact',
              'email', 'isOnboardingComplete', 'updatedAt', 'path'];
    }

    // --- 👇 CRISIS ALERTS RULE 👇 ---
    match /crisis_alerts/{alert} {
      allow read, write: if isSignedIn();
    }
    // ----------------------------------

    match /users/{userId} {

      allow read: if isOwner(userId);

      // Initial onboarding write (saveUserInfo)
      allow create: if isOwner(userId)
                    && request.resource.data.uid == userId
                    && request.resource.data.email == request.auth.token.email
                    && request.resource.data.isOnboardingComplete == false;
      
      // Subsequent profile updates
      allow update: if isOwner(userId)
                    && request.resource.data.diff(resource.data).affectedKeys()
                        .hasOnly(allowedUserFields());
    }

    // --- 👇 ADMIN OVERRIDES RULE 👇 ---
    // Includes session ID segregation so previous crisis sessions aren't mixed
    match /admin_overrides/{userId}/sessions/{sessionId}/messages/{msgId} {
      allow read: if isOwner(userId);
      // In a production app, we would restrict writes here to an admin role or custom claim.
      // For now, any signed in user can write (used by Admin Dashboard running locally).
      allow write: if isSignedIn(); 
    }
    // ----------------------------------
  }
}
```
