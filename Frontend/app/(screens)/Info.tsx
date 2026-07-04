import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { Stack } from "expo-router";
import React, { useState, useRef } from "react";
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
  Modal
} from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebase";
import { BACKEND_URL } from "../../constants/config"; 
import { saveUserInfo } from "../../firebase/firebaseConfig";

export default function InfoScreen() {
  const scrollRef = useRef<ScrollView>(null);

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState("");
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [address, setAddress] = useState("");
  const [eName, setEName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  // Auto-scroll to inputs on focus
  const handleInputFocus = (yOffset: number) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: yOffset - 40, animated: true });
    }, 300);
  };

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

      const geocode = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (geocode && geocode.length > 0) {
        const addr = geocode[0];
        const parts = [
          addr.name,
          addr.street,
          addr.district,
          addr.city,
          addr.region,
          addr.country,
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

  const onMapMessage = async (event: any) => {
    try {
      const coords = JSON.parse(event.nativeEvent.data);
      if (coords.latitude && coords.longitude) {
        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude
        });
        
        const geocode = await Location.reverseGeocodeAsync({
          latitude: coords.latitude,
          longitude: coords.longitude
        });

        if (geocode && geocode.length > 0) {
          const addr = geocode[0];
          const parts = [
            addr.name,
            addr.street,
            addr.district,
            addr.city,
            addr.region,
            addr.country,
          ].filter(Boolean);
          setAddress(parts.join(", "));
        } else {
          setAddress(`Lat: ${coords.latitude.toFixed(5)}, Lng: ${coords.longitude.toFixed(5)}`);
        }
      }
    } catch (err) {
      console.log("Error parsing coordinates:", err);
    }
  };

  const handleContinue = async () => {
    if (!name || !gender || !eName || !ePhone || !location) {
      Alert.alert("Almost there!", "All fields are required. Please enter your name, date of birth, gender, sync location, and emergency contact details.");
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

      // Step 1: Save to Firestore first (this controls onboarding navigation)
      await saveUserInfo(
        user.uid,
        name,
        birthDate,
        gender,
        { latitude: location.latitude, longitude: location.longitude },
        { name: eName, phone: ePhone }
      );

      // Step 2: Sync to backend (best-effort, don't block the user)
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${BACKEND_URL}/api/info`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name,
            dob: birthDate.toISOString(),
            gender: gender,
            lat: location.latitude,
            lng: location.longitude,
            eName: eName,
            ePhone: ePhone,
          }),
        });
        if (!response.ok) {
          console.log("Backend sync returned non-OK:", response.status);
        }
      } catch (backendErr) {
        console.log("Backend sync failed (non-blocking):", backendErr);
      }
    } catch (err: any) {
      Alert.alert("Save Error", err.message || "We couldn't save your profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  let nameY = 0;
  let emergencyY = 0;

  // Generate Leaflet Map HTML dynamically for WebView
  const getMapHtml = () => {
    const lat = location?.latitude || 33.6844;
    const lng = location?.longitude || 73.0479;
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body, html, #map {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var lat = ${lat};
          var lng = ${lng};
          var map = L.map('map').setView([lat, lng], 16);
          
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);

          var marker = L.marker([lat, lng], { draggable: true }).addTo(map);

          marker.on('dragend', function (e) {
            var position = marker.getLatLng();
            window.ReactNativeWebView.postMessage(JSON.stringify({
              latitude: position.lat,
              longitude: position.lng
            }));
          });

          map.on('click', function (e) {
            marker.setLatLng(e.latlng);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              latitude: e.latlng.lat,
              longitude: e.latlng.lng
            }));
          });
        </script>
      </body>
      </html>
    `;
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FBFBFF]">
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView 
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 32, paddingBottom: 250 }} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >
          <View className="pt-12 pb-10">
            <View className="mb-10 items-center">
              <Text className="text-4xl font-light text-[#1A1C1E] tracking-tight">
                Hello, <Text className="font-bold text-[#808CEA]">Friend</Text>
              </Text>
              <Text className="text-gray-400 text-sm mt-2 text-center">Let&apos;s set up your profile to begin</Text>
            </View>

            <View className="space-y-4">
              {/* Name Field */}
              <Text className="font-bold text-gray-700 ml-1 mb-2">1. Your Full Name</Text>
              <View onLayout={(e) => { nameY = e.nativeEvent.layout.y; }}>
                <TextInput
                  placeholder="Enter your name"
                  placeholderTextColor="#9CA3AF"
                  className="bg-white px-6 py-5 rounded-3xl mb-6 border border-[#E2E8F0] text-gray-800"
                  value={name}
                  onChangeText={setName}
                  onFocus={() => handleInputFocus(nameY)}
                  style={{ fontSize: 16, color: "#1F2937" }}
                />
              </View>

              {/* DOB Field */}
              <Text className="font-bold text-gray-700 ml-1 mb-2">2. Date of Birth</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-white px-6 py-5 rounded-3xl mb-6 flex-row justify-between items-center border border-[#E2E8F0]"
              >
                <Text className="text-lg text-[#2D3748]">
                  {birthDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </Text>
                <Text className="text-[#808CEA] font-medium">Select Date</Text>
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

              {/* Gender Field */}
              <Text className="font-bold text-gray-700 ml-1 mb-2">3. Gender</Text>
              <View className="flex-row justify-between mb-6">
                {["Male", "Female", "Other"].map((g) => {
                  const isSel = gender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => setGender(g)}
                      style={{
                        backgroundColor: isSel ? "#808CEA" : "#FFFFFF",
                        borderColor: isSel ? "#808CEA" : "#E2E8F0",
                        borderWidth: 1,
                        paddingVertical: 16,
                        borderRadius: 20,
                        flex: 1,
                        marginHorizontal: 4,
                        alignItems: "center"
                      }}
                    >
                      <Text style={{ color: isSel ? "#FFFFFF" : "#1F2937", fontWeight: "bold" }}>{g}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Location Field */}
              <Text className="font-bold text-gray-700 ml-1 mb-2">4. Current Location</Text>
              <TouchableOpacity
                onPress={handleGetLocation}
                disabled={locating}
                className={`px-6 py-5 rounded-3xl mb-6 flex-row items-center justify-center border-2 border-dashed ${
                  location ? "bg-[#F0FFF4] border-[#68D391]" : "bg-[#EDF2F7] border-[#CBD5E0]"
                }`}
              >
                {locating ? <ActivityIndicator color="#808CEA" /> : <Text className="font-semibold text-gray-700">{location ? "✓ Location synced" : "📍 Enable & Sync Location"}</Text>}
              </TouchableOpacity>

              {location && (
                <View className="bg-white p-4 rounded-3xl border border-[#E2E8F0] mb-6 overflow-hidden items-center shadow-sm">
                  <Text className="text-gray-500 text-xs font-bold uppercase mb-2 self-start">Synced Address</Text>
                  <Image
                    source={{ uri: `https://static-maps.yandex.ru/1.x/?ll=${location.longitude},${location.latitude}&z=16&l=map&size=600,300&pt=${location.longitude},${location.latitude},pm2rdm` }}
                    style={{ width: "100%", height: 150, borderRadius: 16 }}
                    resizeMode="cover"
                  />
                  <Text className="text-gray-700 text-sm mt-3 mb-4 text-center px-2 font-medium">{address}</Text>
                  
                  <TouchableOpacity
                    onPress={() => setShowMapModal(true)}
                    className="bg-[#808CEA] py-3 px-6 rounded-full items-center shadow-sm w-full"
                  >
                    <Text className="text-white font-bold">🗺 Adjust Location on Map</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Emergency Contact Field */}
              <Text className="font-bold text-gray-700 ml-1 mb-2">5. Emergency Contact Details</Text>
              <View 
                className="bg-white p-6 rounded-[35px] border border-[#E2E8F0] mb-6"
                onLayout={(e) => { emergencyY = e.nativeEvent.layout.y; }}
              >
                <TextInput
                  placeholder="Emergency contact person name"
                  placeholderTextColor="#9CA3AF"
                  className="bg-[#F8FAFC] px-5 py-4 rounded-2xl mb-3 border border-[#EDF2F7] text-gray-800"
                  value={eName}
                  onChangeText={setEName}
                  onFocus={() => handleInputFocus(emergencyY)}
                  style={{ fontSize: 15, color: "#1F2937" }}
                />
                <TextInput
                  placeholder="Phone number (e.g. +923331234567)"
                  placeholderTextColor="#9CA3AF"
                  className="bg-[#F8FAFC] px-5 py-4 rounded-2xl border border-[#EDF2F7] text-gray-800"
                  keyboardType="phone-pad"
                  value={ePhone}
                  onChangeText={setEPhone}
                  onFocus={() => handleInputFocus(emergencyY + 80)}
                  style={{ fontSize: 15, color: "#1F2937" }}
                />
              </View>
            </View>

            <TouchableOpacity
              onPress={handleContinue}
              disabled={loading || locating}
              className={`py-5 mt-4 rounded-full ${loading || locating ? "bg-[#CBD5E0]" : "bg-[#808CEA]"}`}
            >
              {loading ? <ActivityIndicator color="white" /> : <Text className="text-white text-center text-xl font-semibold">Begin Journey</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* --- INTERACTIVE LEAFLET ADJUSTMENT MAP MODAL --- */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        onRequestClose={() => setShowMapModal(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row justify-between items-center px-6 py-4 border-b border-gray-100">
            <Text className="text-xl font-bold text-gray-800">Pin Your Location</Text>
            <TouchableOpacity
              onPress={() => setShowMapModal(false)}
              className="bg-[#808CEA] py-2 px-5 rounded-full"
            >
              <Text className="text-white font-bold">Done</Text>
            </TouchableOpacity>
          </View>
          <View className="flex-1">
            {location && (
              <WebView
                originWhitelist={['*']}
                source={{ html: getMapHtml() }}
                onMessage={onMapMessage}
                style={{ flex: 1 }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
              />
            )}
          </View>
          <View className="p-6 bg-slate-50 border-t border-gray-100">
            <Text className="text-gray-400 text-xs font-bold uppercase mb-1">Adjusted Address Preview</Text>
            <Text className="text-gray-700 text-sm font-medium leading-5">{address}</Text>
            <Text className="text-[11px] text-gray-400 mt-2">💡 Drag the blue marker or tap anywhere on the map to pinpoint your exact home.</Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}