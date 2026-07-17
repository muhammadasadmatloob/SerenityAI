import { motion } from 'framer-motion';
import { Smartphone, Activity, ShieldAlert, Sparkles, Brain } from 'lucide-react';

const showcaseFeatures = [
  {
    icon: <Sparkles className="w-6 h-6 text-accent" />,
    title: "Therapeutic Persona",
    description: "Donna adapts her personality and tone to match your chosen path, offering highly personalized conversations that feel incredibly human."
  },
  {
    icon: <Activity className="w-6 h-6 text-accent" />,
    title: "Mood & Emotion Tracking",
    description: "Every conversation helps map your emotional journey. View detailed analytics to understand your triggers and celebrate your progress."
  },
  {
    icon: <ShieldAlert className="w-6 h-6 text-red-500" />,
    title: "Emergency SOS Protocol",
    description: "If severe distress is detected, Serenity AI instantly dispatches an urgent alert to your trusted contacts with your live location."
  },
  {
    icon: <Smartphone className="w-6 h-6 text-accent" />,
    title: "Real-time Voice Chat",
    description: "Tired of typing? Speak naturally. Donna listens, detects the emotion in your voice, and replies with genuine vocal empathy."
  }
];

export default function AppShowcase() {
  return (
    <section className="py-24 bg-background relative overflow-hidden border-b border-border">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-accent/5 blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Side: Text and Features */}
          <div>
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <div className="inline-flex items-center px-4 py-1.5 mb-6 text-sm font-medium text-accent bg-accent/10 border border-accent/20 rounded-full">
                Inside the App
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-text-main mb-6 tracking-tight">
                Designed to heal. <br/>
                <span className="text-text-muted">Built to protect.</span>
              </h2>
              <p className="text-lg text-text-muted mb-10 leading-relaxed">
                Experience a completely reimagined approach to digital mental health. Serenity AI combines clinical therapy frameworks with breathtaking design and advanced safety protocols.
              </p>
            </motion.div>

            <div className="space-y-8">
              {showcaseFeatures.map((feat, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-surface border border-border flex items-center justify-center shadow-sm">
                    {feat.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-text-main mb-2">{feat.title}</h3>
                    <p className="text-text-muted leading-relaxed">{feat.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Side: Visual/Mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative flex justify-center"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 to-purple-500/20 blur-[100px] rounded-full" />
            <div className="relative w-full max-w-md aspect-[4/5] bg-surface rounded-[2.5rem] border border-border shadow-2xl overflow-hidden flex flex-col">
              <div className="h-14 border-b border-border bg-surface-hover flex items-center px-6">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/50" />
                </div>
              </div>
              <div className="flex-1 p-8 flex flex-col items-center justify-center text-center bg-gradient-to-b from-background to-surface">
                <div className="w-24 h-24 bg-accent/20 rounded-full flex items-center justify-center mb-6 border border-accent/30 animate-pulse">
                  <Brain className="w-10 h-10 text-accent" />
                </div>
                <h3 className="text-2xl font-bold text-text-main mb-3">Donna is listening...</h3>
                <div className="w-full h-12 bg-surface border border-border rounded-full flex items-center justify-center overflow-hidden">
                  <div className="flex gap-1 items-center h-full px-4">
                    {[...Array(12)].map((_, i) => (
                      <motion.div 
                        key={i}
                        animate={{ height: ['20%', '80%', '40%', '100%', '30%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                        className="w-1.5 bg-accent/80 rounded-full"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
