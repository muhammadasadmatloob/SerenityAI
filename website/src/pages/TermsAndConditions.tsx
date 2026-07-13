import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Footer from '../components/Footer';

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-300">
      <Helmet>
        <title>Terms and Conditions | Serenity AI</title>
      </Helmet>
      
      <div className="max-w-4xl mx-auto px-6 py-20">
        <Link to="/" className="inline-flex items-center gap-2 text-primary hover:text-emerald-400 mb-12 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          Back to Home
        </Link>
        
        <h1 className="text-4xl font-bold text-white mb-8">Terms and Conditions</h1>
        
        <div className="prose prose-invert prose-emerald max-w-none space-y-6">
          <p>Last updated: July 2026</p>
          
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>By accessing and downloading the Serenity AI mobile application, you accept and agree to be bound by the terms and provision of this agreement.</p>
          
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">2. Not a Medical Device</h2>
          <p>Serenity AI provides a therapeutic companion powered by Artificial Intelligence. <strong>It is NOT a replacement for professional medical advice, diagnosis, or psychiatric treatment.</strong> If you are in crisis, please contact your local emergency services immediately.</p>
          
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">3. User Data & Privacy</h2>
          <p>We respect your privacy. All chat logs and voice recordings are encrypted. By using this service, you consent to our data processing as outlined in our Privacy Policy. Voice recordings are processed in real-time and are not stored in plain-text.</p>
          
          <h2 className="text-2xl font-semibold text-white mt-8 mb-4">4. Limitation of Liability</h2>
          <p>In no event shall Serenity AI, nor its developers, be liable for any indirect, consequential, or special liability arising out of or in any way related to your use of this application.</p>
        </div>
      </div>
      
      <Footer />
    </div>
  );
}
