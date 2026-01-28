import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  BrainCircuit,
  ChevronLeft,
  Coffee,
  HeartHandshake,
  Wand2,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReusableButton from "../(components)/button";
import SupportCard from "../(components)/card";

const { width } = Dimensions.get("window");

const SUPPORT_PATHS = [
  {
    id: "logical",
    title: "Logical (CBT)",
    description: "For structured problem solving",
    icon: BrainCircuit,
  },
  {
    id: "emotional",
    title: "Emotional",
    description: "Be heard without judgement",
    icon: HeartHandshake,
  },
  {
    id: "spiritual",
    title: "Spiritual",
    description: "Guidance aligned with personal belief",
    icon: Wand2,
  },
  {
    id: "casual",
    title: "Casual",
    description: "A friendly, low pressure conversation",
    icon: Coffee,
  },
];

export default function PathScreen() {
  const router = useRouter();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const handleContinue = () => {
    if (selectedPath) {
      console.log("Selected Support Path:", selectedPath);
      // Navigates to app/(screens)/Hub.tsx using absolute path
      router.push("/Chat");
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
        className="absolute top-[10%] self-center opacity-30"
        style={{ width: width * 0.85, height: width * 0.85 }}
        resizeMode="contain"
      />

      <SafeAreaView className="flex-1">
        {/* --- BACK BUTTON SECTION --- */}
        <View className="px-6 py-2">
          <TouchableOpacity
            onPress={() => router.back()} // STANDARD POP FROM STACK
            className="p-2 -ml-2 w-12"
          >
            <ChevronLeft size={32} color="white" />
          </TouchableOpacity>
        </View>

        <View className="flex-1 px-6 justify-center">
          <View className="bg-white/30 p-6 rounded-[40px] border border-white/20 shadow-1xl items-center">
            <Text className="text-black text-3xl font-bold text-center mb-2">
              Choosing Your Path
            </Text>
            <Text className="text-black/80 text-[17px] font-medium text-center mb-8">
              select the support style that feels right for you today
            </Text>

            <View className="flex-row flex-wrap justify-between gap-y-4 mb-10 w-full">
              {SUPPORT_PATHS.map((path) => (
                <SupportCard
                  key={path.id}
                  title={path.title}
                  description={path.description}
                  Icon={path.icon}
                  isSelected={selectedPath === path.id}
                  onPress={() => setSelectedPath(path.id)}
                />
              ))}
            </View>

            <View className="w-full px-4">
              <ReusableButton
                title="Continue"
                onPress={handleContinue}
                disabled={!selectedPath}
                className={!selectedPath ? "opacity-50" : ""}
              />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
