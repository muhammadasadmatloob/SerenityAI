import React, { useEffect, useState, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, MapPin, Calendar, Mail, Fingerprint } from "lucide-react-native";
import { useRouter } from "expo-router";
import { auth } from "../../firebase/firebase";
import { BACKEND_URL } from "../../constants/config";
import { saveUserInfo } from "../../firebase/firebaseConfig";

export default function ProfileInfoScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [data, setData] = useState<any>({});
  const scrollRef = useRef<ScrollView>(null);

  const loadData = async () => {
    try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`${BACKEND_URL}/api/profile/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        setData(json);
    } catch { 
        Alert.alert("Error", "Backend Unreachable."); 
    } finally { 
        setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, []);

  // Auto-scroll to the focused input so it stays visible above the keyboard
  const handleInputFocus = (yOffset: number) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: yOffset - 120, animated: true });
    }, 300);
  };

  const handleSave = async () => {
    if (!data.name || !data.eName || !data.ePhone) {
        Alert.alert("Error", "Please fill in all details.");
        return;
    }

    const phoneRegex = /^\+\d{1,4}\d{10}$/;
    if (!phoneRegex.test(data.ePhone)) {
        Alert.alert("Invalid Phone Number", "Phone number must start with + followed by the country code and exactly 10 digits (e.g., +923331234567).");
        return;
    }

    setUpdating(true);
    try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`${BACKEND_URL}/api/profile/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: data.name, emergency_name: data.eName, emergency_phone: data.ePhone })
        });
        
        if (res.ok) {
            // Dual write: sync to Firestore to ensure UI snapshot updates immediately
            const uid = auth.currentUser?.uid;
            if (uid) {
                const birthDate = data.dob && data.dob !== "Not Set" ? new Date(data.dob) : new Date();
                const location = (data.lat !== undefined && data.lng !== undefined && data.lat !== 0) ? { latitude: data.lat, longitude: data.lng } : null;
                await saveUserInfo(
                    uid,
                    data.name,
                    birthDate,
                    location,
                    { name: data.eName, phone: data.ePhone }
                );
            }
            Keyboard.dismiss();
            Alert.alert("Success", "Profile information updated.");
        } else {
            const errJson = await res.json();
            throw new Error(errJson.detail || "Server update failed.");
        }
    } catch (err: any) { 
        Alert.alert("Error", err.message || "Update failed."); 
    } finally { 
        setUpdating(false); 
    }
  };

  if (loading) return <View className="flex-1 justify-center bg-[#F8FAFC]"><ActivityIndicator size="large" color="#808CEA" /></View>;

  // Track Y positions for auto-scroll
  let nameY = 0;
  let eNameY = 0;
  let ePhoneY = 0;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView 
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: 32, paddingBottom: 200 }} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => router.back()} className="mb-6 mt-4">
              <ChevronLeft size={30} color="black" />
          </TouchableOpacity>
          
          <Text className="text-3xl font-bold mb-8 text-gray-800">Personal Details</Text>

          {/* --- READ ONLY SECTION --- */}
          <View className="bg-white p-6 rounded-3xl mb-6 shadow-sm border border-gray-100">
              <InfoRow icon={<Fingerprint size={18} color="#94A3B8"/>} label="User ID" value={data.uid} />
              <InfoRow icon={<Mail size={18} color="#94A3B8"/>} label="Email Address" value={data.email} />
              <InfoRow icon={<Calendar size={18} color="#94A3B8"/>} label="Birth Date" value={data.dob?.split('T')[0] || "Not Set"} />
              <InfoRow 
                  icon={<MapPin size={18} color="#94A3B8"/>} 
                  label="Last Synced Location" 
                  value={data.lat ? `${data.lat.toFixed(2)}, ${data.lng.toFixed(2)}` : "Not available"} 
              />
          </View>

          {/* --- EDITABLE SECTION --- */}
          <Text className="font-bold mb-2 text-gray-700 ml-1">Display Name</Text>
          <View onLayout={(e) => { nameY = e.nativeEvent.layout.y; }}>
            <TextInput 
                value={data.name} 
                onChangeText={(t) => setData({...data, name: t})} 
                onFocus={() => handleInputFocus(nameY)}
                className="bg-white p-5 rounded-2xl mb-6 border border-gray-100 shadow-sm text-gray-800" 
            />
          </View>

          <View 
            className="bg-[#808CEA]/5 p-6 rounded-3xl mb-8 border border-[#808CEA]/10"
            onLayout={(e) => { eNameY = e.nativeEvent.layout.y; }}
          >
              <Text className="font-bold mb-4 text-[#4A55A2]">Emergency Contact</Text>
              <TextInput 
                  placeholder="Contact Person Name" 
                  value={data.eName} 
                  onChangeText={(t) => setData({...data, eName: t})} 
                  onFocus={() => handleInputFocus(eNameY)}
                  className="bg-white p-4 rounded-xl mb-3 border border-gray-100 text-gray-800" 
              />
              <TextInput 
                  placeholder="Emergency Phone (e.g. +923331234567)" 
                  value={data.ePhone} 
                  onChangeText={(t) => setData({...data, ePhone: t})} 
                  onFocus={() => handleInputFocus(eNameY + 80)}
                  keyboardType="phone-pad" 
                  className="bg-white p-4 rounded-xl border border-gray-100 text-gray-800" 
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

const InfoRow = ({ icon, label, value }: any) => (
    <View className="flex-row items-center mb-4">
        <View className="w-10 h-10 items-center justify-center bg-gray-50 rounded-full mr-4">
            {icon}
        </View>
        <View className="flex-1">
            <Text className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">{label}</Text>
            <Text className="text-gray-600 font-medium" numberOfLines={1}>{value}</Text>
        </View>
    </View>
);