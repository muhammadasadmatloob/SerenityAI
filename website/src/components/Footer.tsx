import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-secondary border-t border-slate-800 py-16 relative z-10 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-primary-dark to-transparent opacity-50" />
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 border border-slate-700 rounded-xl flex items-center justify-center shadow-lg">
              <Brain className="w-6 h-6 text-primary-light" />
            </div>
            <div>
              <span className="text-2xl font-black text-white tracking-tight block">Serenity AI</span>
              <span className="text-sm text-primary-dark font-medium tracking-widest uppercase">Clinical Companion</span>
            </div>
          </div>
          
          <div className="flex gap-8 text-sm font-medium text-slate-400">
            <Link to="/terms" className="hover:text-primary-light transition-colors">
              Terms & Conditions
            </Link>
            <Link to="/privacy" className="hover:text-primary-light transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
        
        <div className="mt-16 pt-8 border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-sm">
          <p>&copy; {new Date().getFullYear()} Serenity AI. All rights reserved.</p>
          <p className="flex items-center gap-2">
            Designed for <span className="text-primary-light">Mental Wellness</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
