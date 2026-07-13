import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Brain, Mic, ShieldCheck, HeartPulse } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: <Brain className="w-10 h-10 text-primary" />,
    title: "Clinical Psychology Engine",
    description: "Powered by Cognitive Behavioral Therapy (CBT) frameworks, Donna doesn't just chat—she provides structured, empathetic guidance tailored to your emotional state."
  },
  {
    icon: <Mic className="w-10 h-10 text-primary" />,
    title: "Dynamic Voice Emotion",
    description: "Our TTS engine detects your anxiety or sadness and dynamically alters its pitch and speed to sound more soothing and grounded when you need it most."
  },
  {
    icon: <ShieldCheck className="w-10 h-10 text-primary" />,
    title: "Military-Grade Privacy",
    description: "Your mental health data is sacred. Every message is AES-encrypted at rest in our secure databases. Only you and your AI companion can access your thoughts."
  },
  {
    icon: <HeartPulse className="w-10 h-10 text-primary" />,
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
      gsap.fromTo(
        card,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 0.8,
          delay: index * 0.2,
          ease: "power2.out",
          scrollTrigger: {
            trigger: el,
            start: 'top 60%',
          }
        }
      );
    });
  }, []);

  return (
    <section id="features" ref={sectionRef} className="py-24 bg-slate-900 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="section-header text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Beyond a Chatbot. A <span className="text-primary">Therapeutic Companion.</span>
          </h2>
          <p className="text-xl text-slate-400 max-w-3xl mx-auto">
            Serenity AI is built on a foundation of clinical psychology, lightning-fast AI, and strict data privacy to provide you with a safe space 24/7.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feat, idx) => (
            <div 
              key={idx} 
              ref={el => { cardsRef.current[idx] = el; }}
              className="bg-slate-800/50 border border-slate-700/50 p-8 rounded-3xl hover:bg-slate-800 transition-colors duration-300 backdrop-blur-sm"
            >
              <div className="bg-slate-900/80 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 border border-slate-700/50 shadow-lg">
                {feat.icon}
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">{feat.title}</h3>
              <p className="text-slate-400 text-lg leading-relaxed">
                {feat.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
