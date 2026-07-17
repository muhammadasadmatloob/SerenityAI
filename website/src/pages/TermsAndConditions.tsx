import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, AlertOctagon, HeartHandshake, Brain, ShieldAlert, Gavel } from 'lucide-react';
import Footer from '../components/Footer';

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-background text-text-muted relative overflow-hidden">
      <Helmet>
        <title>Terms and Conditions | Serenity AI</title>
      </Helmet>
      
      {/* Decorative Gradients */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
      <div className="absolute top-40 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 py-24 relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-text-main hover:text-accent mb-12 transition-colors font-medium">
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </Link>
        
        <div className="bg-surface/60 backdrop-blur-xl border border-border p-10 rounded-[2rem] mb-16 flex flex-col md:flex-row gap-8 items-center shadow-xl shadow-black/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-50" />
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-3xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20 relative z-10">
            <Scale className="w-12 h-12 text-white" />
          </div>
          <div className="relative z-10 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-extrabold text-text-main mb-4 tracking-tight">Terms of Service</h1>
            <p className="text-lg leading-relaxed text-text-muted font-medium">
              These terms govern your use of the Serenity AI mobile application and backend services. By downloading or accessing Serenity AI, you agree to these clinical and legal boundaries.
            </p>
          </div>
        </div>
        
        <div className="space-y-12 text-text-muted text-lg">
          <p className="text-sm font-bold uppercase tracking-widest text-accent/80 border-b border-border pb-4">Last updated: July 2026</p>
          
          <section className="bg-red-500/5 border border-red-500/20 p-8 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-[50px]" />
            <h2 className="text-2xl font-bold text-red-500 mb-4 flex items-center gap-3 relative z-10">
              <div className="p-2 bg-red-500/20 rounded-lg"><AlertOctagon className="w-6 h-6 text-red-500" /></div>
              1. Strict Medical Disclaimer
            </h2>
            <p className="text-red-400/90 font-medium leading-relaxed relative z-10">
              Serenity AI is an artificial intelligence application designed for therapeutic companionship and emotional grounding. <strong className="text-red-500">It is definitively NOT a replacement for professional psychiatric care, clinical therapy, or medical diagnosis.</strong>
              <br /><br />
              If you are in imminent danger, experiencing suicidal ideation, or suffering a severe psychiatric emergency, you must immediately contact your local emergency services (e.g., 911) or a dedicated suicide prevention hotline. Serenity AI cannot dispatch emergency medical services.
            </p>
          </section>

          <section className="bg-surface/30 p-8 rounded-3xl border border-border/50 hover:border-border transition-colors">
            <h2 className="text-2xl font-bold text-text-main mb-4 flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg"><HeartHandshake className="w-6 h-6 text-accent" /></div>
              2. Emergency Contact Authorization
            </h2>
            <p className="leading-relaxed">
              By providing an emergency contact during onboarding, you explicitly authorize Serenity AI to automatically send an SMS, email, or WhatsApp message containing your live GPS coordinates to that contact if our NLP engines detect language highly indicative of an immediate threat to your life or safety.
            </p>
          </section>
          
          <section className="bg-surface/30 p-8 rounded-3xl border border-border/50 hover:border-border transition-colors">
            <h2 className="text-2xl font-bold text-text-main mb-4 flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg"><Brain className="w-6 h-6 text-purple-400" /></div>
              3. AI Limitations & Hallucinations
            </h2>
            <p className="leading-relaxed">
              While Donna is powered by state-of-the-art Large Language Models fine-tuned on Cognitive Behavioral Therapy (CBT) datasets, she is fundamentally a machine. The AI may occasionally produce inaccurate, unhelpful, or culturally insensitive responses (known as "hallucinations"). You agree not to hold Serenity AI liable for any actions taken or distress caused by the AI's dialogue.
            </p>
          </section>

          <section className="bg-surface/30 p-8 rounded-3xl border border-border/50 hover:border-border transition-colors">
            <h2 className="text-2xl font-bold text-text-main mb-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg"><ShieldAlert className="w-6 h-6 text-emerald-400" /></div>
              4. Acceptable Use Policy
            </h2>
            <p className="leading-relaxed">
              You agree to use Serenity AI for its intended purpose: mental wellness and emotional support. You may not attempt to reverse-engineer the application, extract the underlying system prompts, or intentionally inject malicious payloads designed to bypass the AI's safety guardrails.
            </p>
          </section>

          <section className="bg-surface/30 p-8 rounded-3xl border border-border/50 hover:border-border transition-colors">
            <h2 className="text-2xl font-bold text-text-main mb-4 flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg"><Gavel className="w-6 h-6 text-amber-400" /></div>
              5. Limitation of Liability
            </h2>
            <p className="leading-relaxed">
              To the maximum extent permitted by applicable law, Serenity AI and its developers shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your access to or use of the service.
            </p>
          </section>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
