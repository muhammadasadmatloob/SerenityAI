export default function Hero3D() {
  return (
    <div className="relative w-full min-h-screen bg-background overflow-hidden flex items-center border-b border-border">
      
      {/* Clean Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-24 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
        
        {/* Left Column: Text Content */}
        <div className="flex-1 flex flex-col items-start text-left w-full max-w-2xl">
          <div className="inline-flex items-center px-4 py-1.5 mb-8 text-sm font-medium text-text-muted bg-surface border border-border rounded-full shadow-sm">
            Clinical-Grade AI Therapy
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-7xl font-bold text-text-main tracking-tight mb-6 leading-tight">
            Find Peace with <br />
            <span className="text-accent">Serenity AI</span>
          </h1>
          
          <p className="text-lg md:text-xl text-text-muted mb-10 max-w-xl font-normal leading-relaxed">
            Your 24/7 empathetic companion. Experience professional emotional support, voice conversations, and mood tracking—all in a beautifully simple interface.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <a href="#download" className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-background bg-text-main rounded-full hover:bg-gray-200 transition-colors shadow-sm text-center">
              Download App
            </a>
            <a href="#features" className="w-full sm:w-auto px-8 py-3.5 text-base font-medium text-text-main bg-surface border border-border rounded-full hover:bg-surface-hover transition-colors text-center">
              Explore Features
            </a>
          </div>
        </div>

        {/* Right Column: App Image */}
        <div className="flex-1 w-full flex justify-center lg:justify-end relative">
          
          {/* Decorative glow behind the phone */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-accent/20 blur-[100px] rounded-full pointer-events-none" />
          
          {/* Phone Mockup Container */}
          <div className="relative z-10 w-full max-w-[320px] sm:max-w-[380px] lg:max-w-[400px] rounded-[3rem] overflow-hidden border-[8px] border-surface shadow-2xl bg-surface flex items-center justify-center">
            
            {/* The user's uploaded image goes here */}
            <img 
              src="/app_screenshot.png" 
              alt="Serenity AI Chat Interface" 
              className="w-full h-auto object-cover rounded-[2.5rem]"
              onError={(e) => {
                // Fallback if the user hasn't added the image yet
                (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x850/0A0A0A/FFFFFF?text=Please+add+app_screenshot.png';
              }}
            />

          </div>
        </div>
        
      </div>
    </div>
  );
}
