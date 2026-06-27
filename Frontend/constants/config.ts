import Constants from 'expo-constants';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, AppState, AppStateStatus } from 'react-native';
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

export const PRODUCTION_URL = "https://serenityai-93qt.onrender.com";

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
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      clearTimeout(timeoutId);
      // Backend home route / returns {"status": "Donna AI Backend is Online" or similar}
      if (data && data.status && data.status.toLowerCase().includes("donna")) {
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
    // 0. Prioritize the Render production backend URL first (with a longer timeout to allow cold start / spin up)
    console.log("🔎 config: Trying Render production backend URL (allowing spin-up):", PRODUCTION_URL);
    if (await checkBackendOnline(PRODUCTION_URL, 15000)) {
      setBackendUrl(PRODUCTION_URL);
      await AsyncStorage.setItem(STORAGE_KEY, PRODUCTION_URL);
      return;
    }

    // 1. Try to load cached successful URL from AsyncStorage
    const cachedUrl = await AsyncStorage.getItem(STORAGE_KEY);
    if (cachedUrl && cachedUrl !== PRODUCTION_URL) {
      console.log("🔎 config: Trying cached backend URL:", cachedUrl);
      if (await checkBackendOnline(cachedUrl, 2000)) {
        setBackendUrl(cachedUrl);
        return;
      }
    }


    // 2. Try the resolved dev server IP
    if (devIp) {
      const devUrl = `http://${devIp}:8000`;
      console.log("🔎 config: Trying dev server IP URL:", devUrl);
      if (await checkBackendOnline(devUrl, 2000)) {
        setBackendUrl(devUrl);
        await AsyncStorage.setItem(STORAGE_KEY, devUrl);
        return;
      }
    }

    // 3. Try Emulator Loopbacks
    const androidEmulatorUrl = "http://10.0.2.2:8000";
    if (Platform.OS === 'android' && devIp !== "10.0.2.2") {
      if (await checkBackendOnline(androidEmulatorUrl, 1500)) {
        setBackendUrl(androidEmulatorUrl);
        await AsyncStorage.setItem(STORAGE_KEY, androidEmulatorUrl);
        return;
      }
    }

    const iosSimulatorUrl = "http://localhost:8000";
    if (Platform.OS === 'ios' && devIp !== "localhost") {
      if (await checkBackendOnline(iosSimulatorUrl, 1500)) {
        setBackendUrl(iosSimulatorUrl);
        await AsyncStorage.setItem(STORAGE_KEY, iosSimulatorUrl);
        return;
      }
    }

    // 4. Scan current local subnet dynamically (IPv4 fallback only to avoid IPv6 errors)
    const ipAddress = await Network.getIpAddressAsync();
    if (ipAddress && ipAddress !== "0.0.0.0" && ipAddress !== "127.0.0.1" && !ipAddress.includes(":")) {
      console.log("📱 config: Device IP Address:", ipAddress);
      
      const lastDotIndex = ipAddress.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        const subnetPrefix = ipAddress.substring(0, lastDotIndex);
        console.log(`🌐 config: Scanning subnet: ${subnetPrefix}.x`);

        // Generate IP sweep range (1 to 254)
        const ipTargets: string[] = [];
        for (let i = 1; i <= 254; i++) {
          const targetIp = `${subnetPrefix}.${i}`;
          // Don't scan the device's own IP
          if (targetIp !== ipAddress) {
            ipTargets.push(targetIp);
          }
        }

        // Run sweep checks in parallel batches of 50 to avoid socket resource exhaustion
        // 300ms is standard timeout for local network sweep
        const BATCH_SIZE = 50;
        const PING_TIMEOUT = 300;
        for (let i = 0; i < ipTargets.length; i += BATCH_SIZE) {
          const batch = ipTargets.slice(i, i + BATCH_SIZE);
          
          // Execute batch checks
          const results = await Promise.all(
            batch.map(async (ip) => {
              const url = `http://${ip}:8000`;
              const isOnline = await checkBackendOnline(url, PING_TIMEOUT);
              return { url, isOnline };
            })
          );

          // Check if any IP in this batch succeeded
          const successfulTarget = results.find(r => r.isOnline);
          if (successfulTarget) {
            const discoveredUrl = successfulTarget.url;
            console.log("🎉 config: Discovered backend at:", discoveredUrl);
            setBackendUrl(discoveredUrl);
            await AsyncStorage.setItem(STORAGE_KEY, discoveredUrl);
            return;
          }
        }
      }
    }
  } catch (err) {
    console.log("⚠️ config: Autodiscovery Error:", err);
  }
};

// Heartbeat function to verify if BACKEND_URL is still online
// If offline, it triggers a subnet sweep.
export const verifyAndDiscover = async () => {
  console.log("🔍 config: Checking backend status at current BACKEND_URL:", BACKEND_URL);
  const checkTimeout = BACKEND_URL === PRODUCTION_URL ? 5000 : 2000;
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