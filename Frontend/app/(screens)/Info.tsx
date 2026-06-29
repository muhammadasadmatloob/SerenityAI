import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  const [address, setAddress] = useState("");
  const [eName, setEName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const handleGetLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "To provide the best support, we need your location permission.");
        return;
      }
      
      const currentLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const lat = currentLoc.coords.latitude;
      const lng = currentLoc.coords.longitude;
      
      setLocation({
        latitude: lat,
        longitude: lng,
      });

      // Reverse geocode to get the exact address
      const geocode = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (geocode && geocode.length > 0) {
        const addr = geocode[0];
        const parts = [
          addr.name,       // house/building name
          addr.street,     // street
          addr.district,   // subregion
          addr.city,       // city
          addr.region,     // state
          addr.country,    // country
        ].filter(Boolean);
        const fullAddr = parts.join(", ");
        setAddress(fullAddr || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);
      } else {
        setAddress(`Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`);
      }
    } catch (err) {
      console.log(err);
      Alert.alert("Location Error", "We couldn't retrieve your location. Make sure GPS is enabled.");
    } finally {
      setLocating(false);
    }
  };

  const handleContinue = async () => {
    if (!name || !eName || !ePhone || !location) {
      Alert.alert("Almost there!", "Please fill in all details.");
      return;
    }

    const phoneRegex = /^\+\d{1,4}\d{10}$/;
    if (!phoneRegex.test(ePhone)) {
      Alert.alert("Invalid Phone Number", "Phone number must start with + followed by the country code and exactly 10 digits (e.g., +923331234567).");
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
                className={`px-6 py-5 rounded-3xl mb-4 flex-row items-center justify-center border-2 border-dashed ${
                  location ? "bg-[#F0FFF4] border-[#68D391]" : "bg-[#EDF2F7] border-[#CBD5E0]"
                }`}
              >
                {locating ? <ActivityIndicator color="#808CEA" /> : <Text className="font-semibold text-gray-700">{location ? "✓ Location synced" : "📍 Enable Location"}</Text>}
              </TouchableOpacity>

              {location && (
                <View className="bg-white p-4 rounded-3xl border border-[#E2E8F0] mb-4 overflow-hidden items-center shadow-sm">
                  <Text className="text-gray-500 text-xs font-bold uppercase mb-2 self-start">Location Details</Text>
                  <Image
                    source={{ uri: `https://static-maps.yandex.ru/1.x/?ll=${location.longitude},${location.latitude}&z=16&l=map&size=600,300&pt=${location.longitude},${location.latitude},pm2rdm` }}
                    style={{ width: "100%", height: 150, borderRadius: 16 }}
                    resizeMode="cover"
                  />
                  <Text className="text-gray-700 text-sm mt-3 text-center px-2 font-medium">{address}</Text>
                </View>
              )}

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