import { Brain, Mic, ShieldCheck, HeartPulse, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  {
    icon: <Brain className="w-8 h-8 text-accent" />,
    title: "Clinical Psychology Engine",
    description: "Powered by Cognitive Behavioral Therapy (CBT) frameworks, Donna doesn't just chat—she provides structured, empathetic guidance tailored to your emotional state.",
    gradient: "from-blue-500/20 to-cyan-500/20",
    border: "group-hover:border-blue-500/50"
  },
  {
    icon: <Mic className="w-8 h-8 text-purple-400" />,
    title: "Dynamic Voice Emotion",
    description: "Our TTS engine detects your anxiety or sadness and dynamically alters its pitch and speed to sound more soothing and grounded when you need it most.",
    gradient: "from-purple-500/20 to-fuchsia-500/20",
    border: "group-hover:border-purple-500/50"
  },
  {
    icon: <ShieldCheck className="w-8 h-8 text-emerald-400" />,
    title: "Military-Grade Privacy",
    description: "Your mental health data is sacred. Every message is AES-encrypted at rest in our secure databases. Only you and your AI companion can access your thoughts.",
    gradient: "from-emerald-500/20 to-teal-500/20",
    border: "group-hover:border-emerald-500/50"
  },
  {
    icon: <HeartPulse className="w-8 h-8 text-rose-400" />,
    title: "Live Emotion Tracking",
    description: "Track your emotional journey over time. Generate beautiful PDF analytics reports to see how your mental resilience is improving.",
    gradient: "from-rose-500/20 to-pink-500/20",
    border: "group-hover:border-rose-500/50"
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }
  }
};

export default function Features() {
  return (
    <section id="features" className="py-32 bg-background relative z-10 overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center px-4 py-2 rounded-full bg-surface border border-border mb-8 shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-accent mr-2" />
            <span className="text-sm font-semibold tracking-wide text-text-main uppercase">Groundbreaking Tech</span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-4xl md:text-6xl font-extrabold text-text-main mb-6 tracking-tight leading-tight"
          >
            Built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-purple-400">Mental Wellness</span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto font-medium leading-relaxed"
          >
            A foundation of clinical psychology, lightning-fast AI, and strict data privacy.
          </motion.p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-8"
        >
          {features.map((feat, idx) => (
            <motion.div 
              variants={itemVariants}
              key={idx} 
              className={`group relative bg-surface/50 backdrop-blur-xl border border-border p-10 rounded-[2rem] overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-black/10 hover:-translate-y-1 ${feat.border}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${feat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              
              <div className="relative z-10 flex flex-col h-full">
                <div className="w-16 h-16 rounded-2xl bg-background border border-border flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform duration-500 ease-out">
                  {feat.icon}
                </div>
                
                <h3 className="text-2xl font-bold text-text-main mb-4 tracking-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/80 transition-all">
                  {feat.title}
                </h3>
                
                <p className="text-text-muted text-base md:text-lg leading-relaxed font-medium">
                  {feat.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
