import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebase";

// Import your automated network config
import { BACKEND_URL } from "../../constants/config"; 

// ✅ IMPORT FIX: Pull in saveUserInfo to unblock the layout guard
import { saveUserInfo } from "../../firebase/firebaseConfig";

export default function InfoScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [eName, setEName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const handleGetLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "To provide the best support, we need your general area.");
        return;
      }
      const currentLoc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: currentLoc.coords.latitude,
        longitude: currentLoc.coords.longitude,
      });
    } catch {
      Alert.alert("Connection Error", "We couldn't reach the GPS.");
    } finally {
      setLocating(false);
    }
  };

  const handleContinue = async () => {
    if (!name || !eName || !ePhone || !location) {
      Alert.alert("Almost there!", "Please fill in all details.");
      return;
    }
    
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Session Error", "Please log in again.");
      return;
    }

    try {
      setLoading(true);
      const token = await user.getIdToken();

      // Step 1: Write profile details to your Python Backend + Neon SQL
      const response = await fetch(`${BACKEND_URL}/api/info`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name,
          dob: birthDate.toISOString(),
          lat: location.latitude,
          lng: location.longitude,
          eName: eName,
          ePhone: ePhone,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        // ✅ STEP 2: Dual Write synchronization to Firestore.
        // This instantly triggers the onSnapshot listener inside _layout.tsx,
        // setting isProfileComplete to true and clean-routing you to the Feel screen.
        await saveUserInfo(
          user.uid,
          name,
          birthDate,
          { latitude: location.latitude, longitude: location.longitude },
          { name: eName, phone: ePhone }
        );

        // The layout guard will safely handle transition routing now!
      } else {
        throw new Error(result.detail || "Server sync failed.");
      }
    } catch (err: any) {
      Alert.alert("Sync Error", err.message || "We couldn't save your profile to the database.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FBFBFF]">
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
          <View className="px-8 pt-12 pb-10">
            <View className="mb-10 items-center">
              <Text className="text-4xl font-light text-[#1A1C1E] tracking-tight">
                Hello, <Text className="font-bold text-[#808CEA]">Friend</Text>
              </Text>
            </View>

            <View className="space-y-4">
              <TextInput
                placeholder="How should I call you?"
                className="bg-white px-6 py-5 rounded-3xl mb-4 text-lg border border-[#E2E8F0] text-gray-800"
                value={name}
                onChangeText={setName}
              />

              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-white px-6 py-5 rounded-3xl mb-4 flex-row justify-between items-center border border-[#E2E8F0]"
              >
                <Text className="text-lg text-[#2D3748]">
                  {birthDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </Text>
                <Text className="text-[#808CEA] font-medium">Date of Birth</Text>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={birthDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={new Date()}
                  onChange={(_, date) => {
                    setShowDatePicker(false);
                    if (date) setBirthDate(date);
                  }}
                />
              )}

              <TouchableOpacity
                onPress={handleGetLocation}
                disabled={locating}
                className={`px-6 py-5 rounded-3xl mb-8 flex-row items-center justify-center border-2 border-dashed ${
                  location ? "bg-[#F0FFF4] border-[#68D391]" : "bg-[#EDF2F7] border-[#CBD5E0]"
                }`}
              >
                {locating ? <ActivityIndicator color="#808CEA" /> : <Text className="font-semibold text-gray-700">{location ? "✓ Location synced" : "📍 Enable Location"}</Text>}
              </TouchableOpacity>

              <View className="bg-white p-6 rounded-[40px] border border-[#E2E8F0]">
                <TextInput
                  placeholder="Emergency contact name"
                  className="bg-[#F8FAFC] px-5 py-4 rounded-2xl mb-3 border border-[#EDF2F7] text-gray-800"
                  value={eName}
                  onChangeText={setEName}
                />
                <TextInput
                  placeholder="Their phone number"
                  className="bg-[#F8FAFC] px-5 py-4 rounded-2xl border border-[#EDF2F7] text-gray-800"
                  keyboardType="phone-pad"
                  value={ePhone}
                  onChangeText={setEPhone}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleContinue}
              disabled={loading || locating}
              className={`py-5 mt-10 rounded-full ${loading || locating ? "bg-[#CBD5E0]" : "bg-[#808CEA]"}`}
            >
              {loading ? <ActivityIndicator color="white" /> : <Text className="text-white text-center text-xl font-semibold">Begin Journey</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}