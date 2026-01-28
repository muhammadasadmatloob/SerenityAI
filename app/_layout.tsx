import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { HeartPulse } from "lucide-react-native";
import { AnimatePresence, MotiText, MotiView } from "moti";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";
import TabBar from "./(components)/TabBar";

// Prevent the native splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

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
          delay: i * 200,
        }}
        className="w-2 h-2 bg-white rounded-full shadow-sm"
      />
    ))}
  </View>
);

export default function RootLayout() {
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Simulating asset loading
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } finally {
        setIsAppReady(true);
        // Hide the OS splash screen once our React tree is ready
        await SplashScreen.hideAsync();
      }
    }
    prepare();
  }, []);

  if (!isAppReady) return null;

  return (
    <SafeAreaProvider>
      <View className="flex-1 bg-[#55C5CC]">
        {/* Main App Content: This sits behind the splash screen initially */}
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: "transparent" },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen
            name="(auth)/auth"
            options={{
              animation: "fade",
              gestureEnabled: false,
            }}
          />
          <Stack.Screen name="(screens)/Info" />
          <Stack.Screen name="(screens)/Feel" />
          <Stack.Screen name="(screens)/Path" />
          <Stack.Screen name="(screens)/Chat" />
          <Stack.Screen name="(screens)/History" />
          <Stack.Screen name="(screens)/Profile" />
        </Stack>

        {/* Global TabBar is hidden while splash is active */}
        {!showCustomSplash && <TabBar />}

        {/* Custom Animated Splash Screen Overlay */}
        <AnimatePresence>
          {showCustomSplash && (
            <MotiView
              key="custom-splash"
              from={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "timing", duration: 800 }}
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
                  className="bg-white/10 p-10 rounded-full border border-white/20"
                >
                  <HeartPulse size={90} color="white" strokeWidth={1.2} />
                </MotiView>

                <MotiText
                  from={{ opacity: 0, translateY: 30 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: 400 }}
                  className="text-white text-6xl font-extrabold mt-12 tracking-[8px]"
                >
                  DONA AI
                </MotiText>

                <MotiView
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ delay: 800 }}
                  onDidAnimate={(name, finished) => {
                    if (finished) {
                      // Hold the completed animation for a moment then fade out
                      setTimeout(() => setShowCustomSplash(false), 1500);
                    }
                  }}
                  className="mt-6 items-center"
                >
                  <View className="bg-white/10 px-8 py-3 rounded-full border border-white/20">
                    <Text className="text-white text-lg font-light italic">
                      Your personal AI therapist
                    </Text>
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
