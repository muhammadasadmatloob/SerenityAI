import { motion } from 'framer-motion';
import { UserPlus, MessageSquareHeart, HeartHandshake, Compass } from 'lucide-react';

const steps = [
  {
    icon: <UserPlus className="w-8 h-8 text-white" />,
    title: "1. Choose Your Path",
    description: "Start by selecting how you feel. Donna will instantly adapt her approach to meet you exactly where you are, whether you need a listener, a guide, or a friend.",
    color: "from-blue-500 to-cyan-400"
  },
  {
    icon: <MessageSquareHeart className="w-8 h-8 text-white" />,
    title: "2. Speak Freely",
    description: "Engage in real-time voice conversations. Our AI detects emotional subtleties in your voice, responding with empathetic, human-like cadence and warmth.",
    color: "from-purple-500 to-fuchsia-400"
  },
  {
    icon: <HeartHandshake className="w-8 h-8 text-white" />,
    title: "3. Grow & Heal",
    description: "Review your emotional progress over time. In moments of severe distress, our system automatically alerts your loved ones to ensure you are never truly alone.",
    color: "from-emerald-500 to-teal-400"
  }
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

const stepVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }
  }
};

export default function Workflow() {
  return (
    <section className="py-32 bg-background relative overflow-hidden border-b border-border">
      {/* Decorative background grid */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center px-4 py-2 rounded-full bg-surface border border-border mb-8 shadow-sm"
          >
            <Compass className="w-4 h-4 text-purple-400 mr-2" />
            <span className="text-sm font-semibold tracking-wide text-text-main uppercase">How It Works</span>
          </motion.div>

          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
            className="text-4xl md:text-6xl font-extrabold text-text-main mb-6 tracking-tight leading-tight"
          >
            Your Journey to <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Peace</span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto font-medium leading-relaxed"
          >
            Healing isn't linear, but starting is simple. Here is how Serenity AI walks alongside you on your path to mental wellness.
          </motion.p>
        </div>

        <div className="relative mt-20">
          {/* Animated Connecting Line */}
          <div className="absolute top-12 left-[10%] right-[10%] h-1 bg-border hidden md:block rounded-full overflow-hidden">
            <motion.div 
              initial={{ x: "-100%" }}
              whileInView={{ x: "0%" }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="w-full h-full bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500"
            />
          </div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8"
          >
            {steps.map((step, idx) => (
              <motion.div 
                variants={stepVariants}
                key={idx}
                className="relative flex flex-col items-center text-center group"
              >
                {/* Glow Effect behind icon */}
                <div className={`absolute top-0 w-32 h-32 bg-gradient-to-br ${step.color} rounded-full blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity duration-500`} />
                
                <div className="relative z-10 w-24 h-24 rounded-3xl bg-surface border-2 border-border shadow-2xl flex items-center justify-center mb-10 overflow-hidden group-hover:-translate-y-2 transition-transform duration-500 ease-out">
                  <div className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-90`} />
                  <div className="relative z-20 group-hover:scale-110 transition-transform duration-500">
                    {step.icon}
                  </div>
                </div>

                <div className="relative z-10 bg-surface/50 backdrop-blur-sm border border-border p-8 rounded-3xl group-hover:border-white/20 transition-colors duration-500">
                  <h3 className="text-2xl font-bold text-text-main mb-4 tracking-tight">{step.title}</h3>
                  <p className="text-text-muted leading-relaxed font-medium">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
