import { usePathname, useRouter } from "expo-router";
import {
  History as HistoryIcon,
  MessageSquare,
  User,
} from "lucide-react-native";
import { MotiText, MotiView } from "moti";
import React, { useMemo } from "react";
import { Dimensions, Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";

const { width } = Dimensions.get("window");
const TAB_WIDTH = width / 3;
const CIRCLE_SIZE = 58; // Slightly larger for better icon framing
const BAR_HEIGHT = 70;

export default function TabBar() {
  const router = useRouter();
  const pathname = usePathname();

  // Screen detection logic
  const isChat = pathname.includes("Chat");
  const isHistory = pathname.includes("History");
  const isProfile = pathname.includes("Profile");
  const activeIndex = isChat ? 0 : isHistory ? 1 : 2;

  // Professional Concave Curve Path
  const d = useMemo(() => {
    const center = activeIndex * TAB_WIDTH + TAB_WIDTH / 2;
    return `
      M0,0 
      L${center - 50},0 
      C${center - 30},0 ${center - 30},42 ${center},42 
      C${center + 30},42 ${center + 30},0 ${center + 50},0 
      L${width},0 
      V${BAR_HEIGHT} 
      H0 
      Z
    `;
  }, [activeIndex]);

  if (!isChat && !isHistory && !isProfile) return null;

  const tabs = [
    { route: "/(screens)/Chat", Icon: MessageSquare, label: "Chat" },
    { route: "/(screens)/History", Icon: HistoryIcon, label: "History" },
    { route: "/(screens)/Profile", Icon: User, label: "Profile" },
  ];

  return (
    <View
      style={{ height: BAR_HEIGHT, bottom: 0 }}
      className="absolute w-full bg-transparent"
    >
      {/* 1. SVG Background (White Bar with Downward Notch) */}
      <View className="absolute inset-0">
        <Svg width={width} height={BAR_HEIGHT + 20}>
          <Path fill="white" d={d} />
        </Svg>
      </View>

      {/* 2. Floating Slate-Black Circle Indicator */}
      <MotiView
        animate={{
          translateX: activeIndex * TAB_WIDTH + TAB_WIDTH / 2 - CIRCLE_SIZE / 2,
          translateY: 10, // Positions it perfectly inside the notch
        }}
        transition={{ type: "spring", damping: 18, stiffness: 150 }}
        style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}
        className="absolute rounded-full bg-[#1E293B] items-center justify-center shadow-lg shadow-black/40"
      >
        {/* Subtle inner rim for high-end depth */}
        <View className="absolute inset-0 rounded-full border border-white/10" />
      </MotiView>

      {/* 3. Interactive Icons Layer */}
      <View className="flex-row w-full h-full">
        {tabs.map((tab, index) => {
          const isActive = activeIndex === index;
          return (
            <Pressable
              key={index}
              onPress={() => router.replace(tab.route as any)}
              className="flex-1 items-center justify-start pt-4"
            >
              <MotiView
                animate={{
                  // Perfectly centers the 24px icon inside the 60px circle
                  translateY: isActive ? 9 : 0,
                  scale: isActive ? 1.15 : 1,
                }}
                transition={{ type: "spring", damping: 12 }}
                className="w-10 h-10 items-center justify-center"
              >
                <tab.Icon
                  size={24}
                  color={isActive ? "white" : "#94A3B8"}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </MotiView>

              {/* Labels only show for inactive tabs to keep the UI clean */}
              {!isActive && (
                <MotiText
                  from={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] text-slate-400 font-bold mt-1"
                >
                  {tab.label}
                </MotiText>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
