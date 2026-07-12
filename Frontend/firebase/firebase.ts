import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, setLogLevel } from "firebase/app";
// @ts-ignore
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Intercept fetch requests to remove Origin/Referer headers that trigger Firebase API key restrictions on mobile.
if (typeof global !== "undefined" && global.fetch) {
  const originalFetch = global.fetch;
  global.fetch = function (input: any, init: any) {
    let url = "";
    if (typeof input === "string") {
      url = input;
    } else if (input && typeof input === "object" && "url" in input) {
      url = (input as any).url;
    }

    if (url && (url.includes("identitytoolkit.googleapis.com") || url.includes("securetoken.googleapis.com") || url.includes("googleapis.com"))) {
      if (init && init.headers) {
        if (typeof init.headers.delete === "function") {
          try {
            init.headers.delete("origin");
            init.headers.delete("Origin");
            init.headers.delete("referer");
            init.headers.delete("Referer");
          } catch (e) {}
        } else if (typeof init.headers === "object") {
          try {
            delete init.headers["origin"];
            delete init.headers["Origin"];
            delete init.headers["referer"];
            delete init.headers["Referer"];
          } catch (e) {}
        }
      }
      
      if (input && typeof input === "object" && "headers" in input && input.headers) {
        if (typeof input.headers.delete === "function") {
          try {
            input.headers.delete("origin");
            input.headers.delete("Origin");
            input.headers.delete("referer");
            input.headers.delete("Referer");
          } catch (e) {}
        } else if (typeof input.headers === "object") {
          try {
            delete input.headers["origin"];
            delete input.headers["Origin"];
            delete input.headers["referer"];
            delete input.headers["Referer"];
          } catch (e) {}
        }
      }
    }
    return originalFetch.apply(this, [input, init]);
  };
}

// Silence Firebase SDK logs (like offline timeouts) to prevent them from triggering React Native error screens.
setLogLevel("silent");

const getEnvValue = (value: any, defaultValue: string): string => {
  if (!value || value === "undefined" || value === "null" || typeof value !== "string") {
    return defaultValue;
  }
  return value.trim();
};

const firebaseConfig = {
  apiKey: getEnvValue(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, "AIzaSyCQE1edP7aquOKmt__HI6ig7Ipnoy3neEM"),
  authDomain: getEnvValue(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, "serenityfirebaseauthapp.firebaseapp.com"),
  projectId: getEnvValue(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, "serenityfirebaseauthapp"),
  storageBucket: getEnvValue(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, "serenityfirebaseauthapp.firebasestorage.app"),
  messagingSenderId: getEnvValue(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, "912212577475"),
  appId: getEnvValue(process.env.EXPO_PUBLIC_FIREBASE_APP_ID, "1:912212577475:web:aa446b15dd579af3aba676"),
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});