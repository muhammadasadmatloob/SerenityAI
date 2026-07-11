import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Mic, X, Sparkles } from "lucide-react-native";
import { MotiView } from "moti";
import React, { useState, useEffect } from "react"; 
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReusableButton from "../(components)/button";
import { Audio } from "expo-av";
import { auth, db } from "../../firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { BACKEND_URL, checkInternetConnection } from "../../constants/config";

const clearRecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

const therapistMoods = [
  { id: "anxious", emoji: "😰", label: "Anxious" },
  { id: "sad", emoji: "😔", label: "Low / Sad" },
  { id: "angry", emoji: "😡", label: "Frustrated" },
  { id: "exhausted", emoji: "🥱", label: "Burned Out" },
  { id: "lonely", emoji: "🥺", label: "Lonely" },
  { id: "neutral", emoji: "😐", label: "Just Okay" },
];

export default function FeelScreen() {
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [userPath, setUserPath] = useState<string | null>(null);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const canProceed = selectedMood || description.trim().length > 0;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Dual fetch path: 1. Try Firestore first (instant)
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists() && userDoc.data()?.path) {
            setUserPath(userDoc.data().path);
          }
        } catch (fsErr) {
          console.log("Error checking user path in Firestore:", fsErr);
        }

        // 2. Fallback / Sync from stats endpoint
        try {
          const token = await user.getIdToken();
          const res = await fetch(`${BACKEND_URL}/api/profile/stats`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const json = await res.json();
            if (json.path) {
              setUserPath(json.path);
            }
          }
        } catch (e) {
          console.log("Error checking user path via stats API:", e);
        }

        // Trigger background warm-up ping for RunPod/Backend model to reduce cold start latency
        try {
          const token = await user.getIdToken();
          fetch(`${BACKEND_URL}/api/session/warmup`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          }).catch((err) => console.log("⚠️ Feel: RunPod warm-up silent fail:", err));
        } catch {}
      } else {
        setUserPath(null);
      }
    });
    return unsubscribe;
  }, []);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission Denied", "Microphone access is required for voice input.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Allow the OS audio routing to settle before starting recording hardware
      await new Promise(resolve => setTimeout(resolve, 150));

      const { recording: newRecording } = await Audio.Recording.createAsync(
        clearRecordingOptions
      );
      setRecording(newRecording);
      setIsListening(true);
    } catch (err) {
      console.error("Failed to start recording", err);
      Alert.alert("Error", "Could not start audio recording. Check your permissions.");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsListening(false);
    setIsTranscribing(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        Alert.alert("Error", "No audio recording file found.");
        setIsTranscribing(false);
        return;
      }

      await transcribeAudioFile(uri);
    } catch (err) {
      console.error("Failed to stop recording", err);
      Alert.alert("Error", "Failed to process audio recording.");
      setRecording(null);
      setIsTranscribing(false);
    }
  };

  const transcribeAudioFile = async (uri: string) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Error", "Login session expired.");
        setIsTranscribing(false);
        return;
      }
      
      const token = await user.getIdToken();
      
      const formData = new FormData();
      formData.append("file", {
        uri: uri,
        name: "audio.m4a",
        type: "audio/m4a",
      } as any);

      const response = await fetch(`${BACKEND_URL}/api/transcribe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();
      if (response.ok && result.transcript) {
        setDescription(result.transcript);
      } else {
        console.warn("Transcription API returned error:", result);
        Alert.alert("Transcription Failed", "Could not transcribe audio. Please try again.");
      }
    } catch (err) {
      console.error("Transcription upload error:", err);
      Alert.alert("Network Error", "Could not connect to server for transcription.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleVoiceInput = async () => {
    if (isListening) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const handleContinue = async () => {
    if (!canProceed) return;
    
    // Verify network connectivity before attempting the initial session handshake
    const isOnline = await checkInternetConnection();
    if (!isOnline) {
      Alert.alert(
        "No Internet Connection",
        "SerenityAI requires an active internet connection to start your session. Please check your cellular data or Wi-Fi settings."
      );
      return;
    }
    
    if (userPath) {
      router.push({
        pathname: "/(screens)/Connecting",
        params: { mood: selectedMood || "neutral", description: description.trim() }
      });
    } else {
      router.push({
        pathname: "/(screens)/Path",
        params: { 
          mood: selectedMood || "neutral", 
          desc: description.trim() 
        }
      });
    }
  };

  return (
    <View className="flex-1">
      <SafeAreaView className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View 
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.22)",
              borderColor: "rgba(255, 255, 255, 0.35)",
              borderWidth: 1.5,
              shadowColor: "#0F172A",
              shadowOffset: { width: 0, height: 16 },
              shadowOpacity: 0.15,
              shadowRadius: 28,
            }}
            className="p-6 rounded-[32px]"
          >
            <Text className="text-lg font-medium text-slate-900 mb-2">
              Hello, I&apos;m Donna. I&apos;m here to listen without judgment.
            </Text>
            <Text className="text-2xl font-bold text-slate-900 mb-6">
              How is your mind feeling today?
            </Text>

            {/* Grid Map for Therapist Mood Selectors */}
            <View className="flex-row flex-wrap justify-between gap-y-4 mb-6">
              {therapistMoods.map((item) => {
                const isSelected = selectedMood === item.id;
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => !isStartingSession && setSelectedMood(item.id)}
                    disabled={isStartingSession}
                    style={{ width: "29%", aspectRatio: 1 }}
                  >
                    <MotiView
                      animate={{
                        scale: isSelected ? 1.08 : 1,
                        backgroundColor: isSelected ? "rgba(255, 255, 255, 0.85)" : "rgba(255, 255, 255, 0.1)",
                        borderColor: isSelected ? "#808CEA" : "rgba(255, 255, 255, 0.18)",
                        borderWidth: 1,
                      }}
                      transition={{ type: "spring", damping: 12, stiffness: 100 }}
                      style={{
                        shadowColor: "#0F172A",
                        shadowOffset: { width: 0, height: 8 },
                        shadowRadius: 16,
                        shadowOpacity: isSelected ? 0.12 : 0,
                      }}
                      className="w-full h-full items-center justify-center rounded-2xl p-2"
                    >
                      <Text className="text-4xl mb-1">{item.emoji}</Text>
                      <Text className="text-[11px] font-bold text-slate-800 tracking-tight text-center">
                        {item.label}
                      </Text>
                    </MotiView>
                  </Pressable>
                );
              })}
            </View>

            {/* Content Input Row with Mic Toggle Button */}
            <MotiView 
              animate={{
                backgroundColor: isFocused ? "rgba(255, 255, 255, 0.12)" : "rgba(15, 23, 42, 0.06)",
                borderColor: isFocused ? "#808CEA" : "rgba(255, 255, 255, 0.15)",
                scale: isFocused ? 1.015 : 1,
              }}
              transition={{ type: "timing", duration: 200 }}
              style={{
                borderWidth: 1.5,
              }}
              className="flex-row items-center rounded-2xl px-4 py-3 mb-8"
            >
              <Sparkles 
                size={18} 
                color={isFocused ? "#808CEA" : "#6B7280"} 
                style={{ marginRight: 8, opacity: isFocused ? 0.9 : 0.5 }} 
              />
              <TextInput
                className="flex-1 text-base text-slate-800 mr-2"
                placeholder="Or, express exactly what's on your mind..."
                placeholderTextColor="#6B7280"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={2}
                editable={!isStartingSession}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={{ maxHeight: 80 }}
              />
              <TouchableOpacity onPress={toggleVoiceInput} disabled={isStartingSession} activeOpacity={0.86}>
                <LinearGradient
                  colors={["#808CEA", "#A48CED"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                  className="items-center justify-center"
                >
                  <Mic size={20} color="white" />
                </LinearGradient>
              </TouchableOpacity>
            </MotiView>

            <ReusableButton
              title={isStartingSession ? "Starting Session..." : "Continue"}
              disabled={!canProceed || isStartingSession}
              className={(!canProceed || isStartingSession) ? "opacity-50" : "shadow-md"}
              onPress={handleContinue}
            />
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* --- CLINICAL WAVE TRANSLATION OVERLAY MODAL --- */}
      <Modal animationType="fade" transparent={true} visible={isListening || isTranscribing} onRequestClose={async () => {
        if (recording) {
          try { await recording.stopAndUnloadAsync(); } catch {}
          setRecording(null);
        }
        setIsListening(false);
        setIsTranscribing(false);
      }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(30, 41, 59, 0.85)' }} className="items-center justify-center px-10">
          <View className="items-center justify-center w-full">
            <Text className="text-white text-3xl font-bold tracking-tight text-center mb-2">
              {isTranscribing ? "Processing Voice..." : "Listening to You"}
            </Text>
            <Text className="text-slate-300 text-sm text-center mb-16 px-4">
              {isTranscribing ? "Donna is transcribing your emotional state..." : "Speak freely. Tap the microphone when you are finished speaking..."}
            </Text>

            {/* Concentric Pulse Rings */}
            <View className="items-center justify-center h-64 w-full relative mb-16">
              {!isTranscribing && [1, 2, 3].map((ring) => (
                <MotiView
                  key={ring}
                  from={{ opacity: 0.6, scale: 0.8 }}
                  animate={{ opacity: 0, scale: 2.2 }}
                  transition={{
                    type: "timing",
                    duration: 2500,
                    loop: true,
                    delay: ring * 600,
                    repeatReverse: false,
                  }}
                  style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(120, 193, 206, 0.25)', borderRadius: 9999 }]}
                />
              ))}

              {isTranscribing ? (
                <ActivityIndicator size="large" color="#76C1CE" />
              ) : (
                <TouchableOpacity
                  onPress={stopRecording}
                  className="w-32 h-32 rounded-full bg-[#76C1CE] items-center justify-center shadow-2xl shadow-cyan-400"
                >
                  <MotiView 
                    from={{ scale: 0.95 }}
                    animate={{ scale: 1.05 }}
                    transition={{ type: "timing", duration: 1000, loop: true, repeatReverse: true }}
                    className="items-center justify-center w-full h-full"
                  >
                    <Mic size={44} color="white" />
                  </MotiView>
                </TouchableOpacity>
              )}
            </View>

            {/* Transcript Realtime Render */}
            <View className="bg-white/10 border border-white/10 w-full min-h-[80px] rounded-2xl p-4 items-center justify-center mb-12">
              <Text className="text-white/90 font-medium text-center text-base italic leading-6">
                {isTranscribing ? '"Transcribing..."' : (description.trim() || '"Speak and describe your day..."')}
              </Text>
            </View>

            <TouchableOpacity 
              onPress={async () => {
                if (recording) {
                  try {
                    await recording.stopAndUnloadAsync();
                  } catch {}
                  setRecording(null);
                }
                setIsListening(false);
                setIsTranscribing(false);
              }}
              className="bg-white/20 border border-white/20 p-5 rounded-full"
            >
              <X size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}