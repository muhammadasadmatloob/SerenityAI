import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, setLogLevel } from "firebase/app";
// @ts-ignore
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Silence Firebase SDK logs (like offline timeouts) to prevent them from triggering React Native error screens.
setLogLevel("silent");

let app: any = null;
let authObj: any = null;
let dbObj: any = null;

try {
  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "dummy-api-key",
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy-auth-domain",
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "dummy-project-id",
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy-storage-bucket",
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "dummy-sender-id",
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "dummy-app-id",
  };

  app = initializeApp(firebaseConfig);

  let persistence;
  try {
    if (typeof getReactNativePersistence === "function") {
      persistence = getReactNativePersistence(AsyncStorage);
    }
  } catch (e) {
    console.warn("Could not setup persistence:", e);
  }

  authObj = initializeAuth(app, persistence ? { persistence } : {});

  dbObj = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });
} catch (error) {
  console.error("FATAL FIREBASE INIT ERROR:", error);
}

export const auth = authObj;
export const db = dbObj;