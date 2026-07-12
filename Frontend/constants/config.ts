import Constants from 'expo-constants';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import * as Linking from 'expo-linking';

const STORAGE_KEY = "SERENITY_BACKEND_URL";

// Helper to extract the developer's server IP from various Expo runtime variables
const getDevServerIp = (): string | null => {
  // 1. Try Linking URL (most reliable in modern Expo development)
  try {
    const url = Linking.createURL('/');
    if (url) {
      const match = url.match(/:\/\/(.*?)(?::|\/|$)/);
      if (match && match[1]) {
        const ip = match[1];
        if (ip && ip !== 'localhost' && ip !== '127.0.0.1' && !ip.startsWith('10.0.2.')) {
          console.log("🔍 config: Resolved Dev Server IP from Linking:", ip);
          return ip;
        }
      }
    }
  } catch (err) {
    console.log("⚠️ config: Error resolving IP from Linking:", err);
  }

  // 2. Try Expo Go Launch Metadata
  const metadata = (Constants as any).expoGoLaunchMetadata;
  if (metadata?.debuggerHost) {
    const ip = metadata.debuggerHost.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      console.log("🔍 config: Resolved Dev Server IP from expoGoLaunchMetadata:", ip);
      return ip;
    }
  }

  // 3. Try Manifest2 (Expo Go)
  const manifest2 = (Constants as any).manifest2;
  const debuggerHost2 = manifest2?.extra?.expoGoLaunchMetadata?.debuggerHost;
  if (debuggerHost2) {
    const ip = debuggerHost2.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      console.log("🔍 config: Resolved Dev Server IP from manifest2:", ip);
      return ip;
    }
  }

  // 4. Try legacy manifest
  const manifest = (Constants as any).manifest;
  if (manifest?.debuggerHost) {
    const ip = manifest.debuggerHost.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      console.log("🔍 config: Resolved Dev Server IP from legacy manifest:", ip);
      return ip;
    }
  }

  // 5. Try expoConfig.hostUri
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      console.log("🔍 config: Resolved Dev Server IP from expoConfig.hostUri:", ip);
      return ip;
    }
  }

  return null;
};

const devIp = getDevServerIp();

const getEnvValue = (value: any, defaultValue: string): string => {
  if (!value || value === "undefined" || value === "null" || typeof value !== "string") {
    return defaultValue;
  }
  return value.trim();
};

export const PRODUCTION_URL = getEnvValue(process.env.EXPO_PUBLIC_PRODUCTION_URL, "https://serenityai-93qt.onrender.com");

// Initial URL setup (fallback defaults)
let initialUrl = PRODUCTION_URL;

export let BACKEND_URL = initialUrl;


export const setBackendUrl = (url: string) => {
  BACKEND_URL = url;
  console.log("🔄 config: BACKEND_URL dynamically updated to:", url);
};

// Heartbeat function to verify if an IP hosts the Donna AI Backend
const checkBackendOnline = async (url: string, timeoutMs: number = 2000): Promise<boolean> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Poll the /api/health endpoint
    const healthUrl = url.endsWith('/') ? `${url}api/health` : `${url}/api/health`;
    const res = await fetch(healthUrl, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      clearTimeout(timeoutId);
      if (data && data.status === "ok") {
        return true;
      }
    }
  } catch {
    // Ignore errors
  }
  clearTimeout(timeoutId);
  return false;
};

// Synchronization mechanism for RootLayout (Splash Screen blocking)
let isDiscoveryDone = false;
let discoveryPromiseResolve: (() => void) | null = null;
const discoveryPromise = new Promise<void>((resolve) => {
  discoveryPromiseResolve = resolve;
});

export const waitForBackendDiscovery = () => discoveryPromise;

// Autodiscovery function
const runAutoDiscovery = async () => {
  try {
    // 1. Primary Check: Render production URL (allowing spin-up/cold start)
    console.log("🔎 config: Trying primary Render production URL:", PRODUCTION_URL);
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔎 config: Attempt ${attempt}/${maxRetries} to connect to primary Render backend...`);
      if (await checkBackendOnline(PRODUCTION_URL, 10000)) {
        setBackendUrl(PRODUCTION_URL);
        await AsyncStorage.setItem(STORAGE_KEY, PRODUCTION_URL);
        return;
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    // 2. Fallback Check: Dev Server IP or Localhost
    const fallbackUrl = devIp ? `http://${devIp}:8000` : "http://localhost:8000";
    console.log("🔎 config: Trying fallback dev backend URL:", fallbackUrl);
    if (await checkBackendOnline(fallbackUrl, 3000)) {
      setBackendUrl(fallbackUrl);
      await AsyncStorage.setItem(STORAGE_KEY, fallbackUrl);
      return;
    }

    console.log("❌ config: Both primary and fallback URLs failed to connect.");
  } catch (err) {
    console.log("⚠️ config: Autodiscovery Error:", err);
  }
};

export const checkInternetConnection = async (): Promise<boolean> => {
  try {
    const state = await Network.getNetworkStateAsync();
    return !!(state.isConnected && state.isInternetReachable);
  } catch (e) {
    console.log("⚠️ config: Error checking internet connection:", e);
    return false;
  }
};

// Heartbeat function to verify if BACKEND_URL is still online
// If offline, it triggers a subnet sweep in development mode.
export const verifyAndDiscover = async () => {
  console.log("🔍 config: Checking backend status at current BACKEND_URL:", BACKEND_URL);
  
  // Disable autodiscovery and developer IP checks completely in Production builds
  if (!__DEV__) {
    console.log("🚀 config: Running in PRODUCTION mode. Locking URL to secure production endpoint:", PRODUCTION_URL);
    setBackendUrl(PRODUCTION_URL);
    if (!isDiscoveryDone) {
      isDiscoveryDone = true;
      if (discoveryPromiseResolve) {
        discoveryPromiseResolve();
      }
    }
    return;
  }

  const checkTimeout = BACKEND_URL === PRODUCTION_URL ? 10000 : 2000;
  const isOnline = await checkBackendOnline(BACKEND_URL, checkTimeout);

  if (isOnline) {
    console.log("✅ config: Backend is online, no discovery needed.");
    // Cache the URL
    await AsyncStorage.setItem(STORAGE_KEY, BACKEND_URL);
  } else {
    console.log("❌ config: Backend is offline. Starting autodiscovery...");
    await runAutoDiscovery();
  }

  // Resolve sync promise so layout knows discovery has ended
  if (!isDiscoveryDone) {
    isDiscoveryDone = true;
    if (discoveryPromiseResolve) {
      discoveryPromiseResolve();
    }
  }
};

// Start verification and autodiscovery process asynchronously on boot
verifyAndDiscover();

// Re-verify and discover whenever the app returns to the foreground (network change, unlock, app switch, etc.)
AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
  if (nextAppState === 'active') {
    console.log("📱 config: App foregrounded, checking backend status...");
    verifyAndDiscover();
  }
});