import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, setLogLevel } from "firebase/app";
// @ts-ignore
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Silence Firebase SDK logs (like offline timeouts) to prevent them from triggering React Native error screens.
setLogLevel("silent");

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCQE1edP7aquOKmt__HI6ig7Ipnoy3neEM",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "serenityfirebaseauthapp.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "serenityfirebaseauthapp",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "serenityfirebaseauthapp.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "912212577475",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:912212577475:web:aa446b15dd579af3aba676",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});