import { ChevronRight, User, LogOut, Settings, ShieldCheck, FileText, X, ArrowLeft } from "lucide-react-native";
import React, { useState, useCallback } from "react";
import { Image, Text, TouchableOpacity, View, ScrollView, ActivityIndicator, RefreshControl, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebase";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { BACKEND_URL } from "../../constants/config";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MotiView } from "moti";

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
  const params = useLocalSearchParams();
  const fromFeel = params.fromFeel === "true";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);
  
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/reports/generate`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || "Failed to generate report");
      
      const { uri } = await Print.printToFileAsync({
        html: data.html,
        base64: false
      });
      
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      setReportModalVisible(false);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Oops", e.message || "We had a little trouble generating your report. Please try again.");
    } finally {
      setGeneratingReport(false);
    }
  };

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

  if (loading) return (
    <View className="flex-1 justify-center items-center bg-[#F8FAFC]">
      <View className="w-16 h-16 rounded-full bg-white items-center justify-center shadow-sm border border-slate-100">
        <ActivityIndicator size="large" color="#76C1CE" />
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-transparent" edges={['top']}>
      {fromFeel && (
        <View className="px-6 pt-4">
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
      <ScrollView 
        className="flex-1 px-6 pt-2"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} tintColor="#76C1CE" />}
      >
        {/* Header Section */}
        <MotiView 
          from={{ opacity: 0, translateY: -15 }}
          animate={{ opacity: 1, translateY: 0 }}
          className="items-center mb-8 mt-4"
        >
          <View className="w-[120px] h-[120px] rounded-[40px] border-[4px] border-white shadow-sm overflow-hidden bg-white mb-4 relative" style={{ shadowColor: "#76C1CE", shadowOpacity: 0.15, shadowRadius: 15, elevation: 5 }}>
             <Image source={require("../../assets/images/profile-avatar.png")} className="w-full h-full" resizeMode="cover" />
          </View>
          <Text className="text-[28px] font-extrabold text-slate-800 tracking-tight">{stats?.name || "Serenity User"}</Text>
          <View className="bg-teal-50 px-3 py-1 rounded-full mt-2 border border-teal-100">
            <Text className="text-[#5AB0BD] font-bold text-xs uppercase tracking-widest">Serenity Member</Text>
          </View>
        </MotiView>

        {/* Stats Widgets */}
        <View className="flex-row justify-between mb-8 px-1">
          <MotiView 
            from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 100 }}
            className="w-[47%]"
          >
            <View className="bg-white p-5 rounded-[28px] items-center border border-slate-100/50 shadow-sm" style={{ shadowColor: "#76C1CE", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }}}>
              <View className="w-14 h-14 rounded-[20px] bg-[#F0FDF4] items-center justify-center mb-3 border border-[#DCFCE7]">
                <Text className="text-2xl font-black text-[#16A34A]">{stats?.total_sessions || 0}</Text>
              </View>
              <Text className="text-slate-400 text-[11px] uppercase font-bold tracking-widest">Sessions</Text>
            </View>
          </MotiView>
          
          <MotiView 
            from={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 200 }}
            className="w-[47%]"
          >
            <View className="bg-white p-5 rounded-[28px] items-center border border-slate-100/50 shadow-sm" style={{ shadowColor: "#76C1CE", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }}}>
              <View className="w-14 h-14 rounded-[20px] bg-slate-50 items-center justify-center mb-3 border border-slate-100">
                <Text className="text-3xl">{stats?.last_mood ? moodMap[stats.last_mood] || "🌱" : "🌱"}</Text>
              </View>
              <Text className="text-slate-400 text-[11px] uppercase font-bold tracking-widest">Last Mood</Text>
            </View>
          </MotiView>
        </View>

        {/* Menu Items */}
        <MotiView from={{ opacity: 0, translateY: 15 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 300 }} className="mb-2">
           <Text className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-3 ml-4">Account</Text>
           
           <TouchableOpacity onPress={() => router.push("/(screens)/ProfileInfo")} className="flex-row items-center bg-white p-4 rounded-[24px] mb-3 shadow-sm border border-slate-100/60" style={{ shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 8 }}>
             <View className="w-11 h-11 rounded-full bg-[#EFF6FF] items-center justify-center mr-4 border border-[#DBEAFE]">
               <User size={20} color="#3B82F6" />
             </View>
             <Text className="flex-1 font-bold text-slate-700 text-[16px]">Profile Info</Text>
             <ChevronRight size={18} color="#CBD5E1" />
           </TouchableOpacity>

           <TouchableOpacity onPress={() => setReportModalVisible(true)} className="flex-row items-center bg-white p-4 rounded-[24px] mb-3 shadow-sm border border-slate-100/60" style={{ shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 8 }}>
             <View className="w-11 h-11 rounded-full bg-[#F5F3FF] items-center justify-center mr-4 border border-[#EDE9FE]">
               <FileText size={20} color="#8B5CF6" />
             </View>
             <Text className="flex-1 font-bold text-slate-700 text-[16px]">Clinical Report</Text>
             <ChevronRight size={18} color="#CBD5E1" />
           </TouchableOpacity>
        </MotiView>

        <MotiView from={{ opacity: 0, translateY: 15 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 400 }} className="mb-6">
           <Text className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-3 ml-4 mt-2">Preferences</Text>
           
           <TouchableOpacity onPress={() => router.push("/(screens)/Settings")} className="flex-row items-center bg-white p-4 rounded-[24px] mb-3 shadow-sm border border-slate-100/60" style={{ shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 8 }}>
             <View className="w-11 h-11 rounded-full bg-slate-50 items-center justify-center mr-4 border border-slate-100">
               <Settings size={20} color="#64748B" />
             </View>
             <Text className="flex-1 font-bold text-slate-700 text-[16px]">Settings</Text>
             <ChevronRight size={18} color="#CBD5E1" />
           </TouchableOpacity>

           <TouchableOpacity onPress={() => router.push("/(screens)/Privacy?viewOnly=true")} className="flex-row items-center bg-white p-4 rounded-[24px] mb-3 shadow-sm border border-slate-100/60" style={{ shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 8 }}>
             <View className="w-11 h-11 rounded-full bg-slate-50 items-center justify-center mr-4 border border-slate-100">
               <ShieldCheck size={20} color="#64748B" />
             </View>
             <Text className="flex-1 font-bold text-slate-700 text-[16px]">Privacy Policy</Text>
             <ChevronRight size={18} color="#CBD5E1" />
           </TouchableOpacity>
        </MotiView>

        <MotiView from={{ opacity: 0, translateY: 15 }} animate={{ opacity: 1, translateY: 0 }} transition={{ delay: 500 }} className="mb-20">
           <TouchableOpacity onPress={() => auth.signOut()} className="flex-row items-center bg-[#FEF2F2] p-4 rounded-[24px] border border-[#FEE2E2]">
             <View className="w-11 h-11 rounded-full bg-red-100 items-center justify-center mr-4">
               <LogOut size={20} color="#EF4444" />
             </View>
             <Text className="flex-1 font-extrabold text-red-500 text-[16px]">Log Out</Text>
           </TouchableOpacity>
        </MotiView>
      </ScrollView>

      {/* Report Generation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={reportModalVisible}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
          <MotiView 
            from={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-[90%] bg-white rounded-[32px] p-6 shadow-xl"
          >
            <View className="flex-row justify-between items-center mb-6">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-full bg-[#F5F3FF] items-center justify-center mr-3 border border-[#EDE9FE]">
                   <FileText size={18} color="#8B5CF6" />
                </View>
                <Text className="text-xl font-extrabold text-slate-800">Export Report</Text>
              </View>
              <TouchableOpacity onPress={() => setReportModalVisible(false)} className="w-8 h-8 bg-slate-50 rounded-full items-center justify-center">
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            
            <Text className="text-slate-500 mb-6 leading-5 text-[14px]">Select a custom date range to generate a professional PDF clinical report of your sessions.</Text>
            
            <View className="flex-row justify-between mb-8 gap-4">
              <TouchableOpacity 
                onPress={() => setShowStartPicker(true)}
                className="flex-1 p-4 rounded-[20px] border border-slate-100 items-center bg-slate-50"
              >
                <Text className="text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-widest">From Date</Text>
                <Text className="text-[#8B5CF6] font-bold text-[15px]">{startDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setShowEndPicker(true)}
                className="flex-1 p-4 rounded-[20px] border border-slate-100 items-center bg-slate-50"
              >
                <Text className="text-[10px] text-slate-400 mb-1 font-bold uppercase tracking-widest">Till Date</Text>
                <Text className="text-[#8B5CF6] font-bold text-[15px]">{endDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowStartPicker(false);
                  if (selectedDate) setStartDate(selectedDate);
                }}
              />
            )}
            
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                minimumDate={startDate}
                onChange={(event, selectedDate) => {
                  setShowEndPicker(false);
                  if (selectedDate) setEndDate(selectedDate);
                }}
              />
            )}

            <TouchableOpacity 
              onPress={handleGenerateReport} 
              disabled={generatingReport}
              className={`py-4 rounded-[20px] items-center shadow-sm ${generatingReport ? 'bg-slate-300' : 'bg-[#8B5CF6]'}`}
            >
              {generatingReport ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color="white" size="small" style={{ marginRight: 8 }} />
                  <Text className="text-white font-bold text-[16px]">Generating PDF...</Text>
                </View>
              ) : (
                <Text className="text-white font-extrabold text-[16px]">Generate PDF Report</Text>
              )}
            </TouchableOpacity>
          </MotiView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}