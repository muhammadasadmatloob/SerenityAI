import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, setLogLevel } from "firebase/app";
// @ts-ignore
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Silence Firebase SDK logs (like offline timeouts) to prevent them from triggering React Native error screens.
setLogLevel("silent");

const firebaseConfig = {
  apiKey: "AIzaSyCQE1edP7aquOKmt__HI6ig7Ipnoy3neEM",
  authDomain: "serenityfirebaseauthapp.firebaseapp.com",
  projectId: "serenityfirebaseauthapp",
  storageBucket: "serenityfirebaseauthapp.firebasestorage.app",
  messagingSenderId: "912212577475",
  appId: "1:912212577475:web:aa446b15dd579af3aba676",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});