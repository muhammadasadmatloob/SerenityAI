import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

/* =========================
   AUTH FUNCTIONS
========================= */

export const signupWithEmail = async (email: string, password: string, confirmPassword: string) => {
  if (password !== confirmPassword) throw new Error("Passwords do not match");
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(userCredential.user);
  return userCredential.user;
};

export const loginWithEmail = async (email: string, password: string) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const resendVerificationEmail = async () => {
  const user = auth.currentUser;
  if (user) {
    await sendEmailVerification(user);
    return true;
  }
  throw new Error("No user logged in");
};

export const forgotPassword = async (email: string) => await sendPasswordResetEmail(auth, email);

export const logoutUser = async () => await signOut(auth);

/* =========================
   USER INFO FUNCTIONS
========================= */

export const saveUserInfo = async (
  uid: string, 
  name: string, 
  birthDate: Date, 
  gender: string,
  location: { latitude: number, longitude: number } | null,
  emergencyContact: { name: string, phone: string }
) => {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, {
    uid,
    name,
    birthDate: birthDate.toISOString(),
    gender,
    location,
    emergencyContact,
    email: auth.currentUser?.email || "",
    isOnboardingComplete: true,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};