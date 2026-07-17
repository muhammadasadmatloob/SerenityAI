import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, EyeOff } from 'lucide-react';
import Footer from '../components/Footer';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-text-muted">
      <Helmet>
        <title>Privacy Policy | Serenity AI</title>
      </Helmet>
      
      <div className="max-w-4xl mx-auto px-6 py-24">
        <Link to="/" className="inline-flex items-center gap-2 text-text-main hover:text-accent mb-12 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </Link>
        
        <div className="bg-surface/50 border border-border p-8 rounded-3xl mb-12 flex flex-col md:flex-row gap-8 items-center">
          <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center shrink-0">
            <Shield className="w-10 h-10 text-accent" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-text-main mb-4 tracking-tight">Privacy Policy</h1>
            <p className="text-lg leading-relaxed text-text-muted">
              At Serenity AI, your psychological safety and data privacy are our highest priorities. We treat your conversational data with the same strict confidentiality as a clinical therapist.
            </p>
          </div>
        </div>
        
        <div className="prose prose-invert max-w-none space-y-10 text-text-muted text-lg">
          <p className="text-sm font-bold uppercase tracking-widest text-accent">Last updated: July 2026</p>
          
          <section>
            <h2 className="text-3xl font-bold text-text-main mb-6 flex items-center gap-3">
              <Lock className="w-6 h-6 text-accent" />
              1. Military-Grade Encryption
            </h2>
            <p>
              Every single message, voice transcription, and emotion analytic log is protected using <strong>AES-256 Symmetric Encryption</strong> at rest. Your data is encrypted before it ever reaches our databases. Even if our servers were compromised, your mental health history remains completely unreadable cryptographically.
            </p>
          </section>

          <section>
            <h2 className="text-3xl font-bold text-text-main mb-6 flex items-center gap-3">
              <EyeOff className="w-6 h-6 text-accent" />
              2. Strict No-Sell Policy
            </h2>
            <p>
              We firmly believe that mental health data should never be commoditized. Serenity AI will <strong>never</strong> sell your personal information, chat history, or emotional analytics to third-party advertisers, data brokers, or external agencies.
            </p>
          </section>
          
          <section>
            <h2 className="text-2xl font-bold text-text-main mb-4">3. Emergency Protocols & Location Data</h2>
            <p>
              If our AI engines detect a severe psychological crisis indicating an immediate threat to your life, Serenity AI's SOS protocol is triggered. In these extremely rare, emergency-only circumstances, your real-time GPS location and crisis context are securely transmitted to your pre-designated emergency contacts to facilitate immediate human aid. This location data is not stored long-term and is only captured when an SOS event occurs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-main mb-4">4. Information We Collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Data:</strong> Name, Email Address, and Authentication Identifiers.</li>
              <li><strong>Therapeutic Data:</strong> Session transcripts, emotion probability scores, and selected conversational paths.</li>
              <li><strong>Emergency Data:</strong> Emergency contact phone numbers and live coordinates (only during active SOS events).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-text-main mb-4">5. Account Deletion</h2>
            <p>
              You maintain total sovereignty over your data. If you delete your account, your profile, chat history, and all associated analytics are permanently purged from our Firebase and PostgreSQL systems. There are no backups kept of deleted user data.
            </p>
          </section>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
