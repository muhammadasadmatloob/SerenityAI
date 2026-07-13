import { Link } from 'react-router-dom';
import { Brain } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-background py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-text-main" />
            <span className="text-xl font-bold text-text-main tracking-tight">Serenity AI</span>
          </div>
          
          <div className="flex gap-6 text-sm font-medium text-text-muted">
            <Link to="/terms" className="hover:text-text-main transition-colors">
              Terms & Conditions
            </Link>
            <Link to="/privacy" className="hover:text-text-main transition-colors">
              Privacy Policy
            </Link>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-text-muted text-sm">
          <p>&copy; {new Date().getFullYear()} Serenity AI. All rights reserved.</p>
          <p>Designed for Mental Wellness</p>
        </div>
      </div>
    </footer>
  );
}
