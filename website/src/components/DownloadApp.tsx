import { Download, Smartphone } from 'lucide-react';

export default function DownloadApp() {
  return (
    <section id="download" className="py-32 relative z-10 bg-secondary overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-dark/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
        <div className="bg-gradient-to-b from-slate-800/80 to-slate-900/80 border border-slate-700/50 rounded-[3rem] p-12 md:p-24 relative overflow-hidden shadow-2xl backdrop-blur-2xl">
          
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-primary-light/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-light to-primary-dark rounded-3xl mx-auto flex items-center justify-center mb-10 shadow-[0_0_40px_rgba(20,184,166,0.4)] animate-bounce" style={{animationDuration: '4s'}}>
              <Smartphone className="w-12 h-12 text-secondary" />
            </div>
            
            <h2 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tight">
              Ready to find <br className="md:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-primary-dark">your peace?</span>
            </h2>
            
            <p className="text-xl md:text-2xl text-slate-300 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
              Download the Serenity AI Android application directly to your device and start your journey towards better mental wellness today.
            </p>
            
            <a 
              href="https://github.com/muhammadasadmatloob/SerenityAI/raw/main/APK/SerenityAI.apk"
              className="inline-flex items-center gap-4 px-12 py-6 text-xl font-bold text-secondary bg-white rounded-2xl hover:bg-primary-light hover:scale-105 transition-all duration-300 shadow-[0_0_40px_rgba(255,255,255,0.2)] group"
            >
              <Download className="w-7 h-7 group-hover:-translate-y-1 transition-transform" />
              Download APK for Android
            </a>
            
            <div className="mt-10 flex items-center justify-center gap-6 text-slate-400 text-sm font-medium">
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary-light"></span> Version 1.0</span>
              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary"></span> Android 9.0+</span>
              <span className="w-1 h-1 rounded-full bg-slate-600"></span>
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary-dark"></span> Free Download</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
