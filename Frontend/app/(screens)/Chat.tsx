import { useRouter, useLocalSearchParams } from "expo-router";
import { Send, LogOut, Phone, PhoneOff, Volume2, VolumeX, Mic, MicOff, Play, Pause } from "lucide-react-native";
import { MotiView } from "moti";
import React, { useState, useEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, Alert, Modal, Keyboard } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../firebase/firebase";
import { BACKEND_URL } from "../../constants/config";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from 'expo-speech';

const SUGGESTIONS = [
  "I'm feeling overwhelmed today.",
  "Help me challenge a negative thought.",
  "Can we do a quick breathing exercise?",
  "I need to vent about my day."
];

interface Message {
  id: string | number;
  text: string;
  sender: "user" | "ai";
  audio_url?: string | null;
  shouldAutoplay?: boolean;
}

interface VoiceMessagePlayerProps {
  audioUrl: string;
  sender: "user" | "ai";
  shouldAutoplay?: boolean;
}

const WAVEFORM_HEIGHTS = [
  6, 10, 14, 20, 16, 12, 18, 24, 28, 20, 
  14, 10, 16, 22, 26, 18, 12, 20, 14, 8, 
  12, 16, 10, 6
]; // 24 elements with nice wave shapes

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

const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({ audioUrl, sender, shouldAutoplay }) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const autoplayedRef = useRef(false);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        if (soundRef.current) {
          soundRef.current.unloadAsync().catch(() => {});
          setSound(null);
          soundRef.current = null;
        }
      }
    }
  };

  const handlePlayPause = async () => {
    try {
      // Ensure the correct audio mode is set to successfully acquire audio focus from the OS
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          // If at the end or starting fresh, seek to 0 first
          if (position === 0 || position >= duration - 100) {
            await sound.setPositionAsync(0);
          }
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const fullUrl = (audioUrl.startsWith("http") || audioUrl.startsWith("file:") || audioUrl.startsWith("content:"))
          ? audioUrl
          : `${BACKEND_URL}${audioUrl}`;
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: fullUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        soundRef.current = newSound;
        setIsPlaying(true);
      }
    } catch (err) {
      console.log("Error playing voice message:", err);
    }
  };

  useEffect(() => {
    if (shouldAutoplay && !autoplayedRef.current) {
      autoplayedRef.current = true;
      const timer = setTimeout(() => {
        handlePlayPause();
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoplay]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const formatTime = (millis: number) => {
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  const handleTouch = (event: any) => {
    if (duration === 0 || progressBarWidth === 0) return;
    const touchX = event.nativeEvent.locationX;
    const pct = Math.max(0, Math.min(1, touchX / progressBarWidth));
    const newPosition = pct * duration;
    setPosition(newPosition);
    if (soundRef.current) {
      soundRef.current.setPositionAsync(newPosition).catch(() => {});
    }
  };

  return (
    <View className="flex-row items-center gap-3.5 py-1 px-0.5 min-w-[210px]">
      <TouchableOpacity
        onPress={handlePlayPause}
        activeOpacity={0.8}
        className={`w-11 h-11 rounded-full items-center justify-center shadow-md ${
          sender === "user" ? "bg-white/20 border border-white/20" : "bg-black/10 border border-black/5"
        }`}
      >
        {isPlaying ? (
          <Pause size={18} color="white" />
        ) : (
          <Play size={18} color="white" style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>

      <View className="flex-1 justify-center">
        <View 
          onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleTouch}
          onResponderMove={handleTouch}
          className="flex-row items-center justify-between h-9 mb-1"
          style={{ cursor: 'pointer' } as any}
        >
          {WAVEFORM_HEIGHTS.map((barHeight, idx) => {
            const barProgress = idx / WAVEFORM_HEIGHTS.length;
            const isPlayed = progress >= barProgress;
            
            let barColor = "";
            if (sender === "user") {
              barColor = isPlayed ? "bg-white" : "bg-white/30";
            } else {
              barColor = isPlayed ? "bg-slate-800" : "bg-slate-800/25";
            }

            return (
              <View 
                key={idx}
                style={{ 
                  height: barHeight, 
                  width: `${80 / WAVEFORM_HEIGHTS.length}%`,
                  maxWidth: 4,
                  minWidth: 2
                }}
                className={`rounded-full ${barColor}`}
              />
            );
          })}
        </View>

        <View className="flex-row justify-between items-center px-0.5 mt-0.5">
          <Text className={`text-[10px] font-bold ${
            sender === "user" ? "text-white/80" : "text-slate-700/80"
          }`}>
            {formatTime(position)}
          </Text>
          <Text className={`text-[10px] font-bold ${
            sender === "user" ? "text-white/80" : "text-slate-700/80"
          }`}>
            {duration > 0 ? formatTime(duration) : "0:00"}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const rawSessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const rawFirstMsg = Array.isArray(params.firstMessage) ? params.firstMessage[0] : params.firstMessage;

  const [activeId, setActiveId] = useState<string | null>(rawSessionId || null);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [playingMsgId, setPlayingMsgId] = useState<string | number | null>(null);
  
  const insets = useSafeAreaInsets();
  const tabBarHeight = 70 + Math.max(insets.bottom, 0);

  const handlePlayTTS = async (id: string | number, text: string) => {
    if (playingMsgId === id) {
      Speech.stop();
      setPlayingMsgId(null);
    } else {
      Speech.stop();
      setPlayingMsgId(id);
      Speech.speak(text, {
        onDone: () => setPlayingMsgId(null),
        onStopped: () => setPlayingMsgId(null),
        onError: () => setPlayingMsgId(null),
      });
    }
  };
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(SUGGESTIONS);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const [secondsActive, setSecondsActive] = useState(0);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [sessionCap, setSessionCap] = useState<number>(1800);

  // Voice Call States
  const [isCallActive, setIsCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState<"connecting" | "listening" | "thinking" | "speaking" | "ended">("connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [userSpeechText, setUserSpeechText] = useState("");
  const [callRecording, setCallRecording] = useState<Audio.Recording | null>(null);
  const [callSound, setCallSound] = useState<Audio.Sound | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [displayedAiSpeechText, setDisplayedAiSpeechText] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Voice Message Recording States
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const voiceMsgRecordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Confirmation mode states and refs
  const waitingForConfirmationRef = useRef(false);
  const accumulatedTranscriptRef = useRef("");

  const updateConfirmationState = (val: boolean) => {
    waitingForConfirmationRef.current = val;
  };

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showListener = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });

    const hideListener = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
      inputRef.current?.blur();
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // Refs for tracking async state without closure staleness
  const isCallActiveRef = useRef(isCallActive);
  const isMutedRef = useRef(isMuted);
  const isProcessingRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const lastSpeechTimeRef = useRef(0);
  const activeIdRef = useRef(activeId);
  const secondsActiveRef = useRef(secondsActive);
  const callStatusRef = useRef(callStatus);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callMeteringValuesRef = useRef<number[]>([]);

  useEffect(() => {
    isCallActiveRef.current = isCallActive;
  }, [isCallActive]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    secondsActiveRef.current = secondsActive;
  }, [secondsActive]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  const isSpeakerOnRef = useRef(isSpeakerOn);
  useEffect(() => {
    isSpeakerOnRef.current = isSpeakerOn;
  }, [isSpeakerOn]);

  const loadHistory = async (id: string) => {
    try {
      const user = auth.currentUser;
      const token = await user?.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/chat/history/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        if (data.length === 0 && rawFirstMsg) {
          setHistory([{ id: "init", text: rawFirstMsg, sender: "ai" }]);
        } else {
          setHistory(data);
        }
      } else {
        if (data.code === "SESSION_EXPIRED" || data.message === "Session has expired") {
          Alert.alert(
            "Session Expired",
            "This session has expired. Please start a new one.",
            [{ text: "Start New Session", onPress: () => router.replace("/(screens)/Feel") }]
          );
          return;
        }
        Alert.alert("Error", data.message || "Failed to load chat history.");
      }
    } catch {
      console.log("History Load Error");
      Alert.alert("Connection Error", "Donna could not be reached to load history.");
    }
  };

  const loadSessionDuration = async (id: string) => {
    try {
      const user = auth.currentUser;
      const token = await user?.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/session/duration/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.duration_seconds !== undefined) {
        setSecondsActive(data.duration_seconds);
        const cap = data.session_cap_seconds || 1800;
        setSessionCap(cap);
        if (data.duration_seconds >= cap || data.is_ended) {
          setSessionFinished(true);
        }
      } else {
        if (data.code === "SESSION_EXPIRED" || data.message === "Session has expired") {
          Alert.alert(
            "Session Expired",
            "Your session expired (conversations are capped at 24 hours). Please start a new one.",
            [{ text: "Start New Session", onPress: () => router.replace("/(screens)/Feel") }]
          );
          return;
        }
        Alert.alert("Error", data.message || "Failed to load session status.");
      }
    } catch (e) {
      console.log("Error loading session duration", e);
      Alert.alert("Connection Error", "Donna could not be reached to load session status.");
    }
  };

  const fetchSuggestions = async (id: string) => {
    try {
      const user = auth.currentUser;
      const token = await user?.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/chat/suggestions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setSuggestions(data);
      } else {
        if (data.code === "SESSION_EXPIRED" || data.message === "Session has expired") {
          Alert.alert(
            "Session Expired",
            "Your session expired (conversations are capped at 24 hours). Please start a new one.",
            [{ text: "Start New Session", onPress: () => router.replace("/(screens)/Feel") }]
          );
          return;
        }
        Alert.alert("Error", data.message || "Failed to load suggestions.");
      }
    } catch (e) {
      console.log("Suggestions Load Error", e);
      Alert.alert("Connection Error", "Donna could not be reached to load suggestions.");
    }
  };

  const initChat = async () => {
    let sid = rawSessionId;
    if (!sid || sid === "undefined") {
      try {
        const user = auth.currentUser;
        const token = await user?.getIdToken();
        const res = await fetch(`${BACKEND_URL}/api/session/active`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          sid = data.session_id?.toString();
          if (data.session_cap_seconds) {
            setSessionCap(data.session_cap_seconds);
          }
        } else {
          Alert.alert("Error", data.message || "Failed to fetch active session.");
        }
      } catch (err) {
        console.log("Error fetching active session", err);
        Alert.alert("Connection Error", "Donna could not be reached to find your active session.");
      }
    }
    if (sid) {
      setActiveId(sid);
      loadHistory(sid);
      loadSessionDuration(sid);
      fetchSuggestions(sid);
    } else {
      router.replace("/(screens)/Feel");
    }
  };

  useEffect(() => {
    initChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawSessionId]);

  // Active Timer to count seconds while user is using the chat
  useEffect(() => {
    if (sessionFinished || !activeId) return;

    const timer = setInterval(() => {
      setSecondsActive(prev => {
        const next = prev + 1;
        if (next >= sessionCap) {
          setSessionFinished(true);
          clearInterval(timer);
          syncFinalDuration(next);
          
          // Explicitly mark session as ended on backend to lock it permanently
          if (activeId) {
            auth.currentUser?.getIdToken().then(token => {
              fetch(`${BACKEND_URL}/api/session/end/${activeId}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` }
              }).catch(() => {});
            }).catch(() => {});
          }

          Alert.alert("Session Finished", "See you tomorrow in next session.");
          if (isCallActive) {
            endCall();
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionFinished, activeId, isCallActive, sessionCap]);

  // Periodically sync duration to backend database (every 15 seconds)
  useEffect(() => {
    if (sessionFinished || !activeId) return;

    const syncInterval = setInterval(async () => {
      try {
        const user = auth.currentUser;
        const token = await user?.getIdToken();
        await fetch(`${BACKEND_URL}/api/session/duration`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ session_id: Number(activeId), duration_seconds: secondsActive })
        });
      } catch {
        console.log("Failed to sync session duration");
      }
    }, 15000);

    return () => clearInterval(syncInterval);
  }, [secondsActive, sessionFinished, activeId]);

  // Call Duration Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isCallActive) {
      setCallDuration(0);
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
      setCallDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCallActive]);

  // Keep track of active sound and recording in refs for unmount cleanup
  const activeRecordingRef = useRef<Audio.Recording | null>(null);
  const activeSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    activeRecordingRef.current = callRecording;
  }, [callRecording]);

  useEffect(() => {
    activeSoundRef.current = callSound;
  }, [callSound]);

  // Cleanup active audio/recording/typing on unmount ONLY (empty dependency array)
  useEffect(() => {
    return () => {
      if (activeRecordingRef.current) {
        activeRecordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (activeSoundRef.current) {
        activeSoundRef.current.unloadAsync().catch(() => {});
      }
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (voiceMsgRecordingRef.current) {
        voiceMsgRecordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const syncFinalDuration = async (overrideDuration?: number) => {
    if (!activeId) return;
    try {
      const user = auth.currentUser;
      const token = await user?.getIdToken();
      const durationToSync = overrideDuration !== undefined ? overrideDuration : secondsActive;
      await fetch(`${BACKEND_URL}/api/session/duration`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ session_id: Number(activeId), duration_seconds: durationToSync })
      });
    } catch {
      console.log("Final duration sync failed");
    }
  };

  const handleEnd = async () => {
    try {
      await syncFinalDuration();
      if (activeId) {
        const user = auth.currentUser;
        const token = await user?.getIdToken();
        await fetch(`${BACKEND_URL}/api/session/end/${activeId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (e) {
      console.log("Failed to end session on backend", e);
    }
    router.replace("/(screens)/Feel");
  };

  const playSoundEffect = async (type: "send" | "receive") => {
    try {
      const soundFile = type === "send"
        ? require("../../assets/sounds/send.mp3")
        : require("../../assets/sounds/receive.mp3");
      const { sound } = await Audio.Sound.createAsync(
        soundFile,
        { shouldPlay: true }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
        }
      });
    } catch (err) {
      console.log("Error playing sound effect:", err);
    }
  };

  const handleSend = async () => {
    if (!message.trim() || loading || !activeId || sessionFinished) return;
    const userTxt = message.trim();
    const tempUserId = Date.now();
    setHistory((prev) => [...prev, { id: tempUserId, text: userTxt, sender: "user" }]);
    setMessage("");
    playSoundEffect("send");
    setLoading(true);

    try {
      const user = auth.currentUser;
      const token = await user?.getIdToken();
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          session_id: Number(activeId), 
          content: userTxt,
          duration_seconds: secondsActive
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.reply === "See you tomorrow in next session.") {
          setSessionFinished(true);
        }
        setHistory((prev) => [...prev, { id: tempUserId + 1, text: data.reply, sender: "ai" }]);
        playSoundEffect("receive");
        fetchSuggestions(activeId);
      } else {
        setHistory((prev) => prev.filter((msg) => msg.id !== tempUserId));
        if (data.code === "SESSION_EXPIRED" || data.message === "Session has expired") {
          Alert.alert(
            "Session Expired",
            "Your session expired (conversations are capped at 24 hours). Please start a new one.",
            [{ text: "Start New Session", onPress: () => router.replace("/(screens)/Feel") }]
          );
          return;
        }
        Alert.alert("Error", data.message || "Failed to send message.");
      }
    } catch {
      setHistory((prev) => prev.filter((msg) => msg.id !== tempUserId));
      Alert.alert("Connection Error", "Donna could not be reached.");
    } finally {
      setLoading(false);
    }
  };

  const endSession = () => {
    Alert.alert("End Session", "Finish this conversation and start fresh later?", [
      { text: "Continue", style: "cancel" },
      { text: "End", style: "destructive", onPress: handleEnd },
    ]);
  };

  // --- Voice Call Handlers ---
  const startCall = async () => {
    if (sessionFinished) return;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Microphone access is needed for therapist calls.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: !isSpeakerOnRef.current,
      });

      setIsCallActive(true);
      isCallActiveRef.current = true;
      setCallStatus("connecting");
      setUserSpeechText("");
      updateConfirmationState(false);
      accumulatedTranscriptRef.current = "";

      // Based on user feedback: client speaks first like a real phone call
      startCallListening();
    } catch (err) {
      console.log("Error starting call:", err);
      Alert.alert("Call Error", "Could not start voice call.");
    }
  };

  const speakResponse = async (text: string) => {
    if (!isCallActiveRef.current) return;
    try {
      // Keep state as thinking/loading while preparing audio to avoid empty speaking screen
      setCallStatus("thinking");
      setDisplayedAiSpeechText("");

      if (callSound) {
        try {
          await callSound.unloadAsync();
        } catch {}
      }

      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }

      // Ensure the correct speaker/earpiece mode is active before playing
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: !isSpeakerOnRef.current,
      });

      const ttsUrl = `${BACKEND_URL}/api/tts?text=${encodeURIComponent(text)}${activeId ? `&session_id=${activeId}` : ""}`;
      
      // Load sound first to avoid network latency sync offset
      const { sound } = await Audio.Sound.createAsync(
        { uri: ttsUrl },
        { shouldPlay: true }
      );
      setCallSound(sound);

      // Now sound is loaded and playing: transition to speaking
      setCallStatus("speaking");

      // Start the typewriter animation AFTER sound has successfully loaded and starts playing!
      const words = text.split(/\s+/);
      let wordIndex = 0;
      
      typingIntervalRef.current = setInterval(() => {
        if (wordIndex < words.length) {
          // Show only a sliding window of the last 4 words to hide previous text
          const startIndex = Math.max(0, wordIndex - 3);
          const currentWordsSlice = words.slice(startIndex, wordIndex + 1).join(" ");
          setDisplayedAiSpeechText(currentWordsSlice);
          wordIndex++;
        } else {
          if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
          }
        }
      }, 340); // 340ms aligns perfectly with the speech speed of the Ava neural voice

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
          }
          setDisplayedAiSpeechText(""); // Clear text when finished
          sound.unloadAsync();
          setCallSound(null);
          if (isCallActiveRef.current) {
            startCallListening();
          }
        }
      });
    } catch (err) {
      console.log("Error in TTS playback:", err);
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
      setDisplayedAiSpeechText("");
      if (isCallActiveRef.current) {
        startCallListening();
      }
    }
  };

  const startCallListening = async () => {
    if (!isCallActiveRef.current) return;
    if (isMutedRef.current) {
      setCallStatus("listening");
      return;
    }

    try {
      // Ensure the correct speaker/earpiece mode is active before recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: !isSpeakerOnRef.current,
      });

      setCallStatus("listening");
      setUserSpeechText("");
      isProcessingRef.current = false;
      hasSpokenRef.current = false;
      lastSpeechTimeRef.current = Date.now();
      callMeteringValuesRef.current = []; // Reset voice volume meter array

      const prevRec = activeRecordingRef.current;
      if (prevRec) {
        try {
          await prevRec.stopAndUnloadAsync();
        } catch {}
        activeRecordingRef.current = null;
      }
      setCallRecording(null);

      const recordingOptions = {
        ...clearRecordingOptions,
        isMeteringEnabled: true,
      };

      const onRecordingStatusUpdate = (status: Audio.RecordingStatus) => {
        if (!status.isRecording) return;
        const metering = status.metering;
        if (metering !== undefined) {
          const now = Date.now();
          if (isMutedRef.current) return;

          callMeteringValuesRef.current.push(metering); // Accumulate volume checks

          // VAD threshold
          if (metering > -35) {
            if (!hasSpokenRef.current) {
              hasSpokenRef.current = true;
            }
            lastSpeechTimeRef.current = now;
          } else {
            const silenceTimeout = 2200;
            if (hasSpokenRef.current && (now - lastSpeechTimeRef.current > silenceTimeout)) {
              if (!isProcessingRef.current) {
                isProcessingRef.current = true;
                processCallAudio();
              }
            }
          }
        }
      };

      // Allow the OS audio routing to settle before starting recording hardware
      await new Promise(resolve => setTimeout(resolve, 150));

      const { recording } = await Audio.Recording.createAsync(
        recordingOptions,
        onRecordingStatusUpdate,
        100
      );
      activeRecordingRef.current = recording;
      setCallRecording(recording);
    } catch (err) {
      console.log("Error starting recording:", err);
    }
  };

  const processCallAudio = async () => {
    if (!isCallActiveRef.current) return;
    try {
      setCallStatus("thinking");
      const rec = activeRecordingRef.current;
      if (!rec) {
        if (isCallActiveRef.current) {
          startCallListening();
        }
        return;
      }

      await rec.stopAndUnloadAsync();
      // Sleep 250ms to allow OS to flush and unlock the audio file
      await new Promise(resolve => setTimeout(resolve, 250));
      
      const uri = rec.getURI();
      activeRecordingRef.current = null;
      setCallRecording(null);

      if (!uri) {
        startCallListening();
        return;
      }

      const user = auth.currentUser;
      const token = await user?.getIdToken();

      const formData = new FormData();
      formData.append("file", {
        uri: uri,
        name: "audio.m4a",
        type: "audio/m4a"
      } as any);

      let transcribeRes;
      try {
        transcribeRes = await fetch(`${BACKEND_URL}/api/transcribe`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
      } catch (fetchErr) {
        console.log("Transcribe Fetch Network Error:", fetchErr, "URL:", `${BACKEND_URL}/api/transcribe`);
        throw fetchErr;
      }

      if (!transcribeRes.ok) {
        const errBody = await transcribeRes.text();
        console.log("Transcribe Server Error Response:", transcribeRes.status, errBody);
        throw new Error("Transcription failed with status " + transcribeRes.status);
      }
      const transData = await transcribeRes.json();
      const transcript = (transData.transcript || "").trim();

      if (!transcript) {
        if (isCallActiveRef.current) {
          startCallListening();
        }
        return;
      }

      if (!isCallActiveRef.current) return;

      setUserSpeechText(transcript);

      // Detect emotion / feelings from volume metering levels during speech
      const meteringValues = callMeteringValuesRef.current;
      let tonePrefix = "";
      if (meteringValues.length > 0) {
        const maxVal = Math.max(...meteringValues);
        const avgVal = meteringValues.reduce((a, b) => a + b, 0) / meteringValues.length;

        if (maxVal > -14) {
          tonePrefix = "[User speaks loudly and intensely] ";
        } else if (maxVal < -28) {
          tonePrefix = "[User speaks very softly, hesitantly and quietly] ";
        } else if (avgVal > -24) {
          tonePrefix = "[User speaks in an energetic or slightly tense tone] ";
        } else {
          tonePrefix = "[User speaks in a calm, steady tone] ";
        }
      }

      let chatRes;
      try {
        chatRes = await fetch(`${BACKEND_URL}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            session_id: Number(activeIdRef.current),
            content: tonePrefix + transcript,
            duration_seconds: secondsActiveRef.current
          })
        });
      } catch (chatErr) {
        console.log("Chat Fetch Network Error:", chatErr, "URL:", `${BACKEND_URL}/api/chat`);
        throw chatErr;
      }

      if (!chatRes.ok) {
        const errBody = await chatRes.text();
        console.log("Chat Server Error Response:", chatRes.status, errBody);
        throw new Error("Chat reply failed with status " + chatRes.status);
      }
      const chatData = await chatRes.json();
      const reply = chatData.reply || "";

      if (!isCallActiveRef.current) return;

      const tempUserId = Date.now();
      setHistory(prev => [
        ...prev,
        { id: tempUserId, text: transcript, sender: "user" },
        { id: tempUserId + 1, text: reply, sender: "ai" }
      ]);

      if (reply === "See you tomorrow in next session.") {
        setSessionFinished(true);
        setCallStatus("ended");
        setIsCallActive(false);
        Alert.alert("Session Finished", "See you tomorrow in next session.");
        return;
      }

      await speakResponse(reply);

    } catch (err) {
      console.log("Error processing call audio:", err);
      setCallStatus("listening");
      startCallListening();
    }
  };

  const toggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    
    if (nextMuted) {
      if (callRecording) {
        try {
          await callRecording.stopAndUnloadAsync();
        } catch {}
        activeRecordingRef.current = null;
        setCallRecording(null);
      }
    } else {
      if (callStatus === "listening") {
        startCallListening();
      }
    }
  };

  const toggleSpeaker = async () => {
    const nextSpeaker = !isSpeakerOn;
    setIsSpeakerOn(nextSpeaker);
    isSpeakerOnRef.current = nextSpeaker;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: !nextSpeaker,
      });
    } catch (err) {
      console.log("Error toggling speaker:", err);
    }
  };

  const endCall = async () => {
    setIsCallActive(false);
    isCallActiveRef.current = false;
    setCallStatus("ended");
    updateConfirmationState(false);
    accumulatedTranscriptRef.current = "";
    
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }

    if (callRecording) {
      try {
        await callRecording.stopAndUnloadAsync();
      } catch {}
      activeRecordingRef.current = null;
      setCallRecording(null);
    }

    if (callSound) {
      try {
        await callSound.unloadAsync();
      } catch {}
      setCallSound(null);
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });
    } catch {}
  };

  const handleStartVoiceRecording = async () => {
    if (sessionFinished || loading) return;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Microphone access is needed to record voice messages.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      // Allow the OS audio routing to settle before starting recording hardware
      await new Promise(resolve => setTimeout(resolve, 150));

      const recordingOptions = clearRecordingOptions;
      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      
      voiceMsgRecordingRef.current = recording;
      setIsVoiceRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.log("Error starting voice message recording:", err);
      Alert.alert("Error", "Could not start recording.");
    }
  };

  const handleCancelVoiceRecording = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    const rec = voiceMsgRecordingRef.current;
    if (rec) {
      try {
        await rec.stopAndUnloadAsync();
      } catch {}
      voiceMsgRecordingRef.current = null;
    }
    setIsVoiceRecording(false);
    setRecordingDuration(0);
  };

  const handleSendVoiceRecording = async () => {
    if (loading || !voiceMsgRecordingRef.current) return;
    
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    const rec = voiceMsgRecordingRef.current;
    voiceMsgRecordingRef.current = null;
    setIsVoiceRecording(false);
    setLoading(true);

    const tempUserMsgId = Date.now();
    let addedTempMsg = false;

    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      if (!uri) {
        setLoading(false);
        return;
      }

      // Add user voice message immediately to the UI
      setHistory(prev => [
        ...prev,
        { id: tempUserMsgId, text: "Voice Message", sender: "user", audio_url: uri }
      ]);
      addedTempMsg = true;
      playSoundEffect("send");

      const user = auth.currentUser;
      const token = await user?.getIdToken();

      const formData = new FormData();
      formData.append("file", {
        uri: uri,
        name: "audio.m4a",
        type: "audio/m4a"
      } as any);
      formData.append("session_id", String(activeId));
      if (secondsActive) {
        formData.append("duration_seconds", String(secondsActive));
      }

      const res = await fetch(`${BACKEND_URL}/api/chat/voice`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        if (data.ai_message.text === "See you tomorrow in next session.") {
          setSessionFinished(true);
        }
        
        // Update user message details and append AI reply
        setHistory(prev => {
          const updated = prev.map(msg => {
            if (msg.id === tempUserMsgId) {
              return {
                id: data.user_message.id,
                text: data.user_message.text,
                sender: "user" as const,
                audio_url: data.user_message.audio_url
              };
            }
            return msg;
          });
          return [
            ...updated,
            { id: data.ai_message.id, text: data.ai_message.text, sender: "ai", audio_url: data.ai_message.audio_url, shouldAutoplay: true }
          ];
        });

        playSoundEffect("receive");
        fetchSuggestions(activeId!);
      } else {
        if (addedTempMsg) {
          setHistory(prev => prev.filter(msg => msg.id !== tempUserMsgId));
        }
        if (data.code === "SESSION_EXPIRED" || data.message === "Session has expired") {
          Alert.alert(
            "Session Expired",
            "Your session expired (conversations are capped at 24 hours). Please start a new one.",
            [{ text: "Start New Session", onPress: () => router.replace("/(screens)/Feel") }]
          );
          return;
        }
        Alert.alert("Error", data.message || "Could not send voice message.");
      }
    } catch (err) {
      console.log("Error sending voice message:", err);
      if (addedTempMsg) {
        setHistory(prev => prev.filter(msg => msg.id !== tempUserMsgId));
      }
      Alert.alert("Connection Error", "Donna could not be reached.");
    } finally {
      setLoading(false);
      setRecordingDuration(0);
    }
  };

  const formatCallDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <SafeAreaView className="flex-1 bg-transparent" edges={['top']}>
      {/* HEADER */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100 bg-transparent">
        {/* Back button removed */}
        <Text className="text-xl font-bold text-gray-800">DONNA AI</Text>
        <View className="flex-row items-center gap-5">
          <TouchableOpacity onPress={startCall} disabled={sessionFinished}>
            <Phone size={22} color={sessionFinished ? "#D1D5DB" : "#55C5CC"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={endSession}>
            <LogOut size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1, marginBottom: tabBarHeight }}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={tabBarHeight}
      >
        {/* MESSAGES AREA */}
        <ScrollView
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          className="flex-1 px-4"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: 20 }}
        >
          {history.map((msg, idx) => (
            <MotiView
              key={msg.id}
              from={{ opacity: 0, scale: 0.9, translateY: 15 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 100 }}
              style={{
                shadowColor: "#0F172A",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 10,
                elevation: 2,
                overflow: 'hidden'
              }}
              className={`rounded-[26px] mb-4 max-w-[82%] ${
                msg.sender === "user"
                  ? "self-end rounded-tr-none"
                  : "self-start rounded-tl-none"
              }`}
            >
              <LinearGradient
                colors={
                  msg.sender === "user"
                    ? ["#808CEA", "#6775E3"]
                    : ["#76C1CE", "#5AB0BD"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="px-5 py-4"
              >
                {msg.audio_url ? (
                  <View>
                    <VoiceMessagePlayer audioUrl={msg.audio_url} sender={msg.sender} shouldAutoplay={msg.shouldAutoplay} />
                    {msg.text && msg.text !== "Voice Message" && (
                      <Text className={`text-[13px] leading-5 mt-2 pt-2 border-t font-semibold ${
                        msg.sender === "user" ? "text-white/95 border-white/20" : "text-slate-800/80 border-black/10"
                      }`}>
                        {msg.text}
                      </Text>
                    )}
                  </View>
                ) : (
                  <View className="flex-row items-start justify-between">
                    <Text className="text-white text-[16px] leading-6 font-semibold tracking-wide flex-1 mr-2">
                      {msg.text}
                    </Text>
                    {msg.sender === "ai" && msg.text && (
                      <TouchableOpacity 
                        onPress={() => handlePlayTTS(msg.id, msg.text)} 
                        className="bg-white/20 p-2 rounded-full shadow-sm ml-2"
                      >
                        {playingMsgId === msg.id ? (
                          <Pause size={14} color="white" />
                        ) : (
                          <Play size={14} color="white" className="ml-0.5" />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </LinearGradient>
            </MotiView>
          ))}
          {loading && (
            <MotiView
              from={{ opacity: 0, scale: 0.9, translateY: 15 }}
              animate={{ opacity: 1, scale: 1, translateY: 0 }}
              transition={{ type: "spring", damping: 15, stiffness: 100 }}
              style={{
                shadowColor: "#0F172A",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 10,
                elevation: 2,
              }}
              className="px-5 py-4 rounded-[26px] mb-4 max-w-[82%] bg-[#76C1CE] self-start rounded-tl-none flex-row items-center gap-1.5"
            >
              <View className="flex-row items-center gap-1.5 h-6">
                <MotiView
                  from={{ translateY: 0 }}
                  animate={{ translateY: -6 }}
                  transition={{ type: "timing", duration: 350, loop: true, repeatReverse: true }}
                  className="w-2.5 h-2.5 rounded-full bg-white"
                />
                <MotiView
                  from={{ translateY: 0 }}
                  animate={{ translateY: -6 }}
                  transition={{ type: "timing", duration: 350, delay: 120, loop: true, repeatReverse: true }}
                  className="w-2.5 h-2.5 rounded-full bg-white"
                />
                <MotiView
                  from={{ translateY: 0 }}
                  animate={{ translateY: -6 }}
                  transition={{ type: "timing", duration: 350, delay: 240, loop: true, repeatReverse: true }}
                  className="w-2.5 h-2.5 rounded-full bg-white"
                />
              </View>
            </MotiView>
          )}
        </ScrollView>

        {/* RESIZE AND OVERLAP FIXED CONTAINER */}
        <View 
          className="bg-transparent px-5 pt-4"
          style={{ paddingBottom: 12 }}
        > 
          {/* SUGGESTION CHIPS */}
          {!sessionFinished && !loading && !isCallActive && suggestions.length > 0 && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              className="flex-row mb-4 -mx-1"
              contentContainerStyle={{ gap: 8, paddingRight: 10 }}
            >
              {suggestions.map((s, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setMessage(s)}
                  activeOpacity={0.7}
                  className="bg-slate-100 border border-slate-200/60 px-4 py-2.5 rounded-full shadow-sm"
                >
                  <Text className="text-slate-700 text-xs font-bold tracking-tight">{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View className="flex-row items-center">
            {isVoiceRecording ? (
              <View className="flex-row items-center bg-gray-100 px-5 rounded-[24px] flex-1 min-h-[48px] py-1 justify-between">
                {/* Blinking Red Dot & Duration */}
                <View className="flex-row items-center gap-2">
                  <MotiView
                    from={{ opacity: 0.3 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: "timing", duration: 500, loop: true, repeatReverse: true }}
                    className="w-3.5 h-3.5 rounded-full bg-red-500"
                  />
                  <Text className="text-gray-700 text-[15px] font-semibold">
                    Recording ({recordingDuration}s)
                  </Text>
                </View>

                {/* Cancel Button */}
                <TouchableOpacity onPress={handleCancelVoiceRecording} className="px-3.5 py-2 bg-gray-200 rounded-full">
                  <Text className="text-gray-600 text-xs font-bold">Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row items-center flex-1 bg-gray-100 rounded-[24px] px-5 relative justify-between">
                <TextInput
                  ref={inputRef}
                  placeholder={sessionFinished ? "See you tomorrow in next session." : "Talk to Donna..."}
                  value={message}
                  onChangeText={setMessage}
                  className="flex-1 text-black text-[16px] pr-8"
                  multiline={true}
                  style={{ maxHeight: 100, minHeight: 40, paddingTop: 10, paddingBottom: 10 }}
                  textAlignVertical="center"
                  placeholderTextColor="#9CA3AF"
                  editable={!sessionFinished}
                />
                
                {/* Mic icon inside the text input box when empty */}
                {!message.trim() && !sessionFinished && (
                  <TouchableOpacity 
                    onPress={handleStartVoiceRecording}
                    className="absolute right-3 p-1.5"
                  >
                    <Mic size={20} color="#55C5CC" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Send / Send Voice Message Button */}
            <TouchableOpacity
              onPress={isVoiceRecording ? handleSendVoiceRecording : handleSend}
              disabled={loading || (!message.trim() && !isVoiceRecording) || sessionFinished}
              className={`p-4 rounded-full ml-3 shadow-lg ${
                (loading || (!message.trim() && !isVoiceRecording) || sessionFinished) ? 'bg-gray-300' : 'bg-black'
              }`}
            >
              <Send size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Voice Call Modal UI Overlay (WhatsApp-style premium design) */}
      <Modal
        visible={isCallActive}
        animationType="slide"
        transparent={false}
        onRequestClose={endCall}
      >
        <LinearGradient
          colors={["#0F172A", "#1E293B", "#0F172A"]}
          className="flex-1 px-6 justify-between py-12"
        >
          {/* Top Header */}
          <View className="items-center mt-6 gap-2">
            <View className="bg-slate-800/80 px-4 py-2 rounded-full border border-slate-700/50 flex-row items-center gap-2">
              <View className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <Text className="text-slate-400 text-xs font-semibold tracking-wider uppercase">
                Secure Therapist Call
              </Text>
            </View>
            <Text className="text-slate-400 text-sm font-medium">
              {formatCallDuration(callDuration)}
            </Text>
          </View>

          {/* Center Avatar & Pulsing Rings */}
          {/* Center Avatar & Pulsing Rings wrapper */}
          <View className="items-center justify-center my-6">
            <View style={{ width: 170, height: 170, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {/* Wave rings - Cyan and Purple Concentric pulsing rings */}
              {callStatus === "listening" && !isMuted && (
                <>
                  <MotiView
                    from={{ scale: 0.9, opacity: 0.8 }}
                    animate={{ scale: 1.7, opacity: 0 }}
                    transition={{
                      type: "timing",
                      duration: 1800,
                      loop: true,
                    }}
                    style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(85, 197, 204, 0.25)' }}
                  />
                  <MotiView
                    from={{ scale: 0.9, opacity: 0.6 }}
                    animate={{ scale: 2.1, opacity: 0 }}
                    transition={{
                      type: "timing",
                      duration: 1800,
                      delay: 450,
                      loop: true,
                    }}
                    style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(128, 140, 234, 0.2)' }}
                  />
                </>
              )}

              {callStatus === "speaking" && (
                <>
                  <MotiView
                    from={{ scale: 0.95, opacity: 0.7 }}
                    animate={{ scale: 1.6, opacity: 0 }}
                    transition={{
                      type: "timing",
                      duration: 1400,
                      loop: true,
                    }}
                    style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(164, 140, 237, 0.25)' }}
                  />
                  <MotiView
                    from={{ scale: 0.95, opacity: 0.5 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    transition={{
                      type: "timing",
                      duration: 1400,
                      delay: 350,
                      loop: true,
                    }}
                    style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(85, 197, 204, 0.2)' }}
                  />
                </>
              )}

              {callStatus === "thinking" && (
                <>
                  <MotiView
                    from={{ scale: 0.9, opacity: 0.8 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    transition={{
                      type: "timing",
                      duration: 2000,
                      loop: true,
                      delay: 0,
                    }}
                    style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(85, 197, 204, 0.25)' }}
                  />
                  <MotiView
                    from={{ scale: 0.9, opacity: 0.6 }}
                    animate={{ scale: 2.0, opacity: 0 }}
                    transition={{
                      type: "timing",
                      duration: 2000,
                      loop: true,
                      delay: 600,
                    }}
                    style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(128, 140, 234, 0.2)' }}
                  />
                  <MotiView
                    from={{ scale: 0.9, opacity: 0.7 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{
                      type: "timing",
                      duration: 2000,
                      loop: true,
                      delay: 1200,
                    }}
                    style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(164, 140, 237, 0.25)' }}
                  />
                </>
              )}

              {/* Main Avatar Container - Circle shape guaranteed */}
              <View style={{ width: 140, height: 140, borderRadius: 70, overflow: 'hidden' }} className="items-center justify-center shadow-2xl border-4 border-slate-800 z-10">
                <LinearGradient
                  colors={["#55C5CC", "#808CEA"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text className="text-white text-5xl font-extrabold tracking-tight">D</Text>
                </LinearGradient>
              </View>
            </View>

            {/* Status Info */}
            <Text className="text-white text-2xl font-bold mt-6 tracking-wide">
              Donna AI
            </Text>
            
            {/* Call State Subtitle */}
            <Text className={`text-sm font-semibold mt-2 tracking-wider uppercase ${
              callStatus === 'listening' ? 'text-[#55C5CC]' :
              callStatus === 'speaking' ? 'text-[#808CEA]' :
              callStatus === 'thinking' ? 'text-amber-400' : 'text-slate-400'
            }`}>
              {isMuted ? "Muted" : (
                callStatus === 'connecting' ? 'Connecting...' :
                callStatus === 'listening' ? 'Listening...' :
                callStatus === 'thinking' ? 'Thinking...' :
                callStatus === 'speaking' ? 'Speaking...' : 'Call Ended'
              )}
            </Text>
          </View>

          {/* Real-time Subtitles Dialog Box */}
          <View className="bg-slate-800/50 border border-slate-700/40 rounded-[28px] p-6 min-h-[140px] justify-center mx-2 my-4 relative">
            {/* Small Speaker Label */}
            <View className="absolute top-3 left-4 flex-row items-center gap-1.5">
              <View className={`w-1.5 h-1.5 rounded-full ${
                callStatus === 'listening' ? 'bg-[#55C5CC]' :
                callStatus === 'speaking' ? 'bg-[#808CEA]' :
                callStatus === 'thinking' ? 'bg-amber-400' : 'bg-slate-400'
              }`} />
              <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                {isMuted ? "Muted" : (
                  callStatus === 'listening' ? 'You' :
                  callStatus === 'speaking' ? 'Donna' :
                  callStatus === 'thinking' ? 'Thinking' : 'Call'
                )}
              </Text>
            </View>

            {isMuted ? (
              <Text className="text-slate-400 text-center italic text-base leading-6">
                Microphone is muted. Tap unmute to speak to Donna.
              </Text>
            ) : (
              <>
                {callStatus === 'listening' && (
                  <Text className="text-slate-300 text-center italic text-base leading-6 w-full">
                    {userSpeechText ? `"${userSpeechText}"` : "I'm listening. Speak freely..."}
                  </Text>
                )}
                {callStatus === 'speaking' && (
                  <Text className="text-white text-center text-lg leading-7 font-semibold tracking-wide w-full">
                    {displayedAiSpeechText}
                  </Text>
                )}
                {callStatus === 'thinking' && (
                  <View className="flex-row justify-center items-center gap-1.5 w-full">
                    <Text className="text-slate-400 text-base font-semibold">Donna is thinking</Text>
                    <View className="flex-row items-center gap-1.5 h-6 ml-2">
                      <MotiView
                        from={{ translateY: 0 }}
                        animate={{ translateY: -6 }}
                        transition={{ type: "timing", duration: 350, loop: true, repeatReverse: true }}
                        className="w-2.5 h-2.5 rounded-full bg-[#55C5CC]"
                      />
                      <MotiView
                        from={{ translateY: 0 }}
                        animate={{ translateY: -6 }}
                        transition={{ type: "timing", duration: 350, delay: 120, loop: true, repeatReverse: true }}
                        className="w-2.5 h-2.5 rounded-full bg-[#808CEA]"
                      />
                      <MotiView
                        from={{ translateY: 0 }}
                        animate={{ translateY: -6 }}
                        transition={{ type: "timing", duration: 350, delay: 240, loop: true, repeatReverse: true }}
                        className="w-2.5 h-2.5 rounded-full bg-[#A48CED]"
                      />
                    </View>
                  </View>
                )}
                {callStatus === 'connecting' && (
                  <Text className="text-slate-400 text-center italic text-base w-full">
                    Connecting secure therapist line...
                  </Text>
                )}
              </>
            )}
          </View>

          {/* Bottom Control Actions (WhatsApp style) */}
          <View className="flex-row justify-center items-center gap-8 mb-6">
            {/* Mute Button */}
            <TouchableOpacity
              onPress={toggleMute}
              activeOpacity={0.7}
              className={`w-14 h-14 rounded-full items-center justify-center border border-slate-700/50 ${
                isMuted ? "bg-white" : "bg-slate-800/90"
              }`}
            >
              {isMuted ? (
                <MicOff size={24} color="#0F172A" />
              ) : (
                <Mic size={24} color="white" />
              )}
            </TouchableOpacity>

            {/* End Call Button */}
            <TouchableOpacity
              onPress={endCall}
              activeOpacity={0.7}
              className="w-16 h-16 rounded-full items-center justify-center bg-red-500 shadow-lg"
            >
              <PhoneOff size={28} color="white" />
            </TouchableOpacity>

            {/* Speaker Button */}
            <TouchableOpacity
              onPress={toggleSpeaker}
              activeOpacity={0.7}
              className={`w-14 h-14 rounded-full items-center justify-center border border-slate-700/50 ${
                isSpeakerOn ? "bg-white" : "bg-slate-800/90"
              }`}
            >
              {isSpeakerOn ? (
                <Volume2 size={24} color="#0F172A" />
              ) : (
                <VolumeX size={24} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Modal>
    </SafeAreaView>
  );
}