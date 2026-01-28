import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReusableButton from "../(components)/button";

import {
  forgotPassword,
  loginWithEmail,
  signupWithEmail,
} from "../../firebase/firebaseConfig";

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

    try {
      setLoading(true);

      if (isLogin) {
        await loginWithEmail(email, password);
        router.replace("../(screens)/Feel");
      } else {
        await signupWithEmail(email, password, confirmPassword);
        router.replace("../(screens)/EmailVerify");
      }
    } catch (err: any) {
      if (err.message === "EMAIL_NOT_VERIFIED") {
        router.replace("../(screens)/EmailVerify");
        return;
      }
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert("Enter email", "Please enter your email first");
      return;
    }
    await forgotPassword(email);
    Alert.alert("Email sent", "Password reset link sent to your email");
  };

  return (
    <View className="flex-1">
      <Stack.Screen options={{ animation: "fade" }} />

      <LinearGradient
        colors={["#55C5CC", "#808CEA", "#A48CED"]}
        className="absolute inset-0"
      />

      <SafeAreaView className="flex-1 px-10 pb-10">
        <View className="flex-1 justify-center">
          <Text className="text-white text-4xl font-bold text-center mb-3">
            Your Private Space{"\n"}For Healing
          </Text>

          <Text className="text-white/90 text-center mb-10">
            {isLogin ? "Login to continue" : "Create a new account"}
          </Text>

          {/* EMAIL */}
          <TextInput
            placeholder="Email"
            placeholderTextColor="#eee"
            className="bg-white/20 px-5 py-4 rounded-xl text-white mb-4"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          {/* PASSWORD */}
          <View className="relative mb-4">
            <TextInput
              placeholder="Password"
              placeholderTextColor="#eee"
              secureTextEntry={!showPassword}
              className="bg-white/20 px-5 py-4 rounded-xl text-white pr-14"
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-4"
            >
              {showPassword ? <EyeOff color="white" /> : <Eye color="white" />}
            </Pressable>
          </View>

          {/* CONFIRM PASSWORD */}
          {!isLogin && (
            <TextInput
              placeholder="Confirm Password"
              placeholderTextColor="#eee"
              secureTextEntry={!showPassword}
              className="bg-white/20 px-5 py-4 rounded-xl text-white mb-6"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          )}

          {/* BUTTON */}
          <ReusableButton
            onPress={handleSubmit}
            disabled={loading}
            className="bg-white py-4 rounded-xl"
          >
            <Text className="text-black font-semibold text-lg">
              {loading ? "Please wait..." : isLogin ? "Login" : "Signup"}
            </Text>
          </ReusableButton>

          {/* FORGOT PASSWORD */}
          {isLogin && (
            <Pressable onPress={handleForgotPassword} className="mt-4">
              <Text className="text-white text-center underline">
                Forgot password?
              </Text>
            </Pressable>
          )}

          {/* SWITCH MODE */}
          <Pressable
            onPress={() =>
              router.setParams({ mode: isLogin ? "signup" : "login" })
            }
            className="mt-10"
          >
            <Text className="text-white text-center">
              {isLogin
                ? "Don’t have an account? Signup"
                : "Already have an account? Login"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
