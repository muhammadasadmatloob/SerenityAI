import { MotiView } from "moti";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const entries = [
  {
    id: 1,
    emoji: "😢",
    date: "Today, 10:30 AM",
    title: "Managing Work Pressure",
    text: "You were looking for a way to lower your heart rate before the meeting...",
  },
  {
    id: 2,
    emoji: "😬",
    date: "January 08, 2026",
    title: "Social Anxiety Analysis",
    text: "You wanted to understand why you felt 'awkward' during the party...",
  },
  {
    id: 3,
    emoji: "🧐",
    date: "January 05, 2026",
    title: "Challenging Internal Pressure",
    text: "You were looking for a way to stop 'mental cycling' between three different options...",
  },
];

export default function HistoryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#E8E8E8]">
      <Text className="text-4xl font-extrabold px-8 pt-8 mb-8">
        Your Journey
      </Text>
      <ScrollView
        className="px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {entries.map((item, i) => (
          <MotiView
            key={item.id}
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ delay: i * 150 }}
            className="bg-white/80 p-6 rounded-[32px] mb-6 shadow-md border border-white/50"
          >
            <View className="flex-row items-center mb-3">
              <Text className="text-3xl mr-3">{item.emoji}</Text>
              <Text className="text-gray-500 font-medium">{item.date}</Text>
            </View>
            <Text className="text-xl font-bold mb-2">{item.title}</Text>
            <Text className="text-gray-600 leading-5">{item.text}</Text>
          </MotiView>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
