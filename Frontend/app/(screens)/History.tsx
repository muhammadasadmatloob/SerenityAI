import { MotiView } from "moti";
import React, { useState, useCallback } from "react";
import { ScrollView, Text, View, ActivityIndicator, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebase";
import { BACKEND_URL } from "../../constants/config";
import { Trash2, Calendar, ChevronRight, MessageCircle } from "lucide-react-native";
import { useRouter, useFocusEffect } from "expo-router";


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

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      
      const token = await user.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (res.ok) {
        setHistory(data);
      }
    } catch (e) {
      console.error("Network error fetching history:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const handleDeleteSession = (id: number) => {
    Alert.alert(
      "Delete Session",
      "Are you sure you want to permanently delete this session and all its messages?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (!user) return;
              const token = await user.getIdToken();
              const res = await fetch(`${BACKEND_URL}/api/session/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
              });
              if (res.ok) {
                setHistory(prev => prev.filter(item => item.id !== id));
              } else {
                Alert.alert("Error", "Could not delete session.");
              }
            } catch (err) {
              console.error("Delete error:", err);
              Alert.alert("Error", "Network error. Try again.");
            }
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1 bg-transparent">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Modern Header */}
        <View className="px-8 pt-8 pb-4">
          <Text className="text-[34px] font-extrabold text-slate-800 tracking-tight">Your Journey</Text>
          <Text className="text-slate-500 text-[15px] font-medium mt-1.5">Reflect on your past sessions and growth</Text>
        </View>
        
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <View className="w-16 h-16 rounded-full bg-white items-center justify-center shadow-sm border border-slate-100">
              <ActivityIndicator size="large" color="#76C1CE" />
            </View>
          </View>
        ) : (
          <ScrollView 
              className="flex-1 px-4" 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 10, paddingBottom: 100 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#76C1CE"]} tintColor="#76C1CE" />
              }
          >
            {history.length === 0 ? (
              <MotiView 
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="items-center justify-center mt-24 px-8"
              >
                  <View className="w-24 h-24 rounded-[32px] bg-white items-center justify-center mb-6 shadow-sm border border-slate-100">
                    <MessageCircle size={40} color="#76C1CE" strokeWidth={1.5} />
                  </View>
                  <Text className="text-slate-800 font-extrabold text-[22px] text-center mb-3 tracking-tight">No History Yet</Text>
                  <Text className="text-slate-500 text-[15px] text-center leading-6">Your past therapy sessions will appear here. Start a new session with Donna to begin your journey.</Text>
              </MotiView>
            ) : (
              history.map((item, i) => (
                <MotiView 
                  key={item.id} 
                  from={{ opacity: 0, translateY: 25 }} 
                  animate={{ opacity: 1, translateY: 0 }} 
                  transition={{ delay: i * 80, type: "timing", duration: 350 }}
                  style={{
                    shadowColor: "#76C1CE",
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 16,
                    elevation: 5
                  }}
                  className="mb-4 mx-2"
                >
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/(screens)/Chat", params: { sessionId: item.id.toString() } })}
                    activeOpacity={0.7}
                    className="bg-white rounded-[28px] overflow-hidden border border-slate-100/50 p-4 flex-row items-center"
                  >
                    {/* Left Icon/Emoji Container */}
                    <View className="w-[64px] h-[64px] rounded-[20px] bg-[#F8FAFC] items-center justify-center mr-4 border border-slate-100">
                      <Text className="text-[32px]">{moodMap[item.mood] || "🌱"}</Text>
                    </View>
                    
                    {/* Content */}
                    <View className="flex-1 justify-center py-1">
                      <View className="flex-row items-center justify-between mb-1.5">
                        <View className="flex-row items-center bg-[#F0FDF4] px-2.5 py-1 rounded-lg border border-[#DCFCE7]">
                          <Calendar size={12} color="#22C55E" style={{ marginRight: 4 }} />
                          <Text className="text-[#16A34A] font-bold text-[10px] uppercase tracking-widest">{item.date}</Text>
                        </View>
                        
                        <TouchableOpacity
                          onPress={() => handleDeleteSession(item.id)}
                          className="p-1.5 bg-red-50 rounded-full"
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Trash2 size={14} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                      <Text className="text-[17px] font-extrabold capitalize text-slate-800 tracking-tight mb-1">{item.mood} Session</Text>
                      <Text className="text-slate-500 text-[13px] leading-[18px]" numberOfLines={1}>
                        {item.snippet}
                      </Text>
                    </View>

                    {/* Right Chevron */}
                    <View className="ml-3 w-9 h-9 rounded-full bg-slate-50 items-center justify-center border border-slate-100 shadow-sm">
                      <ChevronRight size={18} color="#94A3B8" />
                    </View>
                  </TouchableOpacity>
                </MotiView>
              ))
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}