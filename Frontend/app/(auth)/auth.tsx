import { sendEmailVerification } from "firebase/auth";
import { loginWithEmail, signupWithEmail } from "../../firebase/firebaseConfig";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View, ActivityIndicator, TouchableOpacity, KeyboardAvoidingView, ScrollView, Platform, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BACKEND_URL } from "../../constants/config";


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
    Keyboard.dismiss();
    if (!email || !password || (!isLogin && !confirmPassword)) {
      Alert.alert("Gentle Reminder", "Please fill in all the details so we can continue.");
      return;
    }

    if (!isLogin) {
      if (password !== confirmPassword) {
        Alert.alert("Almost There", "It looks like your passwords don't quite match. Let's try typing them again.");
        return;
      }
      
      try {
        setLoading(true);
        const valRes = await fetch(`${BACKEND_URL}/api/auth/validate-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password })
        });
        const valData = await valRes.json();
        if (!valRes.ok || !valData.success) {
          Alert.alert("For Your Privacy", valData.message || "Please choose a slightly stronger password to keep your space secure.");
          setLoading(false);
          return;
        }
      } catch (err: any) {
        console.log("Password validation request failed, falling back to local checks:", err);
        if (password.length < 8) {
          Alert.alert("Gentle Reminder", "To keep your space secure, please make your password at least 8 characters long.");
          setLoading(false);
          return;
        }
        if (!/[A-Z]/.test(password)) {
          Alert.alert("Gentle Reminder", "Please include at least one uppercase letter to strengthen your password.");
          setLoading(false);
          return;
        }
        if (!/[a-z]/.test(password)) {
          Alert.alert("Gentle Reminder", "Please include at least one lowercase letter to strengthen your password.");
          setLoading(false);
          return;
        }
        if (!/\d/.test(password)) {
          Alert.alert("Gentle Reminder", "Please add at least one number to help protect your account.");
          setLoading(false);
          return;
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
          Alert.alert("Gentle Reminder", "Please add a special character (like ! or @) to make your password even more secure.");
          setLoading(false);
          return;
        }
      } finally {
        setLoading(false);
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
            Alert.alert("Welcome to Serenity", "Your email isn't verified yet. We've sent a gentle reminder to your inbox with a verification link.");
          } catch (resendErr) {
            console.log("Auto-resend verification failed:", resendErr);
          }
          router.replace("/(screens)/EmailVerify");
          return;
        }
        // Let _layout.tsx handle the transition to Welcome screen via onSnapshot to prevent double routing
        // router.replace({ pathname: "/(screens)/Welcome", params: { mode: "login" } });
      } else {
        await signupWithEmail(email, password, confirmPassword);
        router.replace("/(screens)/EmailVerify");
      }
    } catch (err: any) {
      if (err.message === "EMAIL_NOT_VERIFIED") {
        router.replace("/(screens)/EmailVerify");
        return;
      }
      
      let errorTitle = "Oops!";
      let errorMessage = "Something went a little wrong. Let's take a pause and try again in a moment.";

      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        errorTitle = "Let's try that again";
        errorMessage = "Hmm, those details don't seem quite right. Take a breath and double-check your email and password.";
      } else if (err.code === "auth/invalid-email") {
        errorTitle = "Quick Check";
        errorMessage = "It looks like the email address isn't quite formatted correctly. Mind taking a second look?";
      } else if (err.code === "auth/email-already-in-use") {
        errorTitle = "Welcome Back";
        errorMessage = "It looks like an account already exists with this email. Please try logging in instead.";
      } else if (err.code === "auth/weak-password") {
        errorTitle = "For Your Privacy";
        errorMessage = "Please choose a slightly stronger password to keep your Serenity space secure.";
      } else if (err.code === "auth/network-request-failed") {
        errorTitle = "Connection Interrupted";
        errorMessage = "We're having trouble connecting right now. Take a moment and try again when your connection returns.";
      } else if (err.code === "auth/too-many-requests") {
        errorTitle = "Take a Pause";
        errorMessage = "There have been a few too many attempts. Please wait a moment before trying again.";
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
        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 40 }}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            <Text className="text-white text-4xl font-bold text-center mb-8 mt-10">Your Private Space{"\n"}For Healing</Text>
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
            <TouchableOpacity onPress={handleSubmit} disabled={loading} className="bg-white py-4 rounded-xl items-center mt-2">
              {loading ? <ActivityIndicator color="#808CEA" /> : <Text className="font-bold text-lg text-black">{isLogin ? "Login" : "Create Account"}</Text>}
            </TouchableOpacity>
            
            {isLogin && (
              <Pressable onPress={() => router.push("/(auth)/ForgotPassword")} className="mt-4">
                <Text className="text-white text-center font-medium opacity-90">Forgot Password?</Text>
              </Pressable>
            )}
            <Pressable onPress={() => router.setParams({ mode: isLogin ? "signup" : "login" })} className="mt-10 pb-10">
              <Text className="text-white text-center">{isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}