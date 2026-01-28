import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { CheckCircle2, Circle } from "lucide-react-native";
import { MotiView } from "moti";
import React, { useState } from "react";
import {
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
  const [isEncryptedChecked, setEncryptedChecked] = useState(false);
  const [isTermsChecked, setTermsChecked] = useState(false);

  const canProceed = isEncryptedChecked && isTermsChecked;

  const handleContinue = () => {
    if (canProceed) {
      // replace swaps the route without stack sliding
      router.replace("/(auth)/auth?mode=signup");
    }
  };

  return (
    <View className="flex-1">
      {/* FIXED TRANSITION: 
         - 'fade' removes the sliding movement
         - 'gestureEnabled: false' stops users from sliding it manually
      */}
      <Stack.Screen
        options={{
          animation: "fade",
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <LinearGradient
        colors={["#55C5CC", "#808CEA", "#A48CED"]}
        locations={[0, 0.52, 1]}
        className="absolute inset-0"
      />

      <Image
        source={require("../../assets/images/brain.png")}
        className="absolute self-center opacity-30"
        style={{
          top: "12%",
          width: width * 0.85,
          height: width * 0.85,
        }}
        resizeMode="contain"
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
          {/* Glassmorphism Card */}
          <MotiView
            from={{ opacity: 0, scale: 0.95, translateY: 20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: "spring", duration: 1000 }}
            className="bg-white/30 p-8 rounded-[40px] border-[1.5px] border-white/20 shadow-1xl"
          >
            <Text className="text-3xl font-extrabold text-black mb-4 tracking-tight">
              Your Privacy Matters
            </Text>

            <Text className="text-[16px] text-black/80 leading-6 font-medium mb-10 tracking-wide">
              At Dona AI, your conversations are sacred. We prioritize on-device
              processing and use end-to-end encryption. Your chats are private,
              and no data is ever shared without your explicit consent.
              {"\n\n"}
              <Text className="font-bold">Disclaimer:</Text> Dona AI is a
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
                title="I Understand & Continue"
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
    <Pressable onPress={onPress} className="flex-row items-start py-1">
      {/* Precision Spacing */}
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
