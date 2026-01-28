import { useRouter } from "expo-router";
import { ChevronLeft, Mic, Phone, Send } from "lucide-react-native";
import { MotiView } from "moti";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ChatScreen() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  const history = [
    {
      id: 1,
      text: "I hear you. It sounds like a lot is resting on your shoulders right now.",
      sender: "ai",
    },
    {
      id: 2,
      text: "Yeah, it's just the sheer volume of it all.",
      sender: "user",
    },
    {
      id: 3,
      text: "What's the one thing feeling heaviest at this moment.",
      sender: "ai",
    },
    {
      id: 4,
      text: "Probably the presentation for Friday. I feel unprepared.",
      sender: "user",
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-[#E8E8E8]">
      <View className="flex-row items-center justify-between px-6 py-4 bg-white/80 border-b border-gray-200">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => router.push("/(screens)/Hub")}
            className="mr-4"
          >
            <ChevronLeft size={28} color="#4A55A2" />
          </TouchableOpacity>
          <Text className="text-2xl font-semibold text-gray-800">Dona.Ai</Text>
        </View>
        <TouchableOpacity>
          <Phone size={24} color="#4A55A2" />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-6"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {history.map((msg, i) => (
          <MotiView
            key={msg.id}
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: i * 100 }}
            className={`max-w-[85%] p-5 rounded-[28px] mb-5 ${msg.sender === "user" ? "bg-[#A48CED] self-end rounded-br-none" : "bg-[#76C1CE] self-start rounded-bl-none"}`}
          >
            <Text className="text-white text-[17px] font-medium leading-6">
              {msg.text}
            </Text>
          </MotiView>
        ))}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="px-4 pb-20 pt-2 flex-row items-center">
          <View className="flex-1 flex-row items-center bg-white rounded-full px-5 py-3 shadow-sm border border-gray-100">
            <TextInput
              placeholder="type your message.."
              className="flex-1 text-lg"
              value={message}
              onChangeText={setMessage}
            />
            <Mic size={24} color="#6B7280" />
          </View>
          <TouchableOpacity className="bg-black p-4 rounded-full ml-3">
            <Send size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
