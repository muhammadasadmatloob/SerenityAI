import { ChevronRight, User, LogOut, Settings, ShieldCheck, FileText, X } from "lucide-react-native";
import React, { useState, useCallback } from "react";
import { Image, Text, TouchableOpacity, View, ScrollView, ActivityIndicator, RefreshControl, Modal, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebase";
import { useRouter, useFocusEffect } from "expo-router";
import { BACKEND_URL } from "../../constants/config";
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import DateTimePicker from '@react-native-community/datetimepicker';

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
      Alert.alert("Error", e.message || "Something went wrong generating the report.");
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

  if (loading) return <View className="flex-1 justify-center bg-[#F8FAFC]"><ActivityIndicator size="large" color="#808CEA" /></View>;

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

        <TouchableOpacity onPress={() => setReportModalVisible(true)} style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }} className="flex-row items-center p-5 rounded-2xl mb-4 shadow-sm border border-gray-100">
          <FileText size={22} color="#10B981" />
          <Text className="flex-1 ml-4 font-semibold text-gray-700">Generate Clinical Report</Text>
          <ChevronRight size={20} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(screens)/Settings")} style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }} className="flex-row items-center p-5 rounded-2xl mb-4 shadow-sm border border-gray-100">
          <Settings size={22} color="#4A55A2" />
          <Text className="flex-1 ml-4 font-semibold text-gray-700">Settings</Text>
          <ChevronRight size={20} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(screens)/Privacy?viewOnly=true")} style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)' }} className="flex-row items-center p-5 rounded-2xl mb-4 shadow-sm border border-gray-100">
          <ShieldCheck size={22} color="#4A55A2" />
          <Text className="flex-1 ml-4 font-semibold text-gray-700">Privacy Policy</Text>
          <ChevronRight size={20} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => auth.signOut()} className="flex-row items-center bg-red-50 p-5 rounded-2xl shadow-sm mt-4">
          <LogOut size={22} color="#EF4444" />
          <Text className="flex-1 ml-4 font-semibold text-red-500">Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Report Generation Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={reportModalVisible}
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View className="w-11/12 bg-white rounded-3xl p-6 shadow-xl">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-gray-800">Generate Report</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <Text className="text-gray-600 mb-4">Select the custom date range for your clinical report. This will be formatted as a professional PDF document.</Text>
            
            <View className="flex-row justify-between mb-8 gap-4">
              <TouchableOpacity 
                onPress={() => setShowStartPicker(true)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 items-center bg-gray-50"
              >
                <Text className="text-xs text-gray-500 mb-1 font-bold uppercase">From</Text>
                <Text className="text-[#4A55A2] font-semibold">{startDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setShowEndPicker(true)}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 items-center bg-gray-50"
              >
                <Text className="text-xs text-gray-500 mb-1 font-bold uppercase">Till</Text>
                <Text className="text-[#4A55A2] font-semibold">{endDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="calendar"
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
                display="calendar"
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
              className={`py-4 rounded-2xl items-center shadow-md ${generatingReport ? 'bg-gray-400' : 'bg-[#4A55A2]'}`}
            >
              {generatingReport ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-lg">Generate & Download PDF</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}