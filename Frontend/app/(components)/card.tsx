import { LucideIcon } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { MotiView } from "moti";

interface SupportCardProps {
  title: string;
  description: string;
  Icon: LucideIcon;
  isSelected: boolean;
  onPress: () => void;
}

const SupportCard = ({
  title,
  description,
  Icon,
  isSelected,
  onPress,
}: SupportCardProps) => {
  return (
    <Pressable onPress={onPress} style={{ width: "46%", aspectRatio: 1 }}>
      <MotiView
        animate={{
          scale: isSelected ? 1.05 : 1,
          backgroundColor: isSelected ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 255, 255, 0.1)",
          borderColor: isSelected ? "#808CEA" : "rgba(255, 255, 255, 0.18)",
          borderWidth: 1,
        }}
        transition={{ type: "spring", damping: 15, stiffness: 120 }}
        style={{
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 16,
          shadowOpacity: isSelected ? 0.12 : 0,
        }}
        className="w-full h-full rounded-[32px] p-4 flex items-center justify-center"
      >
        <View className="mb-2">
          <Icon size={40} color={isSelected ? "#808CEA" : "#55C5CC"} strokeWidth={1.5} />
        </View>
        <Text className={`font-extrabold text-[15px] text-center mb-1 ${isSelected ? 'text-slate-900' : 'text-white'}`}>
          {title}
        </Text>
        <Text className={`font-medium text-[11px] text-center leading-4 ${isSelected ? 'text-slate-700' : 'text-slate-200'}`}>
          {description}
        </Text>
      </MotiView>
    </Pressable>
  );
};

export default SupportCard;
