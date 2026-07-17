import { motion } from 'framer-motion';
import { UserPlus, MessageSquareHeart, HeartHandshake } from 'lucide-react';

const steps = [
  {
    icon: <UserPlus className="w-8 h-8 text-white" />,
    title: "1. Choose Your Path",
    description: "Start by selecting how you feel. Donna will instantly adapt her approach to meet you exactly where you are, whether you need a listener, a guide, or a friend."
  },
  {
    icon: <MessageSquareHeart className="w-8 h-8 text-white" />,
    title: "2. Speak Freely",
    description: "Engage in real-time voice conversations. Our AI detects emotional subtleties in your voice, responding with empathetic, human-like cadence and warmth."
  },
  {
    icon: <HeartHandshake className="w-8 h-8 text-white" />,
    title: "3. Grow & Heal",
    description: "Review your emotional progress over time. In moments of severe distress, our system automatically alerts your loved ones to ensure you are never truly alone."
  }
];

export default function Workflow() {
  return (
    <section className="py-24 bg-surface relative border-b border-border">
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center px-4 py-1.5 mb-6 text-sm font-medium text-accent bg-accent/10 border border-accent/20 rounded-full">
              How It Works
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-text-main mb-6 tracking-tight">
              Your Journey to Peace
            </h2>
            <p className="text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
              Healing isn't linear, but starting is simple. Here is how Serenity AI walks alongside you on your path to mental wellness.
            </p>
          </motion.div>
        </div>

        <div className="relative">
          {/* Connecting Line */}
          <div className="absolute top-12 left-0 w-full h-0.5 bg-border hidden md:block" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {steps.map((step, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: idx * 0.2 }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center mb-8 relative z-10 shadow-[0_0_30px_rgba(59,130,246,0.3)] border-4 border-surface">
                  {step.icon}
                </div>
                <h3 className="text-2xl font-bold text-text-main mb-4">{step.title}</h3>
                <p className="text-text-muted leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
