import { signOut } from "firebase/auth";
import { ChevronRight, User, LogOut, Settings } from "lucide-react-native";
import React, { useState, useCallback } from "react";
import { Alert, Image, Text, TouchableOpacity, View, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebase";
import { useRouter, useFocusEffect } from "expo-router";
import { BACKEND_URL } from "../../constants/config";

const moodMap: Record<string, string> = {
  anxious: "😰",
  sad: "😔",
  angry: "😡",
  exhausted: "🥱",
  lonely: "🥺",
  neutral: "😐",
  happy: "😊", 
  thinking: "🤔", 
  crying: "😢", 
  grimacing: "😬", 
  grinning: "😆"
};

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const fetchProfile = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/profile/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch (e) { 
        console.error(e);
    } finally { 
        setLoading(false); 
        setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  if (loading) return <View className="flex-1 justify-center"><ActivityIndicator size="large" color="#808CEA" /></View>;

  return (
    <SafeAreaView className="flex-1 bg-transparent">
      <ScrollView 
        className="px-8 pt-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} />}
      >
        <View className="items-center mb-8">
          <View className="w-28 h-28 rounded-full border-4 border-white shadow-xl overflow-hidden bg-white mb-4">
             <Image source={require("../../assets/images/profile-avatar.png")} className="w-full h-full" />
          </View>
          <Text className="text-3xl font-bold text-gray-800">{stats?.name}</Text>
        </View>

        <View className="flex-row justify-between mb-10">
          <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }} className="p-6 rounded-3xl w-[47%] items-center shadow-sm border border-gray-100">
            <Text className="text-2xl font-bold text-[#4A55A2]">{stats?.total_sessions}</Text>
            <Text className="text-gray-400 text-xs uppercase font-bold">Sessions</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }} className="p-6 rounded-3xl w-[47%] items-center shadow-sm border border-gray-100">
            <Text className="text-3xl">{moodMap[stats?.last_mood] || "😐"}</Text>
            <Text className="text-gray-400 text-xs uppercase font-bold">Last Mood</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => router.push("/(screens)/ProfileInfo")} style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }} className="flex-row items-center p-5 rounded-2xl mb-4 shadow-sm border border-gray-100">
          <User size={22} color="#4A55A2" />
          <Text className="flex-1 ml-4 font-semibold text-gray-700">Profile Info</Text>
          <ChevronRight size={20} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(screens)/Settings")} style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }} className="flex-row items-center p-5 rounded-2xl mb-4 shadow-sm border border-gray-100">
          <Settings size={22} color="#4A55A2" />
          <Text className="flex-1 ml-4 font-semibold text-gray-700">Settings</Text>
          <ChevronRight size={20} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => auth.signOut()} className="flex-row items-center bg-red-50 p-5 rounded-2xl shadow-sm mt-4">
          <LogOut size={22} color="#EF4444" />
          <Text className="flex-1 ml-4 font-semibold text-red-500">Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}