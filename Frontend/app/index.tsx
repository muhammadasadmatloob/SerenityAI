import React, { useEffect, useState } from "react";
import { View } from "react-native";
import PrivacyScreen from "./(screens)/Privacy";
import * as SecureStore from "expo-secure-store";

export default function Page() {
  const [hasAcceptedPrivacy, setHasAcceptedPrivacy] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkPrivacy() {
      try {
        const val = await SecureStore.getItemAsync("HAS_ACCEPTED_PRIVACY");
        setHasAcceptedPrivacy(val === "true");
      } catch {
        setHasAcceptedPrivacy(false);
      }
    }
    checkPrivacy();
  }, []);

  if (hasAcceptedPrivacy === null || hasAcceptedPrivacy === true) {
    // Render a clean background matching the splash screen color while layout guard handles redirects in background
    return <View style={{ flex: 1, backgroundColor: "#55C5CC" }} />;
  }

  return <PrivacyScreen />;
}