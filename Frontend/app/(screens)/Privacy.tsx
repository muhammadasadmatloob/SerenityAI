import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { CheckCircle2, Circle } from "lucide-react-native";
import { MotiView } from "moti";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReusableButton from "../(components)/button";

const { width } = Dimensions.get("window");

export default function PrivacyScreen() {
  const router = useRouter();
  const { viewOnly } = useLocalSearchParams();
  const [isEncryptedChecked, setEncryptedChecked] = useState(viewOnly === "true");
  const [isTermsChecked, setTermsChecked] = useState(viewOnly === "true");
  const [isLoading, setIsLoading] = useState(true);

  const canProceed = isEncryptedChecked && isTermsChecked;

  useEffect(() => {
    setIsLoading(false);
  }, []);

  const handleContinue = async () => {
    if (viewOnly === "true") {
      router.back();
      return;
    }
    
    if (canProceed) {
      try {
        await SecureStore.setItemAsync("HAS_ACCEPTED_PRIVACY", "true");
        router.replace("/(auth)/auth?mode=signup");
      } catch (error) {
        // Error is used here, so this is fine
        console.error("Error saving privacy status", error);
      }
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-[#55C5CC] items-center justify-center">
        <ActivityIndicator color="white" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          animation: "fade",
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <SafeAreaView className="flex-1">
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <MotiView
            from={{ opacity: 0, scale: 0.95, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: "spring", duration: 1000 }}
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.22)",
              borderColor: "rgba(255, 255, 255, 0.35)",
              borderWidth: 1.5,
              shadowColor: "#0F172A",
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.15,
              shadowRadius: 28,
            }}
            className="p-8 rounded-[40px]"
          >
            <Text className="text-3xl font-extrabold text-black mb-4 tracking-tight">
              Your Privacy Matters
            </Text>

            <Text className="text-[16px] text-black/80 leading-6 font-medium mb-10 tracking-wide">
              At Donna AI, your conversations are sacred. We prioritize
              on-device processing and use end-to-end encryption. Your chats are
              private, and no data is ever shared without your explicit consent.
              {"\n\n"}
              <Text className="font-bold">Disclaimer:</Text> Donna AI is a
              supportive tool, not a replacement for professional therapy or
              medical help.
            </Text>

            <View className="space-y-6">
              <PressableRow
                text="I understand my conversations are encrypted and stored locally."
                state={isEncryptedChecked}
                onPress={() => setEncryptedChecked(!isEncryptedChecked)}
              />
              <PressableRow
                text="I accept the Terms of Service and Privacy Policy."
                state={isTermsChecked}
                onPress={() => setTermsChecked(!isTermsChecked)}
              />
            </View>

            <View className="mt-12">
              <ReusableButton
                title={viewOnly === "true" ? "Go Back" : "I Understand & Continue"}
                disabled={!canProceed}
                className={!canProceed ? "opacity-40" : "opacity-100 shadow-xl"}
                onPress={handleContinue}
              />
            </View>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PressableRow({
  text,
  state,
  onPress,
}: {
  text: string;
  state: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} className="flex-row items-start py-1 mb-4">
      <View className="pt-0.5 mr-5">
        {state ? (
          <MotiView
            from={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 15 }}
          >
            <CheckCircle2
              size={26}
              color="#808CEA"
              fill="#FFFFFF"
              strokeWidth={2.5}
            />
          </MotiView>
        ) : (
          <Circle size={26} color="rgba(74, 85, 162, 0.5)" strokeWidth={1.5} />
        )}
      </View>
      <Text className="text-black/90 text-[15px] flex-1 leading-6 font-semibold tracking-wide">
        {text}
      </Text>
    </Pressable>
  );
}
