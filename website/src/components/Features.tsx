import { Brain, Mic, ShieldCheck, HeartPulse } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  {
    icon: <Brain className="w-6 h-6 text-accent" />,
    title: "Clinical Psychology Engine",
    description: "Powered by Cognitive Behavioral Therapy (CBT) frameworks, Donna doesn't just chat—she provides structured, empathetic guidance tailored to your emotional state."
  },
  {
    icon: <Mic className="w-6 h-6 text-accent" />,
    title: "Dynamic Voice Emotion",
    description: "Our TTS engine detects your anxiety or sadness and dynamically alters its pitch and speed to sound more soothing and grounded when you need it most."
  },
  {
    icon: <ShieldCheck className="w-6 h-6 text-accent" />,
    title: "Military-Grade Privacy",
    description: "Your mental health data is sacred. Every message is AES-encrypted at rest in our secure databases. Only you and your AI companion can access your thoughts."
  },
  {
    icon: <HeartPulse className="w-6 h-6 text-accent" />,
    title: "Live Emotion Tracking",
    description: "Track your emotional journey over time. Generate beautiful PDF analytics reports to see how your mental resilience is improving."
  }
];

export default function Features() {
  return (
    <section id="features" className="py-24 bg-background relative z-10 border-b border-border">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-3xl md:text-5xl font-bold text-text-main mb-4 tracking-tight"
          >
            Built for Mental Wellness
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="text-lg text-text-muted max-w-2xl mx-auto font-normal"
          >
            A foundation of clinical psychology, lightning-fast AI, and strict data privacy.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {features.map((feat, idx) => (
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, ease: "easeOut", delay: idx * 0.1 }}
              key={idx} 
              className="bg-surface border border-border p-8 rounded-2xl hover:bg-surface-hover transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-border flex items-center justify-center mb-6">
                {feat.icon}
              </div>
              <h3 className="text-xl font-semibold text-text-main mb-3">{feat.title}</h3>
              <p className="text-text-muted text-base leading-relaxed">
                {feat.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
