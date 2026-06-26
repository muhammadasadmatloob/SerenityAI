import os
import wave
import struct
import math
import subprocess

def analyze_voice_emotion(audio_path: str, transcript: str) -> dict:
    """
    Analyzes raw speech characteristics using pure Python.
    Converts input audio file (M4A/MP3) to a standard 16kHz mono PCM WAV via FFmpeg.
    Extracts speech rate, pauses, energy, zero-crossing rate (ZCR), and pitch variation.
    Detects: anxiety, sadness, anger, happiness, fear, neutral.
    """
    wav_path = audio_path + ".wav"
    try:
        # Convert to a temporary WAV file: 16000Hz, Mono, 16-bit PCM
        subprocess.run(
            ["ffmpeg", "-y", "-i", audio_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
    except Exception as e:
        print(f"FFmpeg audio conversion failed for {audio_path}: {e}")
        return {
            "voice_emotion": "neutral",
            "speech_rate": 0.0,
            "pauses": 0,
            "energy": 0.0,
            "pitch_variation": 0.0
        }

    try:
        with wave.open(wav_path, "rb") as w:
            params = w.getparams()
            n_channels, sampwidth, framerate, n_frames = params[:4]
            if sampwidth != 2:
                # Expecting 16-bit audio (2 bytes per sample)
                return {
                    "voice_emotion": "neutral",
                    "speech_rate": 0.0,
                    "pauses": 0,
                    "energy": 0.0,
                    "pitch_variation": 0.0
                }
            raw_data = w.readframes(n_frames)
            samples = struct.unpack(f"<{n_frames}h", raw_data)
    except Exception as e:
        print(f"Failed to read WAV PCM data: {e}")
        return {
            "voice_emotion": "neutral",
            "speech_rate": 0.0,
            "pauses": 0,
            "energy": 0.0,
            "pitch_variation": 0.0
        }
    finally:
        # Clean up temporary WAV file
        try:
            if os.path.exists(wav_path):
                os.remove(wav_path)
        except Exception:
            pass

    if not samples:
        return {
            "voice_emotion": "neutral",
            "speech_rate": 0.0,
            "pauses": 0,
            "energy": 0.0,
            "pitch_variation": 0.0
        }

    # 1. Compute Audio Duration
    duration = n_frames / framerate

    # 2. Compute RMS Energy (overall volume/power)
    rms_sum = sum(s * s for s in samples)
    energy = math.sqrt(rms_sum / len(samples))

    # 3. Process into 50ms frames to detect pauses and pitch variation
    frame_size = int(framerate * 0.05)  # 50ms frame = 800 samples at 16kHz
    frames = [samples[i:i + frame_size] for i in range(0, len(samples), frame_size) if len(samples[i:i + frame_size]) == frame_size]

    frame_energies = []
    for f in frames:
        f_sum = sum(s * s for s in f)
        frame_energies.append(math.sqrt(f_sum / len(f)))

    # Define a threshold for silence (pauses)
    silence_threshold = max(energy * 0.15, 100.0)

    # Detect pauses: consecutive silent frames (2 frames = 100ms)
    pauses = 0
    pause_frames = 0
    for fe in frame_energies:
        if fe < silence_threshold:
            pause_frames += 1
        else:
            if pause_frames >= 2:
                pauses += 1
            pause_frames = 0

    # 4. Zero Crossing Rate (ZCR) for pitch estimation
    # Human speaking fundamental frequency (F0) is typically between 50Hz and 500Hz.
    frame_pitches = []
    for f in frames:
        zcross = 0
        for i in range(1, len(f)):
            if (f[i] >= 0 and f[i-1] < 0) or (f[i] < 0 and f[i-1] >= 0):
                zcross += 1
        # Approximate frequency = Zero Crossings * FrameRate / (2 * FrameSize)
        freq = (zcross * framerate) / (2 * len(f))
        if 50 <= freq <= 500:
            frame_pitches.append(freq)

    # Pitch variation: standard deviation of pitch frequencies across frames
    if len(frame_pitches) > 1:
        mean_pitch = sum(frame_pitches) / len(frame_pitches)
        var_pitch = sum((p - mean_pitch) ** 2 for p in frame_pitches) / (len(frame_pitches) - 1)
        pitch_variation = math.sqrt(var_pitch)
    else:
        pitch_variation = 0.0

    # 5. Speech Rate (words per minute)
    words = transcript.split()
    # Subtract average pause duration from active duration (rough estimation)
    active_duration = max(duration - (pauses * 0.15), 0.5)
    speech_rate = (len(words) / active_duration) * 60.0 if duration > 0 else 0.0

    # 6. Classify Emotion based on acoustics
    voice_emotion = "neutral"
    
    # Sadness: slow speech rate, low energy, low pitch variation, high pauses
    # Anger: high energy, fast speech rate, high pitch variation
    # Anxiety/Fear: fast speech rate, moderate energy, moderate/high pitch variation, short pauses
    # Happiness: high energy, fast speech rate, high pitch variation, few pauses
    
    if energy < 400 and speech_rate < 100:
        voice_emotion = "sadness"
    elif energy > 2000 and speech_rate > 150 and pitch_variation > 55:
        voice_emotion = "anger"
    elif speech_rate > 165 and pitch_variation > 45:
        # Check if anger or anxiety/fear
        if energy > 1800:
            voice_emotion = "anger"
        else:
            # We map fear and anxiety
            voice_emotion = "anxiety" if energy > 600 else "fear"
    elif energy > 1200 and speech_rate > 130 and pitch_variation > 40:
        voice_emotion = "happiness"
    elif energy < 650 and pitch_variation < 25:
        if speech_rate > 140:
            voice_emotion = "anxiety"
        else:
            voice_emotion = "sadness"

    return {
        "voice_emotion": voice_emotion,
        "speech_rate": round(speech_rate, 1),
        "pauses": pauses,
        "energy": round(energy, 2),
        "pitch_variation": round(pitch_variation, 2)
    }
