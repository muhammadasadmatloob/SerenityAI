import { Download, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DownloadApp() {
  return (
    <section id="download" className="py-24 bg-surface border-b border-border">
      <div className="max-w-4xl mx-auto px-6 text-center">
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-16 h-16 bg-border rounded-2xl mx-auto flex items-center justify-center mb-8"
        >
          <Smartphone className="w-8 h-8 text-text-main" />
        </motion.div>
        
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="text-3xl md:text-5xl font-bold text-text-main mb-6 tracking-tight"
        >
          Ready to find your peace?
        </motion.h2>
        
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          className="text-lg text-text-muted mb-10 max-w-xl mx-auto"
        >
          Download the Serenity AI Android application directly to your device and start your journey towards better mental wellness.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }}
        >
          <a 
            href="https://github.com/muhammadasadmatloob/SerenityAI/raw/main/APK/SerenityAI.apk"
            className="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 text-base font-semibold text-background bg-text-main rounded-full hover:bg-gray-200 transition-colors"
          >
            <Download className="w-5 h-5" />
            Download APK for Android
          </a>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.5 }}
          className="mt-8 flex items-center justify-center gap-4 text-text-muted text-sm"
        >
          <span>Version 1.0</span>
          <span className="w-1 h-1 rounded-full bg-border"></span>
          <span>Android 9.0+</span>
          <span className="w-1 h-1 rounded-full bg-border"></span>
          <span>Free</span>
        </motion.div>

      </div>
    </section>
  );
}
