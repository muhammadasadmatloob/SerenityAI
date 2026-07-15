
import { useRouter, useLocalSearchParams } from "expo-router";
import { BrainCircuit, ChevronLeft, Coffee, HeartHandshake, Wand2 } from "lucide-react-native";
import React, { useState, useEffect } from "react";
import { Text, TouchableOpacity, View, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReusableButton from "../(components)/button";
import SupportCard from "../(components)/card";
import { auth, db } from "../../firebase/firebase";
import { doc, setDoc } from "firebase/firestore";
import { BACKEND_URL } from "../../constants/config";

export default function PathScreen() {
  const router = useRouter();
  const { mood, desc } = useLocalSearchParams();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${BACKEND_URL}/`).catch(() => console.log("Waking up Donna..."));
  }, []);

  const handleContinue = async () => {
    if (!selectedPath) return;
    const user = auth.currentUser;
    if (!user) return Alert.alert("Session Paused", "It looks like your login expired. Let's sign in again.");

    setLoading(true);
    try {
      // Save selected path in Firestore to persist
      try {
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, { path: selectedPath }, { merge: true });
      } catch (fsErr) {
        console.log("Error saving path to Firestore:", fsErr);
      }

      router.push({
        pathname: "/(screens)/Connecting",
        params: { mood: mood, description: desc, path: selectedPath }
      });
    } catch (err: any) {
      Alert.alert("Oops", "Something went a little wrong saving your choice. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1">
      <SafeAreaView className="flex-1">
        <View className="px-6 py-2"><TouchableOpacity onPress={() => router.back()}><ChevronLeft size={32} color="white" /></TouchableOpacity></View>
        <View className="flex-1 px-6 justify-center">
          <View 
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.22)",
              borderColor: "rgba(255, 255, 255, 0.35)",
              borderWidth: 1.5,
              shadowColor: "#0F172A",
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.15,
              shadowRadius: 28,
            }}
            className="p-6 rounded-[40px] items-center"
          >
            <Text className="text-black text-3xl font-bold text-center mb-6">Choosing Your Path</Text>
            <View className="flex-row flex-wrap justify-between gap-y-4 mb-10 w-full">
              {SUPPORT_PATHS.map((path) => (
                <SupportCard key={path.id} title={path.title} description={path.description} Icon={path.icon} isSelected={selectedPath === path.id} onPress={() => setSelectedPath(path.id)} />
              ))}
            </View>
            <ReusableButton title={loading ? "Personalizing..." : "Start Journey"} onPress={handleContinue} disabled={!selectedPath || loading} />
            {loading && <ActivityIndicator color="white" style={{ marginTop: 15 }} />}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const SUPPORT_PATHS = [
  { id: "logical", title: "Logical (CBT)", description: "Structured solving", icon: BrainCircuit },
  { id: "emotional", title: "Emotional", description: "Be heard", icon: HeartHandshake },
  { id: "spiritual", title: "Spiritual", description: "Belief aligned", icon: Wand2 },
  { id: "casual", title: "Casual", description: "Friendly chat", icon: Coffee },
];