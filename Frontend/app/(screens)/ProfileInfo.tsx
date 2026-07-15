import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Keyboard, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, MapPin, Calendar, Mail, User, Navigation, Home } from "lucide-react-native";
import { useRouter } from "expo-router";
import { auth } from "../../firebase/firebase";
import { BACKEND_URL } from "../../constants/config";
import { saveUserInfo } from "../../firebase/firebaseConfig";
import * as Location from 'expo-location';

export default function ProfileInfoScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [data, setData] = useState<any>({});
  
  // Locations
  const [savedAddress, setSavedAddress] = useState("Locating...");
  const [currentAddress, setCurrentAddress] = useState("Locating...");
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const loadData = async () => {
    try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`${BACKEND_URL}/api/profile/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        setData(json);

        // Fetch saved address from stored lat/lng
        if (json.lat && json.lng && json.lat !== 0) {
            const geocode = await Location.reverseGeocodeAsync({
                latitude: json.lat,
                longitude: json.lng
            });
            if (geocode && geocode.length > 0) {
                const addr = geocode[0];
                const parts = [addr.name, addr.district, addr.city, addr.country].filter(Boolean);
                setSavedAddress(parts.join(", "));
            } else {
                setSavedAddress(`Lat: ${json.lat.toFixed(4)}, Lng: ${json.lng.toFixed(4)}`);
            }
        } else {
            setSavedAddress("Location not saved");
        }
    } catch { 
        Alert.alert("Connection Interrupted", "We couldn't reach the server right now. Let's try again in a bit."); 
    } finally { 
        setLoading(false); 
    }
  };

  useEffect(() => { 
    loadData(); 

    let locationSubscription: Location.LocationSubscription | null = null;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setCurrentAddress("Permission Denied");
        return;
      }
      locationSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        async (loc) => {
          setCurrentLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          const [place] = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude
          });
          if (place) {
            const formatted = [place.name, place.district, place.city, place.country].filter(Boolean).join(", ");
            setCurrentAddress(formatted);
          } else {
            setCurrentAddress(`${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);
          }
        }
      );
    })();
    return () => {
      if (locationSubscription) locationSubscription.remove();
    };
  }, []);

  // Auto-scroll to the focused input so it stays visible above the keyboard
  const handleInputFocus = (yOffset: number) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: yOffset - 120, animated: true });
    }, 300);
  };

  const handleSave = async () => {
    if (!data.name || !data.eName || !data.ePhone) {
        Alert.alert("Almost there!", "We just need a few more details from you. Please fill in all the blanks.");
        return;
    }

    if (!data.ePhone.startsWith("+")) {
        Alert.alert("Gentle Reminder", "Please start your emergency phone number with a '+' and your country code.");
        return;
    }

    if (data.ePhone.startsWith("+92") && data.ePhone.length !== 13) {
        Alert.alert("Gentle Reminder", "Pakistani numbers (+92) must have exactly 10 digits after the country code (e.g. +923331234567).");
        return;
    }

    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(data.ePhone)) {
        Alert.alert("Gentle Reminder", "Please enter a valid phone number with your country code and digits.");
        return;
    }

    setUpdating(true);
    try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`${BACKEND_URL}/api/profile/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: data.name, gender: data.gender, emergency_name: data.eName, emergency_phone: data.ePhone })
        });
        
        if (res.ok) {
            const uid = auth.currentUser?.uid;
            if (uid) {
                const birthDate = data.dob && data.dob !== "Not Set" ? new Date(data.dob) : new Date();
                const location = (data.lat !== undefined && data.lng !== undefined && data.lat !== 0) ? { latitude: data.lat, longitude: data.lng } : null;
                await saveUserInfo(
                    uid,
                    data.name,
                    birthDate,
                    data.gender || "Not Set",
                    location,
                    { name: data.eName, phone: data.ePhone }
                );
            }
            Keyboard.dismiss();
            Alert.alert("All Set!", "Your profile information has been beautifully updated.");
        } else {
            const errJson = await res.json();
            throw new Error(errJson.detail || "Server update failed.");
        }
    } catch (err: any) { 
        Alert.alert("Oops", err.message || "We had a little trouble updating your profile. Please try again."); 
    } finally { 
        setUpdating(false); 
    }
  };

  if (loading) return <View className="flex-1 justify-center bg-[#F8FAFC]"><ActivityIndicator size="large" color="#808CEA" /></View>;

  // Format DOB correctly to local timezone
  let formattedDob = "Not Set";
  if (data.dob && data.dob !== "Not Set") {
    try {
      // The backend returns a naive datetime (e.g. "2004-10-17T19:00:00").
      // Appending 'Z' forces it to be treated as UTC, which accurately reverses 
      // the .toISOString() conversion applied when saving, restoring the exact local day.
      const dobString = data.dob.includes('Z') ? data.dob : data.dob + 'Z';
      const d = new Date(dobString);
      formattedDob = d.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      formattedDob = data.dob.split('T')[0];
    }
  }

  let nameY = 0;
  let genderY = 0;
  let eNameY = 0;

  return (
    <SafeAreaView className="flex-1 bg-[#F8FAFC]">
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView 
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-row items-center mt-6 mb-8">
            <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm border border-gray-100">
                <ChevronLeft size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold ml-4 text-gray-800 tracking-tight">Your Details</Text>
          </View>

          {/* --- READ ONLY SECTION --- */}
          <Text className="font-bold text-gray-800 text-lg mb-4 ml-2">Personal Identity</Text>
          <View className="bg-white p-6 rounded-[30px] mb-8 shadow-sm border border-gray-100">
              <InfoRow icon={<Mail size={18} color="#808CEA"/>} label="Email Address" value={data.email} />
              <InfoRow icon={<Calendar size={18} color="#808CEA"/>} label="Birth Date" value={formattedDob} />
              <InfoRow icon={<User size={18} color="#808CEA"/>} label="Gender" value={data.gender || "Not Set"} noBorder />
          </View>

          <Text className="font-bold text-gray-800 text-lg mb-4 ml-2">Location Identity</Text>
          <View className="bg-white p-6 rounded-[30px] mb-8 shadow-sm border border-gray-100">
              <InfoRow 
                  icon={<Home size={18} color="#808CEA"/>} 
                  label="Home Sanctuary" 
                  value={savedAddress} 
              />
              <InfoRow 
                  icon={<Navigation size={18} color="#808CEA"/>} 
                  label="Current Presence" 
                  value={currentAddress} 
                  noBorder
              />
              {currentLocation && (
                  <View className="mt-4 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                      <Image
                        source={{ uri: `https://static-maps.yandex.ru/1.x/?ll=${currentLocation.lng},${currentLocation.lat}&z=15&l=map&size=600,300&pt=${currentLocation.lng},${currentLocation.lat},pm2rdm` }}
                        style={{ width: "100%", height: 160 }}
                        resizeMode="cover"
                      />
                  </View>
              )}
          </View>

          {/* --- EDITABLE SECTION --- */}
          <Text className="font-bold text-gray-800 text-lg mb-4 ml-2">Update Profile</Text>
          <View className="bg-white p-6 rounded-[30px] mb-8 shadow-sm border border-gray-100">
            <Text className="font-bold mb-2 text-gray-700 ml-1">Display Name</Text>
            <View onLayout={(e) => { nameY = e.nativeEvent.layout.y; }}>
              <TextInput 
                  value={data.name} 
                  onChangeText={(t) => setData({...data, name: t})} 
                  onFocus={() => handleInputFocus(nameY)}
                  className="bg-[#F8FAFC] p-4 rounded-2xl mb-6 border border-[#E2E8F0] text-gray-800 font-medium" 
              />
            </View>

            <Text className="font-bold mb-2 text-gray-700 ml-1">Gender</Text>
            <View className="flex-row justify-between mb-2" onLayout={(e) => { genderY = e.nativeEvent.layout.y; }}>
              {["Male", "Female", "Other"].map((g) => {
                const isSel = data.gender === g;
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => {
                      setData({...data, gender: g});
                      handleInputFocus(genderY);
                    }}
                    style={{
                      backgroundColor: isSel ? "#808CEA" : "#F8FAFC",
                      borderColor: isSel ? "#808CEA" : "#E2E8F0",
                      borderWidth: 1,
                      paddingVertical: 14,
                      borderRadius: 16,
                      flex: 1,
                      marginHorizontal: 4,
                      alignItems: "center"
                    }}
                  >
                    <Text style={{ color: isSel ? "#FFFFFF" : "#1F2937", fontWeight: "600" }}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Text className="font-bold text-[#4A55A2] text-lg mb-4 ml-2">Emergency Contact</Text>
          <View 
            className="bg-[#808CEA]/5 p-6 rounded-[30px] mb-8 border border-[#808CEA]/20"
            onLayout={(e) => { eNameY = e.nativeEvent.layout.y; }}
          >
              <Text className="text-sm text-gray-500 mb-4 ml-1">Who should we contact in an emergency?</Text>
              <TextInput 
                  placeholder="Contact Person Name" 
                  value={data.eName} 
                  onChangeText={(t) => setData({...data, eName: t})} 
                  onFocus={() => handleInputFocus(eNameY)}
                  className="bg-white p-4 rounded-2xl mb-4 border border-[#808CEA]/20 text-gray-800 font-medium shadow-sm" 
              />
              <TextInput 
                  placeholder="Emergency Phone (e.g. +923331234567)" 
                  value={data.ePhone} 
                  onChangeText={(t) => setData({...data, ePhone: t})} 
                  onFocus={() => handleInputFocus(eNameY + 80)}
                  keyboardType="phone-pad" 
                  className="bg-white p-4 rounded-2xl border border-[#808CEA]/20 text-gray-800 font-medium shadow-sm" 
              />
          </View>

          <TouchableOpacity 
              onPress={handleSave} 
              disabled={updating}
              className="bg-[#808CEA] p-5 rounded-full items-center mb-10 shadow-lg shadow-[#808CEA]/30"
          >
              {updating ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Save Changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const InfoRow = ({ icon, label, value, noBorder }: any) => (
    <View className={`flex-row items-center py-3 ${noBorder ? '' : 'border-b border-gray-50 mb-3'}`}>
        <View className="w-10 h-10 items-center justify-center bg-[#808CEA]/10 rounded-full mr-4">
            {icon}
        </View>
        <View className="flex-1">
            <Text className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">{label}</Text>
            <Text className="text-gray-700 font-semibold" numberOfLines={2}>{value}</Text>
        </View>
    </View>
);