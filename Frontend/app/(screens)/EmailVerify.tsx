import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import { auth } from "../../firebase/firebase";
import { resendVerificationEmail } from "../../firebase/firebaseConfig";

export default function EmailVerify() {
  const router = useRouter();
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          clearInterval(interval);
          router.replace("/(screens)/Info");
        }
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [router]);

  const handleResend = async () => {
    try {
      setResending(true);
      await resendVerificationEmail();
      Alert.alert("On Its Way", "We've sent a gentle reminder to your inbox with the link.");
    } catch (error: any) {
      Alert.alert("Oops", "We couldn't send the email right now. Please try again in a moment.");
    } finally {
      setResending(false);
    }
  };

  return (
    <View className="flex-1 justify-center items-center px-8 bg-white">
      <View className="bg-[#808CEA]/10 p-8 rounded-full mb-6">
        <Text className="text-6xl">✉️</Text>
      </View>
      <Text className="text-3xl font-bold mb-4">Verify your email</Text>
      <Text className="text-center text-gray-500 mb-8 leading-6">
        {"We've sent a link to "}{auth.currentUser?.email}.{"\n"}Please verify it to secure your private space.
      </Text>
      <ActivityIndicator color="#808CEA" className="mb-4" />
      <Text className="text-gray-400 italic mb-10 text-center">Checking for verification automatically...</Text>
      <TouchableOpacity onPress={handleResend} disabled={resending} className="bg-[#808CEA] px-10 py-4 rounded-full mb-6 w-full">
        <Text className="text-white font-semibold text-center text-lg">{resending ? "Sending..." : "Resend Email"}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => auth.signOut()}>
        <Text className="text-gray-400 font-medium">Cancel and Logout</Text>
      </TouchableOpacity>
    </View>
  );
}