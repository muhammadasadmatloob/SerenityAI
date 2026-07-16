import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView, MotiText } from "moti";
import { Heart } from "lucide-react-native";

export default function Welcome() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const isSignup = mode === "signup";

  const quotes = {
    login: [
      "Every journey begins with a single step. Welcome back.",
      "Take a deep breath. You are exactly where you need to be.",
      "Healing is a matter of time, but it is sometimes also a matter of opportunity."
    ],
    signup: [
      "Welcome to Serenity. Your safe space awaits.",
      "A journey of a thousand miles begins with a single step. Welcome.",
      "You have taken the first step towards a more mindful you."
    ]
  };

  const [quote, setQuote] = useState("");

  useEffect(() => {
    const quoteList = isSignup ? quotes.signup : quotes.login;
    setQuote(quoteList[Math.floor(Math.random() * quoteList.length)]);

    const timer = setTimeout(() => {
      router.replace("/(screens)/Feel");
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#55C5CC", "#808CEA", "#A48CED"]} style={StyleSheet.absoluteFill} />
      
      <MotiView
        from={{ opacity: 0, scale: 0.8, translateY: 20 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 1000, ease: "easeOut" } as any}
        style={styles.content}
      >
        <Heart size={48} color="#FFFFFF" style={{ marginBottom: 24, alignSelf: 'center' }} />
        
        <Text style={styles.title}>
          {isSignup ? "Welcome to Serenity" : "Welcome Back"}
        </Text>
        
        <MotiText
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "timing", duration: 1000, delay: 500 }}
          style={styles.quote}
        >
          "{quote}"
        </MotiText>
      </MotiView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    paddingHorizontal: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 24,
    fontFamily: "System",
  },
  quote: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 28,
  }
});
