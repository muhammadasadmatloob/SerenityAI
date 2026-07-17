import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import Hero3D from './components/Hero3D';
import Features from './components/Features';
import DownloadApp from './components/DownloadApp';
import Footer from './components/Footer';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';

import { User } from 'lucide-react';
import { Link } from 'react-router-dom';

function LandingPage() {
  return (
    <div className="w-full min-h-screen relative">
      {/* Admin Login Icon */}
      <div className="absolute top-6 right-6 z-50">
        <Link 
          to="/admin" 
          className="w-10 h-10 bg-surface/80 backdrop-blur-md border border-border rounded-full flex items-center justify-center text-text-muted hover:text-accent hover:border-accent transition-colors shadow-sm"
          title="Admin Login"
        >
          <User size={20} />
        </Link>
      </div>

      <Hero3D />
      <Features />
      <DownloadApp />
      <Footer />
    </div>
  );
}

import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <HelmetProvider>
      <Router>
        <Helmet>
          <title>Serenity AI | Your 24/7 AI Therapist</title>
          <meta name="description" content="A clinical-grade empathetic AI companion trained in Cognitive Behavioral Therapy. Experience dynamic emotion detection, real-time voice conversations, and a safe space for your mental wellness." />
          <meta name="theme-color" content="#0f172a" />
        </Helmet>
        
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/terms" element={<TermsAndConditions />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Routes>
      </Router>
    </HelmetProvider>
  );
}

export default App;
