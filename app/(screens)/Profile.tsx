import {
  Calendar,
  ChevronRight,
  Mic2,
  PhoneCall,
  Shield,
  User,
} from "lucide-react-native";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

const MenuItem = ({ Icon, title }: { Icon: any; title: string }) => (
  <TouchableOpacity className="flex-row items-center gap-4 bg-white rounded-full px-6 py-4 mb-4 shadow-sm border border-gray-50 active:opacity-70">
    <Icon size={24} color="black" />
    <Text className="flex-1 text-lg font-medium text-gray-800">{title}</Text>
    <ChevronRight size={20} color="#9CA3AF" />
  </TouchableOpacity>
);

export default function ProfileScreen() {
  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-[#E8E8E8] px-8">
        {/* Profile Header */}
        <View className="items-center mt-10 mb-8">
          <View className="w-32 h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden mb-4 bg-white">
            <Image
              source={require("../../assets/images/profile-avatar.png")}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
          <Text className="text-3xl font-extrabold text-center text-gray-900 tracking-tight">
            Muhammad Asad{"\n"}Matloob
          </Text>
        </View>

        {/* Stats */}
        <View className="flex-row justify-between mb-10">
          <View className="bg-white p-6 rounded-[32px] w-[46%] items-center shadow-lg border border-gray-50">
            <Calendar size={28} color="#4A55A2" strokeWidth={2} />
            <Text className="text-gray-900 font-bold text-xl mt-2">14</Text>
            <Text className="text-gray-500 font-medium text-xs uppercase tracking-wider">
              Sessions
            </Text>
          </View>

          <View className="bg-white p-6 rounded-[32px] w-[46%] items-center shadow-lg border border-gray-50">
            <Text className="text-4xl mb-1">😊</Text>
            <Text className="text-gray-500 font-medium text-xs mt-2 uppercase tracking-wider">
              Current Mood
            </Text>
          </View>
        </View>

        {/* Menu */}
        <View style={{ paddingBottom: 100 }}>
          <MenuItem Icon={User} title="Profile Info" />
          <MenuItem Icon={Shield} title="Privacy & Data Control" />
          <MenuItem Icon={Mic2} title="AI Voice Setting" />
          <MenuItem Icon={PhoneCall} title="Emergency Contacts" />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
