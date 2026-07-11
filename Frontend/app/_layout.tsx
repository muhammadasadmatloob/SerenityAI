import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { AnimatePresence, MotiText, MotiView } from "moti";
import { useEffect, useState, useRef } from "react";
import { Text, View, Dimensions, Image, StyleSheet, TouchableOpacity, LogBox, DeviceEventEmitter } from "react-native";
import * as Network from "expo-network";
import * as SecureStore from "expo-secure-store";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { auth, db } from "../firebase/firebase";
import { waitForBackendDiscovery, BACKEND_URL } from "../constants/config";
import "../global.css";
import TabBar from "./(components)/TabBar";

// Intercept Firestore connection timeout/offline messages and downgrade them from Error to Warning,
// preventing them from opening the React Native error/RedBox screen.
if (__DEV__) {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const message = args.map(arg => (arg && typeof arg === 'object' ? String(arg.message || JSON.stringify(arg)) : String(arg))).join(" ");
    if (
      message.includes("Could not reach Cloud Firestore backend") || 
      message.includes("@firebase/firestore") ||
      message.includes("Firestore (12")
    ) {
      console.warn("Firestore Connection Warning (Downgraded from error to prevent app overlay):", ...args);
      return;
    }
    originalConsoleError(...args);
  };

  // Ignore the yellow box warning as well for maximum cleanliness
  LogBox.ignoreLogs([
    "Could not reach Cloud Firestore backend",
    "@firebase/firestore",
  ]);
}

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

const { width } = Dimensions.get("window");

const DotLoader = () => (
  <View className="flex-row gap-2 items-center justify-center mt-6">
    {[0, 1, 2].map((i) => (
      <MotiView
        key={i}
        from={{ opacity: 0.3, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1.2 }}
        transition={{ 
          type: "timing", 
          duration: 600, 
          loop: true, 
          repeatReverse: true, 
          delay: i * 200 
        }}
        className="w-2 h-2 bg-white rounded-full shadow-sm"
      />
    ))}
  </View>
);

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);
  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState<boolean | null>(null);
  const [networkError, setNetworkError] = useState<boolean>(false);
  const [retryTrigger, setRetryTrigger] = useState(0);
  const [splashMessage] = useState("Your personal AI therapist");
  const [user, setUser] = useState<any>(null);
  const unsubSnap = useRef<(() => void) | null>(null);

  // 1. TabBar Visibility Logic
  // TabBar appears ONLY on the primary navigation hubs.
  const currentScreen = segments[segments.length - 1];
  const screensWithTabBar = ["Chat", "History", "Profile"];
  const isTabBarVisible = screensWithTabBar.includes(currentScreen || "");

  // 1b. Background Style Logic
  // Certain screens use a solid white background (#F8FAFC) instead of the ambient gradient background.
  const screensWithWhiteBg = ["Chat", "History", "Profile", "ProfileInfo", "Settings"];
  const isWhiteBg = screensWithWhiteBg.includes(currentScreen || "");

  // 2. Backend URL Discovery & Auth listener initialization
  useEffect(() => {
    // 1. Check Network Connectivity immediately on mount
    async function checkConnectivity() {
      try {
        const state = await Network.getNetworkStateAsync();
        if (!state.isConnected) {
          setNetworkError(true);
          setIsAppReady(true);
          SplashScreen.hideAsync();
        }
      } catch (e) {
        console.log("Error checking network status:", e);
      }
    }
    checkConnectivity();

    const privacyListener = DeviceEventEmitter.addListener("PRIVACY_ACCEPTED", () => {
      setHasAcceptedPrivacy(true);
    });

    // 1b. Check Privacy Status
    async function checkPrivacy() {
      try {
        const val = await SecureStore.getItemAsync("HAS_ACCEPTED_PRIVACY");
        setHasAcceptedPrivacy(val === "true");
      } catch {
        setHasAcceptedPrivacy(false);
      }
    }
    checkPrivacy();

    // 2. Concurrently initiate background URL discovery & warmups (non-blocking)
    async function discoverBackend() {
      try {
        await Promise.race([
          waitForBackendDiscovery(),
          new Promise((resolve) => setTimeout(resolve, 60000))
        ]);
        console.log("🚀 _layout: Backend discovery finished.");
        
        // Quietly ping backend to warm it up
        fetch(`${BACKEND_URL}/`, { method: 'GET' }).catch(() => {});
      } catch (e) {
        console.log("Backend discovery error:", e);
      }
    }
    discoverBackend();

    // 3. Register Auth Listener immediately to restore user session from AsyncStorage
    const unsubAuth = onAuthStateChanged(auth, async (authUser) => {
      // Clean up previous Firestore listener if user changes
      if (unsubSnap.current) { 
        unsubSnap.current(); 
        unsubSnap.current = null; 
      }

      if (authUser) {
        setUser(authUser);
        setIsProfileComplete(null); // Force navigation guard to wait for DB snapshot
        // Trigger background cleanup of leftover sessions
        authUser.getIdToken().then((token) => {
          fetch(`${BACKEND_URL}/api/session/end-all-active`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          }).catch((err) => console.log("Failed to auto-end leftover sessions", err));
        }).catch(() => {});

        // Reload user to get the latest emailVerified status from Firebase
        if (!authUser.emailVerified) {
          try {
            await authUser.reload();
            const reloadedUser = auth.currentUser || authUser;
            setUser(reloadedUser);
            authUser = reloadedUser;
          } catch (e) {
            console.log("Failed to reload user verification status:", e);
          }
        }

        // Listen to the user's document for real-time onboarding completion status
        unsubSnap.current = onSnapshot(doc(db, "users", authUser.uid), (snap) => {
          const data = snap.data();
          const complete = !!(snap.exists() && data?.isOnboardingComplete === true);
          setIsProfileComplete(complete);
          setIsAppReady(true);
          SplashScreen.hideAsync();
        }, (error) => {
          console.log("⚠️ _layout: onSnapshot error:", error);
          // Fallback to false if document doesn't exist
          setIsProfileComplete(false);
          setIsAppReady(true);
          SplashScreen.hideAsync();
        });
      } else {
        setUser(null);
        setIsProfileComplete(false);
        setIsAppReady(true);
        SplashScreen.hideAsync();
      }
    });

    return () => { 
      unsubAuth();
      if (unsubSnap.current) unsubSnap.current(); 
      privacyListener.remove();
    };
  }, [retryTrigger]);

  // 2b. Transition custom splash screen once app is ready and no network errors are present
  useEffect(() => {
    if (isAppReady && !networkError && showCustomSplash) {
      // Allow splash to stay visible briefly for animation to complete
      const timer = setTimeout(() => {
        setShowCustomSplash(false);
      }, 4000); // 4 seconds timeout as requested
      return () => clearTimeout(timer);
    }
  }, [isAppReady, networkError, showCustomSplash]);

  const handleRetry = () => {
    setNetworkError(false);
    setRetryTrigger((prev) => prev + 1);
  };

  // 3. Navigation Guard (The Traffic Controller)
  useEffect(() => {
    if (!isAppReady || isProfileComplete === null || networkError || hasAcceptedPrivacy === null) return;

    const currentScreen = segments[segments.length - 1];
    const inAuthGroup = segments[0] === "(auth)";
    const onVerifyScreen = currentScreen === "EmailVerify";
    const onInfoScreen = currentScreen === "Info";
    const onPrivacyScreen = (currentScreen as string) === "index" || (segments.length as number) === 0;

    if (!hasAcceptedPrivacy) {
      if (!onPrivacyScreen) router.replace("/");
    } else if (!user) {
      // Redirect to Auth if not logged in
      if (!inAuthGroup) router.replace("/(auth)/auth");
    } else if (!user.emailVerified) {
      // Force Email Verification
      if (!onVerifyScreen) router.replace("/(screens)/EmailVerify");
    } else if (isProfileComplete === false) {
      // Force Profile Info completion
      if (!onInfoScreen) router.replace("/(screens)/Info");
    } else if (isProfileComplete === true) {
      // Redirect to main app flow if coming from setup screens
      const isOnSetupScreen = inAuthGroup || onVerifyScreen || onInfoScreen || onPrivacyScreen;
      if (isOnSetupScreen) router.replace("/(screens)/Feel");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAppReady, isProfileComplete, segments, networkError, user, hasAcceptedPrivacy]);

  if (!isAppReady) return null;

  return (
    <SafeAreaProvider>
      <View className="flex-1">
        {/* Global Ambient Gradient Background or Static White Background */}
        {!isWhiteBg ? (
          <>
            <LinearGradient 
              colors={["#55C5CC", "#808CEA", "#A48CED"]} 
              locations={[0, 0.52, 1]} 
              style={StyleSheet.absoluteFillObject} 
            />

            {/* Global Calming Breathing Brain Animation */}
            <MotiView
              from={{ scale: 0.95, opacity: 0.15 }}
              animate={{ scale: 1.05, opacity: 0.25 }}
              transition={{
                type: "timing",
                duration: 4000,
                loop: true,
                repeatReverse: true,
              }}
              style={{ position: 'absolute', top: '8%', alignSelf: 'center' }}
            >
              <Image
                source={require("../assets/images/brain.png")}
                style={{ width: width * 0.8, height: width * 0.8 }}
                resizeMode="contain"
              />
            </MotiView>
          </>
        ) : (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#F8FAFC' }]} />
        )}

        {/* Main Navigation Stack */}
        <Stack screenOptions={{ 
          headerShown: false, 
          animation: "fade",
          contentStyle: { backgroundColor: 'transparent' }
        }}>
          <Stack.Screen name="(auth)/auth" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(screens)/EmailVerify" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(screens)/Info" options={{ gestureEnabled: false }} />
          <Stack.Screen name="(screens)/Feel" options={{ gestureEnabled: false }} />
          {/* New Sub-screens for Profile */}
          <Stack.Screen name="(screens)/ProfileInfo" options={{ animation: "fade" }} />
          <Stack.Screen name="(screens)/Settings" options={{ animation: "fade" }} />
        </Stack>

        {/* Global TabBar - Only shown when splash is gone and on main pages */}
        {!showCustomSplash && isProfileComplete && isTabBarVisible && <TabBar />}

        {/* Custom Animated Splash Screen */}
        <AnimatePresence>
          {showCustomSplash && (
            <MotiView
              key="custom-splash"
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[999]"
            >
              <LinearGradient 
                colors={["#55C5CC", "#808CEA", "#A48CED"]} 
                locations={[0, 0.52, 1]} 
                className="absolute inset-0" 
              />
              <View className="flex-1 items-center justify-center">
                <MotiView 
                  from={{ scale: 0, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring" }}
                >
                  <Image
                    source={require("../assets/images/icon.png")}
                    style={{ width: 120, height: 120, borderRadius: 30 }}
                    resizeMode="contain"
                  />
                </MotiView>
                
                <MotiText 
                  from={{ opacity: 0, translateY: 30 }} 
                  animate={{ opacity: 1, translateY: 0 }} 
                  transition={{ delay: 400 }} 
                  className="text-white text-5xl font-extrabold mt-12 tracking-[6px]"
                >
                  SERENITY AI
                </MotiText>
                
                {networkError ? (
                  <MotiView
                    from={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-8 items-center px-6"
                  >
                    <View className="bg-white/10 border border-white/20 px-8 py-5 rounded-2xl items-center max-w-[85%]">
                      <Text className="text-white text-lg font-bold text-center mb-1">
                        Network Connectivity Error
                      </Text>
                      <Text className="text-white/80 text-sm text-center mb-5">
                        Please check your internet connection and try again.
                      </Text>
                      <TouchableOpacity
                        onPress={handleRetry}
                        activeOpacity={0.85}
                        className="bg-white px-6 py-2.5 rounded-full shadow-md"
                      >
                        <Text className="text-[#808CEA] font-extrabold text-sm">
                          Retry Connection
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </MotiView>
                ) : (
                  <MotiView 
                    from={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    transition={{ delay: 800 }}
                    className="mt-6 items-center"
                  >
                    <View className="bg-white/10 px-8 py-3 rounded-full border border-white/20">
                      <Text className="text-white text-lg font-light italic">{splashMessage}</Text>
                    </View>
                    <DotLoader />
                  </MotiView>
                )}
              </View>
            </MotiView>
          )}
        </AnimatePresence>
      </View>
    </SafeAreaProvider>
  );
}