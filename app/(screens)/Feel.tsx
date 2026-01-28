import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronLeft, Mic } from "lucide-react-native"; // Added ChevronLeft
import React, { useState } from "react";
import {
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity, // Added TouchableOpacity
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReusableButton from "../(components)/button";

const { width } = Dimensions.get("window");

const emojis = [
  { id: "happy", emoji: "😊" },
  { id: "sad", emoji: "😓" },
  { id: "thinking", emoji: "🤔" },
  { id: "crying", emoji: "😢" },
  { id: "grimacing", emoji: "😬" },
  { id: "grinning", emoji: "😆" },
];

export default function FeelScreen() {
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [description, setDescription] = useState("");

  const canProceed = selectedMood || description.length > 0;

  const handleContinue = () => {
    if (canProceed) {
      router.push("/(screens)/Path");
    }
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={["#55C5CC", "#808CEA", "#A48CED"]}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <Image
        source={require("../../assets/images/brain.png")}
        className="absolute top-[10%] self-center opacity-20"
        style={{ width: width * 0.8, height: width * 0.8 }}
        resizeMode="contain"
      />

      <SafeAreaView className="flex-1">
        {/* --- BACK BUTTON SECTION --- */}
        <View className="px-6 py-2">
          <TouchableOpacity
            onPress={() => router.back()} // Standard back navigation
            className="p-2 -ml-2 w-12"
          >
            <ChevronLeft size={32} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View className="bg-white/40 p-6 rounded-[32px] border border-white/30 shadow-1xl">
            <Text className="text-lg font-medium text-black mb-2">
              Hello Im Dona. Im here to listen without judgement
            </Text>
            <Text className="text-2xl font-bold text-black mb-6">
              How is your mind feeling today?
            </Text>

            <View className="flex-row flex-wrap justify-between gap-4 mb-6">
              {emojis.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedMood(item.id)}
                  className={`p-4 rounded-full ${
                    selectedMood === item.id
                      ? "bg-white/50 border-2 border-[#808CEA]"
                      : "bg-white/20"
                  }`}
                >
                  <Text className="text-5xl">{item.emoji}</Text>
                </Pressable>
              ))}
            </View>

            <View className="flex-row items-center bg-white/40 rounded-full px-4 py-3 mb-8">
              <TextInput
                className="flex-1 text-lg text-black mr-2"
                placeholder="Or, describe how you feel..."
                placeholderTextColor="#6B7280"
                value={description}
                onChangeText={setDescription}
              />
              <Mic size={24} color="#6B7280" />
            </View>

            <ReusableButton
              title="Continue"
              disabled={!canProceed}
              className={!canProceed ? "opacity-50" : ""}
              onPress={handleContinue}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
