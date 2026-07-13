import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 py-12 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary" />
            <span className="text-2xl font-bold text-white tracking-tight">Serenity AI</span>
          </div>
          
          <div className="flex gap-8 text-sm font-medium text-slate-400">
            <Link to="/terms" className="hover:text-primary transition-colors">
              Terms & Conditions
            </Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} Serenity AI. All rights reserved. Designed for Mental Wellness.
        </div>
      </div>
    </footer>
  );
}
