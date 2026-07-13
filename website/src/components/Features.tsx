import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Brain, Mic, ShieldCheck, HeartPulse } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: <Brain className="w-8 h-8 text-primary-light" />,
    title: "Clinical Psychology Engine",
    description: "Powered by Cognitive Behavioral Therapy (CBT) frameworks, Donna doesn't just chat—she provides structured, empathetic guidance tailored to your emotional state."
  },
  {
    icon: <Mic className="w-8 h-8 text-primary-light" />,
    title: "Dynamic Voice Emotion",
    description: "Our TTS engine detects your anxiety or sadness and dynamically alters its pitch and speed to sound more soothing and grounded when you need it most."
  },
  {
    icon: <ShieldCheck className="w-8 h-8 text-primary-light" />,
    title: "Military-Grade Privacy",
    description: "Your mental health data is sacred. Every message is AES-encrypted at rest in our secure databases. Only you and your AI companion can access your thoughts."
  },
  {
    icon: <HeartPulse className="w-8 h-8 text-primary-light" />,
    title: "Live Emotion Tracking",
    description: "Track your emotional journey over time. Generate beautiful PDF analytics reports to see how your mental resilience is improving."
  }
];

export default function Features() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    
    const header = el.querySelector('.section-header');
    if (header) {
      gsap.fromTo(
        header,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          scrollTrigger: {
            trigger: el,
            start: 'top 80%',
          }
        }
      );
    }

    cardsRef.current.forEach((card, index) => {
      if (!card) return;
      gsap.fromTo(
        card,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay: index * 0.15,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: 'top 60%',
          }
        }
      );
    });
  }, []);

  return (
    <section id="features" ref={sectionRef} className="py-32 bg-secondary relative z-10 overflow-hidden">
      {/* Background Decorators */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary-dark/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-primary/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="section-header text-center mb-24">
          <div className="inline-flex items-center justify-center px-4 py-2 mb-6 text-sm font-bold tracking-widest uppercase text-slate-400 bg-slate-900/50 rounded-full border border-slate-800">
            Intelligent Features
          </div>
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
            Beyond a Chatbot. <br className="hidden md:block" />
            A <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-primary-dark">Therapeutic Companion.</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto font-light">
            Serenity AI is built on a foundation of clinical psychology, lightning-fast AI, and strict data privacy to provide you with a safe space 24/7.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {features.map((feat, idx) => (
            <div 
              key={idx} 
              ref={el => { cardsRef.current[idx] = el; }}
              className="group relative bg-slate-900/40 border border-slate-700/50 p-10 rounded-[2rem] hover:bg-slate-800/60 transition-all duration-500 backdrop-blur-xl overflow-hidden shadow-2xl hover:shadow-[0_0_40px_rgba(20,184,166,0.15)]"
            >
              {/* Card Hover Glow */}
              <div className="absolute top-0 right-0 p-32 bg-primary/10 blur-[80px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center mb-8 border border-slate-700/50 shadow-inner group-hover:scale-110 transition-transform duration-500 group-hover:border-primary/30">
                  {feat.icon}
                </div>
                <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">{feat.title}</h3>
                <p className="text-slate-400 text-lg leading-relaxed font-light">
                  {feat.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
