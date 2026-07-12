import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, setLogLevel } from "firebase/app";
// @ts-ignore
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Intercept fetch requests to remove Origin/Referer headers that trigger Firebase API key restrictions on mobile.
if (typeof global !== "undefined" && global.fetch) {
  const originalFetch = global.fetch;
  global.fetch = async function (input: any, init: any) {
    let url = "";
    if (typeof input === "string") {
      url = input;
    } else if (input && typeof input === "object" && "url" in input) {
      url = (input as any).url;
    }

    // Rewrite Firebase Authentication API calls to proxy through the backend, bypassing network/SSL blocks.
    if (url && (url.includes("identitytoolkit.googleapis.com") || url.includes("securetoken.googleapis.com"))) {
      const backendUrl = "https://serenityai-93qt.onrender.com";
      let targetPath = "";
      let apiKey = "";

      if (url.includes("identitytoolkit.googleapis.com/")) {
        const parts = url.split("identitytoolkit.googleapis.com/");
        if (parts[1]) {
          const pathAndQuery = parts[1];
          const queryParts = pathAndQuery.split("?");
          targetPath = queryParts[0];
          if (queryParts[1]) {
            const queryParams = queryParts[1].split("&");
            for (const param of queryParams) {
              const pair = param.split("=");
              if (pair[0] === "key") {
                apiKey = pair[1] || "";
                break;
              }
            }
          }
        }
      } else if (url.includes("securetoken.googleapis.com/")) {
        const parts = url.split("securetoken.googleapis.com/");
        if (parts[1]) {
          const pathAndQuery = parts[1];
          const queryParts = pathAndQuery.split("?");
          targetPath = "securetoken/" + queryParts[0];
          if (queryParts[1]) {
            const queryParams = queryParts[1].split("&");
            for (const param of queryParams) {
              const pair = param.split("=");
              if (pair[0] === "key") {
                apiKey = pair[1] || "";
                break;
              }
            }
          }
        }
      }

      if (targetPath) {
        const proxyUrl = `${backendUrl}/api/auth/proxy?path=${encodeURIComponent(targetPath)}${apiKey ? `&key=${encodeURIComponent(apiKey)}` : ""}`;
        console.log(`[Firebase Proxy] Redirecting: ${url} -> ${proxyUrl}`);
        url = proxyUrl;
      }
    }

    if (url && (url.includes("identitytoolkit.googleapis.com") || url.includes("securetoken.googleapis.com") || url.includes("googleapis.com") || url.includes("proxy?path="))) {
      let headers: Record<string, string> = {};
      
      // Extract existing headers from init
      if (init && init.headers) {
        if (typeof init.headers.forEach === "function") {
          try {
            init.headers.forEach((value: string, key: string) => {
              headers[key.toLowerCase()] = value;
            });
          } catch (e) {}
        } else if (typeof init.headers === "object") {
          for (const key in init.headers) {
            headers[key.toLowerCase()] = init.headers[key];
          }
        }
      }

      // Extract existing headers from input Request object if applicable
      if (input && typeof input === "object" && "headers" in input && input.headers) {
        if (typeof input.headers.forEach === "function") {
          try {
            input.headers.forEach((value: string, key: string) => {
              headers[key.toLowerCase()] = value;
            });
          } catch (e) {}
        } else if (typeof input.headers === "object") {
          for (const key in input.headers) {
            headers[key.toLowerCase()] = input.headers[key];
          }
        }
      }

      // Explicitly delete Origin and Referer headers
      delete headers["origin"];
      delete headers["referer"];
      // Reconstruct fetch parameters
      let method = "GET";
      let body: any = undefined;
      
      if (input && typeof input === "object") {
        method = input.method || "GET";
        if (typeof input.text === "function") {
          try {
            body = await input.text();
          } catch (e) {}
        } else if (input._bodyInit) {
          body = input._bodyInit;
        } else if (input._bodyText) {
          body = input._bodyText;
        }
      }
      
      if (init) {
        if (init.method) method = init.method;
        if (init.body) body = init.body;
      }
      
      const fetchOptions: any = {
        method: method,
        headers: headers,
      };
      
      if (body !== undefined && method !== "GET" && method !== "HEAD") {
        fetchOptions.body = body;
      }
      
      const credentials = (init && init.credentials) || (input && (input as any).credentials);
      if (credentials) fetchOptions.credentials = credentials;
      
      const mode = (init && init.mode) || (input && (input as any).mode);
      if (mode) fetchOptions.mode = mode;
      
      const redirect = (init && init.redirect) || (input && (input as any).redirect);
      if (redirect) fetchOptions.redirect = redirect;
      
      return originalFetch.apply(this, [url, fetchOptions]);
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