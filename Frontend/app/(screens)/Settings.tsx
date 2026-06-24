import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../../firebase/firebase";

export default function SettingsScreen() {
  const router = useRouter();
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    if (!oldPass || !newPass) return Alert.alert("Required", "Fill both fields.");
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (user && user.email) {
        const cred = EmailAuthProvider.credential(user.email, oldPass);
        await reauthenticateWithCredential(user, cred);
        await updatePassword(user, newPass);
        Alert.alert("Success", "Password changed successfully.");
        router.back();
      }
    } catch (e: any) {
      Alert.alert("Error", "Authentication failed. Check your old password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white px-8">
      <TouchableOpacity onPress={() => router.back()} className="mb-6 mt-4">
        <ChevronLeft size={30} color="black" />
      </TouchableOpacity>
      
      <Text className="text-3xl font-bold mb-8">Security Settings</Text>

      <Text className="font-bold mb-2">Verify Old Password</Text>
      <TextInput placeholder="••••••••" secureTextEntry value={oldPass} onChangeText={setOldPass} className="border border-gray-200 p-4 rounded-xl mb-6" />

      <Text className="font-bold mb-2">New Password</Text>
      <TextInput placeholder="••••••••" secureTextEntry value={newPass} onChangeText={setNewPass} className="border border-gray-200 p-4 rounded-xl mb-10" />

      <TouchableOpacity onPress={handleUpdate} className="bg-black p-5 rounded-full items-center shadow-lg">
        {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Change Password</Text>}
      </TouchableOpacity>
    </SafeAreaView>
  );
}