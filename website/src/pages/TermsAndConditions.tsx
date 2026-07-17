import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, AlertOctagon, HeartHandshake } from 'lucide-react';
import Footer from '../components/Footer';

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-background text-text-muted">
      <Helmet>
        <title>Terms and Conditions | Serenity AI</title>
      </Helmet>
      
      <div className="max-w-4xl mx-auto px-6 py-24">
        <Link to="/" className="inline-flex items-center gap-2 text-text-main hover:text-accent mb-12 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </Link>
        
        <div className="bg-surface/50 border border-border p-8 rounded-3xl mb-12 flex flex-col md:flex-row gap-8 items-center">
          <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center shrink-0">
            <Scale className="w-10 h-10 text-accent" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-text-main mb-4 tracking-tight">Terms of Service</h1>
            <p className="text-lg leading-relaxed text-text-muted">
              These terms govern your use of the Serenity AI mobile application and backend services. By downloading or accessing Serenity AI, you agree to these clinical and legal boundaries.
            </p>
          </div>
        </div>
        
        <div className="prose prose-invert max-w-none space-y-10 text-text-muted text-lg">
          <p className="text-sm font-bold uppercase tracking-widest text-accent">Last updated: July 2026</p>
          
          <section className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl">
            <h2 className="text-2xl font-bold text-red-500 mb-4 flex items-center gap-3">
              <AlertOctagon className="w-6 h-6" />
              1. Strict Medical Disclaimer
            </h2>
            <p className="text-red-400/90 font-medium">
              Serenity AI is an artificial intelligence application designed for therapeutic companionship and emotional grounding. <strong>It is definitively NOT a replacement for professional psychiatric care, clinical therapy, or medical diagnosis.</strong>
              <br /><br />
              If you are in imminent danger, experiencing suicidal ideation, or suffering a severe psychiatric emergency, you must immediately contact your local emergency services (e.g., 911) or a dedicated suicide prevention hotline. Serenity AI cannot dispatch emergency medical services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-main mb-4 flex items-center gap-3">
              <HeartHandshake className="w-6 h-6 text-accent" />
              2. Emergency Contact Authorization
            </h2>
            <p>
              By providing an emergency contact during onboarding, you explicitly authorize Serenity AI to automatically send an SMS, email, or WhatsApp message containing your live GPS coordinates to that contact if our NLP engines detect language highly indicative of an immediate threat to your life or safety.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold text-text-main mb-4">3. AI Limitations & Hallucinations</h2>
            <p>
              While Donna is powered by state-of-the-art Large Language Models fine-tuned on Cognitive Behavioral Therapy (CBT) datasets, she is fundamentally a machine. The AI may occasionally produce inaccurate, unhelpful, or culturally insensitive responses (known as "hallucinations"). You agree not to hold Serenity AI liable for any actions taken or distress caused by the AI's dialogue.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-main mb-4">4. Acceptable Use Policy</h2>
            <p>
              You agree to use Serenity AI for its intended purpose: mental wellness and emotional support. You may not attempt to reverse-engineer the application, extract the underlying system prompts, or intentionally inject malicious payloads designed to bypass the AI's safety guardrails.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-main mb-4">5. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Serenity AI and its developers shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your access to or use of the service.
            </p>
          </section>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
