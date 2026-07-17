import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, EyeOff, MapPin, Database, Trash2 } from 'lucide-react';
import Footer from '../components/Footer';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-text-muted relative overflow-hidden">
      <Helmet>
        <title>Privacy Policy | Serenity AI</title>
      </Helmet>

      {/* Decorative Gradients */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none" />
      <div className="absolute top-40 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-4xl mx-auto px-6 py-24 relative z-10">
        <Link to="/" className="inline-flex items-center gap-2 text-text-main hover:text-accent mb-12 transition-colors font-medium">
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </Link>
        
        <div className="bg-surface/60 backdrop-blur-xl border border-border p-10 rounded-[2rem] mb-16 flex flex-col md:flex-row gap-8 items-center shadow-xl shadow-black/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-50" />
          <div className="w-24 h-24 bg-gradient-to-br from-accent to-purple-500 rounded-3xl flex items-center justify-center shrink-0 shadow-lg shadow-accent/20 relative z-10">
            <Shield className="w-12 h-12 text-white" />
          </div>
          <div className="relative z-10 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-extrabold text-text-main mb-4 tracking-tight">Privacy Policy</h1>
            <p className="text-lg leading-relaxed text-text-muted font-medium">
              At Serenity AI, your psychological safety and data privacy are our absolute highest priorities. We treat your conversational data with the exact same strict confidentiality as a clinical therapist.
            </p>
          </div>
        </div>
        
        <div className="space-y-12 text-text-muted text-lg">
          <p className="text-sm font-bold uppercase tracking-widest text-accent/80 border-b border-border pb-4">Last updated: July 2026</p>
          
          <section className="bg-surface/30 p-8 rounded-3xl border border-border/50 hover:border-border transition-colors">
            <h2 className="text-2xl font-bold text-text-main mb-4 flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg"><Lock className="w-6 h-6 text-accent" /></div>
              1. Military-Grade Encryption
            </h2>
            <p className="leading-relaxed">
              Every single message, voice transcription, and emotion analytic log is protected using <strong className="text-text-main">AES-256 Symmetric Encryption</strong> at rest. Your data is encrypted before it ever reaches our databases. Even if our servers were compromised, your mental health history remains completely unreadable cryptographically.
            </p>
          </section>

          <section className="bg-surface/30 p-8 rounded-3xl border border-border/50 hover:border-border transition-colors">
            <h2 className="text-2xl font-bold text-text-main mb-4 flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg"><EyeOff className="w-6 h-6 text-purple-400" /></div>
              2. Strict No-Sell Policy
            </h2>
            <p className="leading-relaxed">
              We firmly believe that mental health data should never be commoditized. Serenity AI will <strong className="text-text-main">never</strong> sell your personal information, chat history, or emotional analytics to third-party advertisers, data brokers, or external agencies.
            </p>
          </section>
          
          <section className="bg-surface/30 p-8 rounded-3xl border border-border/50 hover:border-border transition-colors">
            <h2 className="text-2xl font-bold text-text-main mb-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg"><MapPin className="w-6 h-6 text-emerald-400" /></div>
              3. Emergency Protocols & Location Data
            </h2>
            <p className="leading-relaxed">
              If our AI engines detect a severe psychological crisis indicating an immediate threat to your life, Serenity AI's SOS protocol is triggered. In these extremely rare, emergency-only circumstances, your real-time GPS location and crisis context are securely transmitted to your pre-designated emergency contacts to facilitate immediate human aid. This location data is not stored long-term and is only captured when an SOS event occurs.
            </p>
          </section>

          <section className="bg-surface/30 p-8 rounded-3xl border border-border/50 hover:border-border transition-colors">
            <h2 className="text-2xl font-bold text-text-main mb-6 flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg"><Database className="w-6 h-6 text-amber-400" /></div>
              4. Information We Collect
            </h2>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="bg-background p-5 rounded-2xl border border-border">
                <h3 className="font-bold text-text-main mb-2">Account Data</h3>
                <p className="text-sm">Name, Email Address, and Authentication Identifiers.</p>
              </div>
              <div className="bg-background p-5 rounded-2xl border border-border">
                <h3 className="font-bold text-text-main mb-2">Therapeutic Data</h3>
                <p className="text-sm">Session transcripts, emotion probability scores, and conversational paths.</p>
              </div>
              <div className="bg-background p-5 rounded-2xl border border-border">
                <h3 className="font-bold text-text-main mb-2">Emergency Data</h3>
                <p className="text-sm">Emergency contact numbers and live coordinates (only during active SOS events).</p>
              </div>
            </div>
          </section>

          <section className="bg-surface/30 p-8 rounded-3xl border border-border/50 hover:border-border transition-colors">
            <h2 className="text-2xl font-bold text-text-main mb-4 flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 rounded-lg"><Trash2 className="w-6 h-6 text-rose-400" /></div>
              5. Account Deletion
            </h2>
            <p className="leading-relaxed">
              You maintain total sovereignty over your data. If you delete your account, your profile, chat history, and all associated analytics are permanently purged from our Firebase and PostgreSQL systems. There are no backups kept of deleted user data.
            </p>
          </section>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
