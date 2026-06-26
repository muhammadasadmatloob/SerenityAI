import { LogBox } from "react-native";

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

import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { HeartPulse } from "lucide-react-native";
import { AnimatePresence, MotiText, MotiView } from "moti";
import { useEffect, useState, useRef } from "react";
import { Text, View, Dimensions, Image, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { auth, db } from "../firebase/firebase"; 
import { waitForBackendDiscovery } from "../constants/config";
import "../global.css";
import TabBar from "./(components)/TabBar";

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
    let unsubAuth: (() => void) | null = null;

    async function initializeApp() {
      try {
        // Wait for the backend URL discovery to complete or timeout after 3.5s
        await Promise.race([
          waitForBackendDiscovery(),
          new Promise((resolve) => setTimeout(resolve, 3500))
        ]);
        console.log("🚀 _layout: Backend discovery completed/timed out, proceeding with auth setup.");
      } catch (e) {
        console.log("⚠️ _layout: Error during backend URL discovery:", e);
      }

      unsubAuth = onAuthStateChanged(auth, (user) => {
        // Clean up previous Firestore listener if user changes
        if (unsubSnap.current) { 
          unsubSnap.current(); 
          unsubSnap.current = null; 
        }

        if (user) {
          // Listen to the user's document for real-time profile completion status
          unsubSnap.current = onSnapshot(doc(db, "users", user.uid), (snap) => {
            setIsProfileComplete(!!(snap.exists() && snap.data()?.name));
            setIsAppReady(true);
            SplashScreen.hideAsync();
          }, () => {
            setIsProfileComplete(false);
            setIsAppReady(true);
            SplashScreen.hideAsync();
          });
        } else {
          setIsProfileComplete(false);
          setIsAppReady(true);
          SplashScreen.hideAsync();
        }
      });
    }

    initializeApp();

    return () => { 
      if (unsubAuth) (unsubAuth as () => void)(); 
      if (unsubSnap.current) unsubSnap.current(); 
    };
  }, []);

  // 3. Navigation Guard (The Traffic Controller)
  useEffect(() => {
    if (!isAppReady || isProfileComplete === null || showCustomSplash) return;

    const inAuthGroup = segments[0] === "(auth)";
    const onVerifyScreen = segments[segments.length - 1] === "EmailVerify";
    const onInfoScreen = segments[segments.length - 1] === "Info";
    const user = auth.currentUser;

    if (!user) {
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
      const isOnSetupScreen = inAuthGroup || onVerifyScreen || onInfoScreen;
      if (isOnSetupScreen) router.replace("/(screens)/Feel");
    }
  }, [isAppReady, isProfileComplete, segments, showCustomSplash]);

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
                  <HeartPulse size={90} color="white" strokeWidth={1.2} />
                </MotiView>
                
                <MotiText 
                  from={{ opacity: 0, translateY: 30 }} 
                  animate={{ opacity: 1, translateY: 0 }} 
                  transition={{ delay: 400 }} 
                  className="text-white text-6xl font-extrabold mt-12 tracking-[8px]"
                >
                  DONNA AI
                </MotiText>
                
                <MotiView 
                  from={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  transition={{ delay: 800 }}
                  onDidAnimate={(_, finished) => { 
                    if (finished) {
                      // Allow splash to stay visible for 0.5 seconds before fading
                      setTimeout(() => setShowCustomSplash(false), 500); 
                    }
                  }}
                  className="mt-6 items-center"
                >
                  <View className="bg-white/10 px-8 py-3 rounded-full border border-white/20">
                    <Text className="text-white text-lg font-light italic">Your personal AI therapist</Text>
                  </View>
                  <DotLoader />
                </MotiView>
              </View>
            </MotiView>
          )}
        </AnimatePresence>
      </View>
    </SafeAreaProvider>
  );
}