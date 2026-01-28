import React from "react";
import { Pressable, PressableProps, Text } from "react-native";

interface ReusableButtonProps extends PressableProps {
  title?: string;
  children?: React.ReactNode;
  className?: string;
  textClassName?: string;
}

export default function ReusableButton({
  title,
  children,
  className = "",
  textClassName = "",
  ...props
}: ReusableButtonProps) {
  return (
    <Pressable
      // Ensure props are spread correctly for NativeWind interop
      className={`bg-white w-full py-4 rounded-full flex-row items-center justify-center shadow-sm ${className}`}
      {...props}
    >
      {title ? (
        <Text
          className={`text-[#4A55A2] text-lg font-semibold ${textClassName}`}
        >
          {title}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
