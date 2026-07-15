import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, ScrollView, Pressable, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { getAuth, sendPasswordResetEmail } from "firebase/auth";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    Keyboard.dismiss();
    if (!email) {
      Alert.alert("Gentle Reminder", "Please enter your email so we can help you find your way back in.");
      return;
    }

    setLoading(true);
    const auth = getAuth();

    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert(
        "Link Sent Successfully",
        "We've sent a gentle reminder with a secure link to your inbox. Please check your email to reset your password, and then come back to log in.",
        [{ text: "Return to Login", onPress: () => router.replace("/(auth)/auth?mode=login") }]
      );
    } catch (err: any) {
      console.log("Password Reset Error:", err);
      let errorTitle = "Oops!";
      let errorMessage = "Something went a little wrong. Let's take a pause and try again in a moment.";

      if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
        errorTitle = "Account Not Found";
        errorMessage = "We couldn't find a sanctuary under this email. Perhaps you haven't started your journey with us yet? We'd love for you to create an account.";
      } else if (err.code === "auth/invalid-email") {
        errorTitle = "Quick Check";
        errorMessage = "It looks like the email address isn't quite formatted correctly. Mind taking a second look?";
      }

      Alert.alert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={["#55C5CC", "#808CEA", "#A48CED"]} className="absolute inset-0" />
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 40 }}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-white text-4xl font-bold text-center mb-4 mt-10">Reset Password</Text>
            <Text className="text-white/80 text-center text-lg mb-10 leading-relaxed">
              Don't worry, it happens to the best of us. Let's get you back into your private space for healing.
            </Text>

            <TextInput
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.7)"
              className="bg-white/20 px-5 py-4 rounded-xl text-white mb-6 border border-white/10"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <TouchableOpacity onPress={handleResetPassword} disabled={loading} className="bg-white py-4 rounded-xl items-center mt-2">
              {loading ? (
                <ActivityIndicator color="#808CEA" />
              ) : (
                <Text className="font-bold text-lg text-black">Send Reset Link</Text>
              )}
            </TouchableOpacity>

            <Pressable onPress={() => router.back()} className="mt-8 pb-10">
              <Text className="text-white text-center font-medium opacity-90">Back to Login</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
