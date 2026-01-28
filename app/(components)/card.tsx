import { LucideIcon } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";

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
    <Pressable
      onPress={onPress}
      className={`w-[46%] aspect-square rounded-[32px] p-4 flex items-center justify-center border ${
        isSelected
          ? "bg-white/60 border-[#55C5CC]"
          : "bg-white/40 border-white/20"
      } `}
    >
      <View className="mb-2">
        <Icon size={40} color="#55C5CC" strokeWidth={1.5} />
      </View>
      <Text className="text-black font-bold text-[15px] text-center mb-1">
        {title}
      </Text>
      <Text className="text-black/60 text-[11px] text-center leading-4">
        {description}
      </Text>
    </Pressable>
  );
};

export default SupportCard;
