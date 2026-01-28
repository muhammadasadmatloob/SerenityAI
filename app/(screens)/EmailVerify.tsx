import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { auth } from "../../firebase/firebase";
import { resendVerificationEmail } from "../../firebase/firebaseConfig";

export default function EmailVerify() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) {
      router.replace("../(auth)/auth?mode=signup");
    }
  });

  const checkVerification = async () => {
    setChecking(true);
    await auth.currentUser?.reload();

    if (auth.currentUser?.emailVerified) {
      router.replace("/(screens)/Info");
    } else {
      Alert.alert("Not verified", "Please verify your email first");
    }

    setChecking(false);
  };

  return (
    <View className="flex-1 justify-center items-center px-8 bg-white">
      <Text className="text-3xl font-bold mb-4">Verify your email</Text>

      <Text className="text-center text-gray-600 mb-8">
        We sent a verification link to your email.
      </Text>

      <TouchableOpacity
        onPress={checkVerification}
        className="bg-[#808CEA] px-10 py-4 rounded-full mb-4"
      >
        <Text className="text-white font-semibold">
          {checking ? "Checking..." : "I have verified"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={resendVerificationEmail}>
        <Text className="text-[#808CEA] underline">Resend email</Text>
      </TouchableOpacity>
    </View>
  );
}
