import { MotiView } from "moti";
import React, { useState, useCallback } from "react";
import { ScrollView, Text, View, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebase";
import { BACKEND_URL } from "../../constants/config";
import { Trash2 } from "lucide-react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

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
      <SafeAreaView className="flex-1">
        <Text className="text-4xl font-extrabold px-8 pt-8 mb-6 text-gray-800">Your Journey</Text>
        
        {loading ? (
          <View className="flex-1 justify-center">
            <ActivityIndicator size="large" color="#808CEA" />
          </View>
        ) : (
          <ScrollView 
              className="px-6" 
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#808CEA"]} tintColor="#808CEA" />
              }
          >
            {history.length === 0 ? (
              <View className="items-center mt-20">
                  <Text className="text-gray-400 text-lg text-center">No entries found yet.{"\n"}Start a session to see your history!</Text>
              </View>
            ) : (
              history.map((item, i) => (
                <MotiView 
                  key={item.id} 
                  from={{ opacity: 0, translateX: -20 }} 
                  animate={{ opacity: 1, translateX: 0 }} 
                  transition={{ delay: i * 100 }}
                  className="bg-white/95 rounded-[32px] mb-5 border border-white/40 overflow-hidden"
                >
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/(screens)/Chat", params: { sessionId: item.id.toString() } })}
                    activeOpacity={0.7}
                    className="p-6"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center">
                            <Text className="text-3xl mr-3">{moodMap[item.mood] || "🌱"}</Text>
                            <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest">{item.date}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleDeleteSession(item.id)}
                          className="p-2 -mr-2"
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Trash2 size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                    <Text className="text-xl font-bold capitalize text-gray-800">{item.mood} Session</Text>
                    <Text className="text-gray-500 mt-2 leading-5 italic" numberOfLines={2}>
                      {item.snippet}
                    </Text>
                  </TouchableOpacity>
                </MotiView>
              ))
            )}
            <View className="h-24" />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}