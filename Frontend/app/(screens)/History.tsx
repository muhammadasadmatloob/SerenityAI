import { MotiView } from "moti";
import React, { useState, useCallback } from "react";
import { ScrollView, Text, View, ActivityIndicator, RefreshControl, TouchableOpacity, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebase";
import { BACKEND_URL } from "../../constants/config";
import { Trash2, Calendar, ChevronRight, MessageCircle, X, ArrowLeft } from "lucide-react-native";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";


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
  const params = useLocalSearchParams();
  const fromFeel = params.fromFeel === "true";
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [reviewMessages, setReviewMessages] = useState<any[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  const handleSessionPress = async (item: any) => {
    if (!item.is_ended) {
      router.push({ pathname: "/(screens)/Chat", params: { sessionId: item.id.toString() } });
    } else {
      setSelectedSession(item);
      setReviewLoading(true);
      try {
        const user = auth.currentUser;
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch(`${BACKEND_URL}/api/chat/history/${item.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setReviewMessages(data);
        }
      } catch (err) {
        console.error("Failed to load review history:", err);
        Alert.alert("Error", "We couldn't load the messages for this session.");
      } finally {
        setReviewLoading(false);
      }
    }
  };

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
      "Clear Session",
      "Are you sure you want to permanently clear this conversation from your journey?",
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
                Alert.alert("Oops", "We couldn't clear the session right now. Let's try again in a bit.");
              }
            } catch (err) {
              console.error("Delete error:", err);
              Alert.alert("Connection Interrupted", "We're having trouble connecting. Please try again later.");
            }
          }
        }
      ]
    );
  };

  return (
    <View className="flex-1 bg-transparent">
      <SafeAreaView className="flex-1" edges={['top']}>
        {fromFeel && (
          <View className="px-8 pt-4 pb-2">
            <TouchableOpacity 
              onPress={() => router.back()} 
              activeOpacity={0.7}
              className="flex-row items-center gap-1.5 bg-slate-100/80 px-3.5 py-2 rounded-full border border-slate-200 self-start"
              style={{ elevation: 2 }}
            >
              <ArrowLeft size={16} color="#475569" />
              <Text className="text-slate-600 font-bold text-xs uppercase tracking-wider">Exit</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Beautiful Animated Header */}
        <View className="px-8 pt-4 pb-6">
          <MotiView 
            from={{ opacity: 0, translateY: -15 }} 
            animate={{ opacity: 1, translateY: 0 }} 
            transition={{ type: "timing", duration: 600, ease: "easeOut" } as any}
          >
            <View className="flex-row items-center mb-3">
              <View className="w-12 h-12 rounded-[18px] bg-[#808CEA]/15 items-center justify-center mr-4 border border-[#808CEA]/20">
                <Calendar size={24} color="#808CEA" strokeWidth={2.5} />
              </View>
              <Text className="text-[36px] font-extrabold text-slate-800 tracking-tight">Your Journey</Text>
            </View>
            <Text className="text-slate-500 text-[15px] font-medium leading-6">Reflect on your past sessions, track your growth, and find peace in your progress.</Text>
          </MotiView>
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
                    onPress={() => handleSessionPress(item)}
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
                        <View className="flex-row items-center gap-2">
                          <View className="flex-row items-center bg-[#F0FDF4] px-2.5 py-1 rounded-lg border border-[#DCFCE7]">
                            <Calendar size={12} color="#22C55E" style={{ marginRight: 4 }} />
                            <Text className="text-[#16A34A] font-bold text-[10px] uppercase tracking-widest">{item.date}</Text>
                          </View>
                          <View className={`px-2 py-0.5 rounded-lg border ${
                            item.is_ended 
                              ? "bg-slate-100 border-slate-200" 
                              : "bg-emerald-50 border-emerald-200"
                          }`}>
                            <Text className={`font-bold text-[9px] uppercase tracking-widest ${
                              item.is_ended ? "text-slate-500" : "text-emerald-600"
                            }`}>
                              {item.is_ended ? "Concluded" : "Ongoing"}
                            </Text>
                          </View>
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

      {/* Read-Only Session History Modal */}
      <Modal
        visible={selectedSession !== null}
        animationType="slide"
        onRequestClose={() => {
          setSelectedSession(null);
          setReviewMessages([]);
        }}
      >
        <SafeAreaView className="flex-1 bg-slate-50" edges={['top', 'bottom']}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shadow-sm">
            <View className="flex-row items-center gap-3">
              <Text className="text-[28px]">{selectedSession ? moodMap[selectedSession.mood] || "🌱" : "🌱"}</Text>
              <View>
                <Text className="text-lg font-bold text-slate-800 capitalize">
                  {selectedSession ? `${selectedSession.mood} Session` : "Review Session"}
                </Text>
                <Text className="text-xs text-slate-400 font-semibold">{selectedSession?.date}</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={() => {
                setSelectedSession(null);
                setReviewMessages([]);
              }}
              className="w-9 h-9 rounded-full bg-slate-100 items-center justify-center"
            >
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Messages List */}
          {reviewLoading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#76C1CE" />
              <Text className="text-slate-400 text-sm font-semibold mt-4">Loading messages...</Text>
            </View>
          ) : (
            <ScrollView
              className="flex-1 px-4 pt-4"
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            >
              {reviewMessages.map((msg, idx) => {
                const isUser = msg.sender === "user";
                return (
                  <View
                    key={msg.id || idx}
                    className={`flex-row mb-4 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <View className="w-8 h-8 rounded-full bg-[#76C1CE] items-center justify-center mr-2 mt-1">
                        <Text className="text-white text-xs font-bold">D</Text>
                      </View>
                    )}
                    <View
                      className={`max-w-[75%] rounded-[20px] px-4 py-3 ${
                        isUser 
                          ? "bg-[#76C1CE] rounded-tr-none" 
                          : "bg-white border border-slate-100 rounded-tl-none shadow-sm"
                      }`}
                    >
                      <Text
                        className={`text-[15px] leading-6 ${
                          isUser ? "text-white" : "text-slate-800"
                        }`}
                      >
                        {msg.text}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Bottom Info Banner */}
          <View className="bg-white border-t border-slate-100 px-6 py-4 items-center justify-center">
            <Text className="text-xs text-slate-400 font-bold text-center leading-5">
              This session has concluded. To start a new conversation with Donna, please go to the Chat tab.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}