import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { View, Text, Alert, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView, MotiText } from "moti";
import { auth } from "../../firebase/firebase";
import { BACKEND_URL } from "../../constants/config";
import { Heart } from "lucide-react-native";

const QUOTES = [
  "Take a deep breath. You are safe here.",
  "Healing is a journey, not a destination.",
  "Every step forward is a step toward peace.",
  "Your feelings are valid, and you are heard.",
  "Connecting with your personal therapist...",
  "Give yourself permission to rest.",
  "You are stronger than you think."
];

export default function ConnectingScreen() {
  const router = useRouter();
  const { mood, description, path } = useLocalSearchParams();
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [pulsingValue] = useState(new Animated.Value(1));

  // Pulse animation for the heart icon
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulsingValue, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulsingValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Cycle through quotes every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((prev) => (prev + 1) % QUOTES.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Connect to the backend
  useEffect(() => {
    let isMounted = true;
    const connectToSession = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          Alert.alert("Error", "Login expired.");
          if (isMounted) router.replace("/(screens)/Feel");
          return;
        }

        const token = await user.getIdToken();
        const maxRetries = 3;
        let lastError = "";

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const controller = new AbortController();
            const timeoutMs = attempt === 1 ? 15000 : 30000;
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(`${BACKEND_URL}/api/session/start`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ 
                mood: mood || "neutral", 
                description: description || "",
                path: path || undefined
              }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            const result = await response.json();

            if (response.ok && result.session_id) {
              if (isMounted) {
                router.replace({
                  pathname: "/(screens)/Chat",
                  params: { 
                    sessionId: result.session_id.toString(), 
                    firstMessage: result.first_message 
                  }
                });
              }
              return;
            } else {
              lastError = result.message || result.detail || "Server returned an error.";
            }
          } catch (fetchErr: any) {
            if (fetchErr.name === "AbortError") {
              lastError = "Request timed out. The server may be starting up.";
            } else {
              lastError = fetchErr.message || "Network request failed.";
            }
          }

          // Wait before retrying
          if (attempt < maxRetries && isMounted) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }

        if (isMounted) {
          Alert.alert("Connection Failed", `${lastError}\n\nPlease check your internet connection and try again.`);
          router.replace("/(screens)/Feel");
        }
      } catch (err: any) {
        if (isMounted) {
          Alert.alert("Error", err.message || "Something went wrong. Please try again.");
          router.replace("/(screens)/Feel");
        }
      }
    };

    connectToSession();
    return () => { isMounted = false; };
  }, []);

  return (
    <View className="flex-1">
      <LinearGradient
        colors={["#E2E8F0", "#FFFFFF", "#E2E8F0"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      
      <SafeAreaView className="flex-1 justify-center items-center px-8">
        <MotiView
          from={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 800 }}
          className="items-center w-full"
        >
          <Animated.View style={{ transform: [{ scale: pulsingValue }] }} className="mb-10">
            <View className="w-24 h-24 rounded-full bg-white items-center justify-center shadow-xl border-4 border-indigo-50">
              <Heart size={40} color="#4A55A2" fill="#4A55A2" />
            </View>
          </Animated.View>

          <Text className="text-[#4A55A2] text-xl font-bold uppercase tracking-widest mb-16">
            Connecting
          </Text>

          <View className="h-32 w-full justify-center items-center">
            {QUOTES.map((quote, idx) => (
              quoteIndex === idx && (
                <MotiText
                  key={idx}
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  exit={{ opacity: 0, translateY: -20 }}
                  transition={{ type: "timing", duration: 800 }}
                  className="text-2xl text-center font-medium text-gray-700 leading-tight absolute w-full"
                >
                  "{quote}"
                </MotiText>
              )
            ))}
          </View>
        </MotiView>
      </SafeAreaView>
    </View>
  );
}
