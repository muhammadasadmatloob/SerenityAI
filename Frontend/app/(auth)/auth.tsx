import { sendEmailVerification } from "firebase/auth";
import { loginWithEmail, signupWithEmail } from "../../firebase/firebaseConfig";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AuthScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode: "login" | "signup" }>();
  const isLogin = mode !== "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && !confirmPassword)) {
      Alert.alert("Missing fields", "Please fill all fields");
      return;
    }

    if (!isLogin) {
      if (password !== confirmPassword) {
        Alert.alert("Mismatch", "Passwords do not match");
        return;
      }
      if (password.length < 8) {
        Alert.alert("Weak Password", "Password must be at least 8 characters long.");
        return;
      }
      if (!/[A-Z]/.test(password)) {
        Alert.alert("Weak Password", "Password must contain at least one uppercase letter (A-Z).");
        return;
      }
      if (!/[a-z]/.test(password)) {
        Alert.alert("Weak Password", "Password must contain at least one lowercase letter (a-z).");
        return;
      }
      if (!/\d/.test(password)) {
        Alert.alert("Weak Password", "Password must contain at least one number (0-9).");
        return;
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        Alert.alert("Weak Password", "Password must contain at least one special character (e.g., !, @, #, $, %, &, *).");
        return;
      }
    }

    try {
      setLoading(true);
      if (isLogin) {
        const userCredential = await loginWithEmail(email, password);
        const user = userCredential.user;
        if (!user.emailVerified) {
          try {
            await sendEmailVerification(user);
            Alert.alert("Verification Sent", "Your email is not verified. A new verification link has been sent to your inbox.");
          } catch (resendErr) {
            console.log("Auto-resend verification failed:", resendErr);
          }
          router.replace("/(screens)/EmailVerify");
          return;
        }
      } else {
        await signupWithEmail(email, password, confirmPassword);
        router.replace("/(screens)/EmailVerify");
      }
    } catch (err: any) {
      if (err.message === "EMAIL_NOT_VERIFIED") {
        router.replace("/(screens)/EmailVerify");
        return;
      }
      const friendlyError = err.code?.split("/")[1]?.replace(/-/g, " ") || err.message;
      Alert.alert("Entry Denied", friendlyError.toUpperCase());
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1">
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={["#55C5CC", "#808CEA", "#A48CED"]} className="absolute inset-0" />
      <SafeAreaView className="flex-1 px-10 justify-center">
        <Text className="text-white text-4xl font-bold text-center mb-8">Your Private Space{"\n"}For Healing</Text>
        <TextInput 
            placeholder="Email" 
            placeholderTextColor="rgba(255,255,255,0.7)" 
            className="bg-white/20 px-5 py-4 rounded-xl text-white mb-4 border border-white/10" 
            autoCapitalize="none" 
            value={email} 
            onChangeText={setEmail} 
        />
        <View className="relative mb-4">
          <TextInput 
            placeholder="Password" 
            placeholderTextColor="rgba(255,255,255,0.7)" 
            secureTextEntry={!showPassword} 
            className="bg-white/20 px-5 py-4 rounded-xl text-white pr-14 border border-white/10" 
            value={password} 
            onChangeText={setPassword} 
          />
          <Pressable onPress={() => setShowPassword(!showPassword)} className="absolute right-4 top-4">
            {showPassword ? <EyeOff color="white" size={20} /> : <Eye color="white" size={20} />}
          </Pressable>
        </View>
        {!isLogin && (
            <TextInput 
                placeholder="Confirm Password" 
                placeholderTextColor="rgba(255,255,255,0.7)" 
                secureTextEntry={!showPassword} 
                className="bg-white/20 px-5 py-4 rounded-xl text-white mb-6 border border-white/10" 
                value={confirmPassword} 
                onChangeText={setConfirmPassword} 
            />
        )}
        <TouchableOpacity onPress={handleSubmit} disabled={loading} className="bg-white py-4 rounded-xl items-center">
          {loading ? <ActivityIndicator color="#808CEA" /> : <Text className="font-bold text-lg text-black">{isLogin ? "Login" : "Create Account"}</Text>}
        </TouchableOpacity>
        <Pressable onPress={() => router.setParams({ mode: isLogin ? "signup" : "login" })} className="mt-10">
          <Text className="text-white text-center">{isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}