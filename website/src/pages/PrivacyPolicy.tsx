import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Footer from '../components/Footer';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-secondary text-slate-300">
      <Helmet>
        <title>Privacy Policy | Serenity AI</title>
      </Helmet>
      
      <div className="max-w-4xl mx-auto px-6 py-20">
        <Link to="/" className="inline-flex items-center gap-2 text-primary-light hover:text-white mb-12 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold text-white mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert prose-emerald max-w-none space-y-6">
          <p>Last updated: July 2026</p>
          
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Information We Collect</h2>
          <p>We collect information you provide directly to us when you create an account, such as your name, email address, and demographic information. We also temporarily process live location data strictly for grounding exercises when requested.</p>
          
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. How We Handle Chat Data</h2>
          <p>Your privacy is our absolute highest priority. <strong>All text and transcribed voice messages are encrypted using AES symmetric encryption before being saved to our databases.</strong></p>
          <p>When interacting with our AI engine, personally identifiable information (PII) is stripped where technically feasible. We do not sell your conversational data to advertisers.</p>
          
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. Security</h2>
          <p>We implement military-grade security protocols, including Firebase JWT authentication and encrypted transport layers (HTTPS), to protect your personal information.</p>
          
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please reach out to the development team via the GitHub repository.</p>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
