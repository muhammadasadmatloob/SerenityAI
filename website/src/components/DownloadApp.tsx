import { Download, Smartphone } from 'lucide-react';

export default function DownloadApp() {
  return (
    <section id="download" className="py-32 relative z-10 bg-gradient-to-b from-slate-900 to-slate-950">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <div className="bg-slate-800/80 border border-primary/20 rounded-3xl p-12 md:p-20 relative overflow-hidden shadow-[0_0_50px_rgba(74,222,128,0.1)]">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
          
          <div className="relative z-10">
            <Smartphone className="w-20 h-20 text-primary mx-auto mb-8" />
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
              Ready to find your peace?
            </h2>
            <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto">
              Download the Serenity AI Android application directly to your device and start your journey towards better mental wellness today.
            </p>
            
            <a 
              href="https://github.com/muhammadasadmatloob/SerenityAI/raw/main/APK/SerenityAI.apk"
              className="inline-flex items-center gap-3 px-10 py-5 text-xl font-bold text-slate-900 bg-primary rounded-2xl hover:bg-emerald-400 hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(74,222,128,0.5)]"
            >
              <Download className="w-6 h-6" />
              Download APK for Android
            </a>
            
            <p className="text-slate-500 mt-6 text-sm">
              Version 1.0 • Requires Android 9.0 or higher
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
