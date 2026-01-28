import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebase"; // Make sure this path to your auth object is correct
import { saveUserInfo } from "../../firebase/firebaseConfig";

export default function InfoScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    // 1. Basic Validation
    if (!name || !age) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    // 2. Get current user UID
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "You must be logged in to save information.");
      return;
    }

    try {
      setLoading(true);

      // 3. Call updated saveUserInfo with the UID
      await saveUserInfo(user.uid, name, Number(age));

      // 4. Navigate to the next screen
      router.replace("/(screens)/Feel");
    } catch (e: any) {
      console.error("Firestore Save Error:", e);
      Alert.alert("Save Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 justify-center px-8">
          <Text className="text-3xl font-bold text-center mb-3">
            Tell us about you
          </Text>

          <Text className="text-center text-gray-500 mb-10">
            This helps personalize your experience
          </Text>

          <TextInput
            placeholder="Full name"
            className="bg-gray-100 px-6 py-5 rounded-full mb-5 text-lg"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            placeholder="Age"
            className="bg-gray-100 px-6 py-5 rounded-full mb-10 text-lg"
            keyboardType="numeric"
            value={age}
            onChangeText={setAge}
          />

          <TouchableOpacity
            onPress={handleContinue}
            disabled={!name || !age || loading}
            className={`py-4 rounded-full ${
              !name || !age || loading ? "bg-gray-300" : "bg-[#808CEA]"
            }`}
          >
            <Text className="text-white text-center text-lg font-semibold">
              {loading ? "Saving..." : "Continue"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
