import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

/* =========================
   PASSWORD VALIDATION
========================= */

export const validatePassword = (password: string) => {
  if (password.length < 8)
    return "Password must be at least 8 characters long";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least one capital letter";
  if (!/[a-z]/.test(password))
    return "Password must contain at least one small letter";
  if (!/[0-9]/.test(password))
    return "Password must contain at least one number";
  if (!/[^A-Za-z0-9]/.test(password))
    return "Password must contain at least one special character";

  return null;
};

/* =========================
   SIGNUP
========================= */

export const signupWithEmail = async (
  email: string,
  password: string,
  confirmPassword: string
) => {
  if (password !== confirmPassword) {
    throw new Error("Passwords do not match");
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  await sendEmailVerification(userCredential.user);

  return userCredential.user;
};

/* =========================
   LOGIN
========================= */

export const loginWithEmail = async (email: string, password: string) => {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  const user = userCredential.user;

  if (!user.emailVerified) {
    await sendEmailVerification(user);
    throw new Error("EMAIL_NOT_VERIFIED");
  }

  return user;
};

/* =========================
   RESEND VERIFICATION
========================= */

export const resendVerificationEmail = async () => {
  if (!auth.currentUser) {
    throw new Error("No authenticated user");
  }

  await sendEmailVerification(auth.currentUser);
};

/* =========================
   FORGOT PASSWORD
========================= */

export const forgotPassword = async (email: string) => {
  await sendPasswordResetEmail(auth, email);
};

/* =========================
   SAVE USER INFO
========================= */

/**
 * We now pass the UID explicitly to ensure Firestore 
 * matches the Security Rule: request.auth.uid == userId
 */
export const saveUserInfo = async (uid: string, name: string, age: number) => {
  if (!uid) {
    throw new Error("No User ID provided");
  }

  const userRef = doc(db, "users", uid);
  
  await setDoc(
    userRef,
    {
      uid: uid,
      name: name,
      age: age,
      email: auth.currentUser?.email || "",
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
};

/* =========================
   CHECK USER INFO EXISTS
========================= */

export const getUserInfo = async () => {
  const user = auth.currentUser;
  if (!user) return null;

  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists() ? snap.data() : null;
};

/* =========================
   LOGOUT
========================= */

export const logoutUser = async () => {
  await signOut(auth);
};