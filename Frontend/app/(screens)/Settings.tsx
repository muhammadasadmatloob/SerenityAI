import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react-native";
import { useRouter } from "expo-router";
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { auth } from "../../firebase/firebase";
import { BACKEND_URL } from "../../constants/config";

export default function SettingsScreen() {
  const router = useRouter();
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleUpdate = async () => {
    if (!oldPass || !newPass || !confirmPass) return Alert.alert("Required", "Please fill all fields.");
    if (newPass !== confirmPass) return Alert.alert("Mismatch", "New password and confirm password do not match.");
    if (oldPass === newPass) return Alert.alert("Same Password", "New password must be different from old password.");

    setLoading(true);
    
    try {
      const valRes = await fetch(`${BACKEND_URL}/api/auth/validate-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPass })
      });
      const valData = await valRes.json();
      if (!valRes.ok || !valData.success) {
        Alert.alert("Weak Password", valData.message || "Password does not meet complexity requirements.");
        setLoading(false);
        return;
      }
    } catch (err: any) {
      console.log("Password validation request failed, falling back to local checks:", err);
      if (newPass.length < 8) {
        Alert.alert("Weak Password", "New password must be at least 8 characters long.");
        setLoading(false);
        return;
      }
      if (!/[A-Z]/.test(newPass)) {
        Alert.alert("Weak Password", "New password must contain at least one uppercase letter (A-Z).");
        setLoading(false);
        return;
      }
      if (!/[a-z]/.test(newPass)) {
        Alert.alert("Weak Password", "New password must contain at least one lowercase letter (a-z).");
        setLoading(false);
        return;
      }
      if (!/\d/.test(newPass)) {
        Alert.alert("Weak Password", "New password must contain at least one number (0-9).");
        setLoading(false);
        return;
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPass)) {
        Alert.alert("Weak Password", "New password must contain at least one special character (e.g., !, @, #, $, %, &, *).");
        setLoading(false);
        return;
      }
    }

    try {
      const user = auth.currentUser;
      if (user && user.email) {
        const cred = EmailAuthProvider.credential(user.email, oldPass);
        await reauthenticateWithCredential(user, cred);
        await updatePassword(user, newPass);
        Keyboard.dismiss();
        Alert.alert("Success", "Password changed successfully.");
        setOldPass("");
        setNewPass("");
        setConfirmPass("");
        router.back();
      }
    } catch (e: any) {
      const msg = e?.code === "auth/wrong-password" || e?.code === "auth/invalid-credential"
        ? "Old password is incorrect. Please try again."
        : e?.message || "Authentication failed.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 32, paddingBottom: 200 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => router.back()} className="mb-6 mt-4">
            <ChevronLeft size={30} color="black" />
          </TouchableOpacity>

          <View className="flex-row items-center mb-2">
            <ShieldCheck size={28} color="#808CEA" />
            <Text className="text-3xl font-bold ml-3 text-gray-800">Security</Text>
          </View>
          <Text className="text-gray-400 mb-8">Update your account password</Text>

          {/* Old Password */}
          <Text className="font-bold mb-2 text-gray-700 ml-1">Current Password</Text>
          <View className="flex-row items-center border border-gray-200 rounded-xl mb-6 bg-white">
            <View className="pl-4 pr-2">
              <Lock size={18} color="#94A3B8" />
            </View>
            <TextInput
              placeholder="Enter current password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showOld}
              value={oldPass}
              onChangeText={setOldPass}
              style={{ flex: 1, padding: 16, fontSize: 16, color: "#1F2937" }}
            />
            <TouchableOpacity onPress={() => setShowOld(!showOld)} className="pr-4">
              {showOld ? <Eye size={20} color="#808CEA" /> : <EyeOff size={20} color="#94A3B8" />}
            </TouchableOpacity>
          </View>

          {/* New Password */}
          <Text className="font-bold mb-2 text-gray-700 ml-1">New Password</Text>
          <View className="flex-row items-center border border-gray-200 rounded-xl mb-6 bg-white">
            <View className="pl-4 pr-2">
              <Lock size={18} color="#94A3B8" />
            </View>
            <TextInput
              placeholder="Enter new password (min 8 chars & complex)"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showNew}
              value={newPass}
              onChangeText={setNewPass}
              style={{ flex: 1, padding: 16, fontSize: 16, color: "#1F2937" }}
            />
            <TouchableOpacity onPress={() => setShowNew(!showNew)} className="pr-4">
              {showNew ? <Eye size={20} color="#808CEA" /> : <EyeOff size={20} color="#94A3B8" />}
            </TouchableOpacity>
          </View>

          {/* Confirm Password */}
          <Text className="font-bold mb-2 text-gray-700 ml-1">Confirm New Password</Text>
          <View className="flex-row items-center border border-gray-200 rounded-xl mb-10 bg-white">
            <View className="pl-4 pr-2">
              <Lock size={18} color="#94A3B8" />
            </View>
            <TextInput
              placeholder="Re-enter new password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry={!showConfirm}
              value={confirmPass}
              onChangeText={setConfirmPass}
              style={{ flex: 1, padding: 16, fontSize: 16, color: "#1F2937" }}
            />
            <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} className="pr-4">
              {showConfirm ? <Eye size={20} color="#808CEA" /> : <EyeOff size={20} color="#94A3B8" />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleUpdate}
            disabled={loading}
            className="bg-[#808CEA] p-5 rounded-full items-center shadow-lg shadow-[#808CEA]/30"
          >
            {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">Change Password</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}