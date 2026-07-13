import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import Hero3D from './components/Hero3D';
import Features from './components/Features';
import DownloadApp from './components/DownloadApp';
import Footer from './components/Footer';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';

function LandingPage() {
  return (
    <div className="w-full min-h-screen">
      <Hero3D />
      <Features />
      <DownloadApp />
      <Footer />
    </div>
  );
}

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
        </Routes>
      </Router>
    </HelmetProvider>
  );
}

export default App;
