import { Download, Smartphone } from 'lucide-react';

export default function DownloadApp() {
  return (
    <section id="download" className="py-24 bg-surface border-b border-border">
      <div className="max-w-4xl mx-auto px-6 text-center">
        
        <div className="w-16 h-16 bg-border rounded-2xl mx-auto flex items-center justify-center mb-8">
          <Smartphone className="w-8 h-8 text-text-main" />
        </div>
        
        <h2 className="text-3xl md:text-5xl font-bold text-text-main mb-6 tracking-tight">
          Ready to find your peace?
        </h2>
        
        <p className="text-lg text-text-muted mb-10 max-w-xl mx-auto">
          Download the Serenity AI Android application directly to your device and start your journey towards better mental wellness.
        </p>
        
        <a 
          href="https://github.com/muhammadasadmatloob/SerenityAI/raw/main/APK/SerenityAI.apk"
          className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 text-base font-semibold text-background bg-text-main rounded-full hover:bg-gray-200 transition-colors"
        >
          <Download className="w-5 h-5" />
          Download APK for Android
        </a>
        
        <div className="mt-8 flex items-center justify-center gap-4 text-text-muted text-sm">
          <span>Version 1.0</span>
          <span className="w-1 h-1 rounded-full bg-border"></span>
          <span>Android 9.0+</span>
          <span className="w-1 h-1 rounded-full bg-border"></span>
          <span>Free</span>
        </div>

      </div>
    </section>
  );
}
