import { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

function NeuralNetwork() {
  const ref = useRef<any>(null);
  
  const { positions, linePositions } = useMemo(() => {
    const pts = [];
    const radius = 3.5;
    const numPoints = 120; 

    for (let i = 0; i < numPoints; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = radius * Math.cbrt(Math.random());
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      pts.push(new THREE.Vector3(x, y, z));
    }

    const lines = [];
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (pts[i].distanceTo(pts[j]) < 1.5) {
          lines.push(pts[i], pts[j]);
        }
      }
    }

    const flatPositions = new Float32Array(pts.length * 3);
    for (let i = 0; i < pts.length; i++) {
      flatPositions[i * 3] = pts[i].x;
      flatPositions[i * 3 + 1] = pts[i].y;
      flatPositions[i * 3 + 2] = pts[i].z;
    }

    return { 
      positions: flatPositions, 
      linePositions: lines.length > 0 ? new Float32Array(lines.flatMap(v => [v.x, v.y, v.z])) : new Float32Array() 
    };
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.04;
      ref.current.rotation.x = state.clock.elapsedTime * 0.015;
    }
  });

  return (
    <group ref={ref} position={[2, 0, -2]}>
      <Points positions={positions} stride={3} frustumCulled={false}>
        <PointMaterial transparent color="#3B82F6" size={0.06} sizeAttenuation={true} depthWrite={false} />
      </Points>
      {linePositions.length > 0 && (
         <lineSegments>
           <bufferGeometry>
             <bufferAttribute 
               attach="attributes-position" 
               args={[linePositions, 3]}
             />
           </bufferGeometry>
           <lineBasicMaterial color="#1e3a8a" transparent opacity={0.3} />
         </lineSegments>
      )}
    </group>
  );
}

export default function Hero3D() {
  const [time, setTime] = useState('10:00');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full min-h-screen bg-background overflow-hidden flex items-center border-b border-border">
      
      {/* 3D Neural Network Background */}
      <div className="absolute inset-0 z-0 opacity-60">
        <Canvas camera={{ position: [0, 0, 6] }}>
          <NeuralNetwork />
        </Canvas>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-24 flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-8">
        
        {/* Left Column: Text Content */}
        <div className="flex-1 flex flex-col items-start text-left w-full max-w-2xl">
          <div className="inline-flex items-center px-4 py-1.5 mb-8 text-sm font-medium text-text-muted bg-surface border border-border rounded-full shadow-sm backdrop-blur-md">
            Clinical-Grade AI Therapy
          </div>
          
          <h1 className="text-5xl md:text-7xl lg:text-7xl font-bold text-text-main tracking-tight mb-6 leading-tight">
            Find Peace with <br />
            <span className="text-accent drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">Serenity AI</span>
          </h1>
          
          <p className="text-lg md:text-xl text-text-muted mb-10 max-w-xl font-normal leading-relaxed">
            Your 24/7 empathetic companion. Experience professional emotional support, voice conversations, and mood tracking—all in a beautifully simple interface.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <a href="#download" className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-background bg-text-main rounded-full hover:bg-gray-200 transition-colors shadow-sm text-center">
              Download App
            </a>
            <a href="#features" className="w-full sm:w-auto px-8 py-3.5 text-base font-medium text-text-main bg-surface/50 backdrop-blur-sm border border-border rounded-full hover:bg-surface-hover transition-colors text-center">
              Explore Features
            </a>
          </div>
        </div>

        {/* Right Column: Realistic Flat Android Mockup */}
        <div className="flex-1 w-full flex justify-center lg:justify-end relative">
          
          {/* Glowing Aura Matching Theme */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[110%] bg-accent/20 blur-[120px] rounded-full pointer-events-none" />
          
          {/* Realistic Android Phone Mockup Wrapper */}
          <div 
            className="relative z-10 w-[280px] h-[580px] sm:w-[300px] sm:h-[620px] lg:w-[320px] lg:h-[660px] bg-[#000000] rounded-[2.5rem] p-[5px] shadow-[0_30px_60px_rgba(0,0,0,0.8),_0_0_40px_rgba(59,130,246,0.2)] border-[1.5px] border-[#333333] transition-transform duration-1000 ease-in-out hover:-translate-y-2"
            style={{ animation: 'float-vertical 6s ease-in-out infinite' }}
          >
            {/* Android Hardware Buttons (Usually all on the right) */}
            <div className="absolute top-[130px] -right-[2px] w-[3px] h-[60px] bg-[#333] rounded-r-md" /> {/* Volume Rocker */}
            <div className="absolute top-[220px] -right-[2px] w-[3px] h-[40px] bg-[#333] rounded-r-md" /> {/* Power Button */}
            <div className="absolute top-[40px] right-[10px] w-[50px] h-[4px] bg-[#222] rounded-full opacity-30 rotate-45 pointer-events-none" /> {/* Antenna line */}

            {/* Inner Screen Container */}
            <div className="relative w-full h-full bg-white rounded-[2.2rem] overflow-hidden flex flex-col shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
              
              {/* Android Status Bar OVERLAY */}
              <div className="absolute top-0 left-0 right-0 h-7 z-20 flex justify-between items-center px-4 pointer-events-none bg-gradient-to-b from-white via-white/80 to-transparent">
                {/* Time */}
                <div className="text-[11px] font-medium text-black">
                  {time}
                </div>
                {/* Icons: Wifi, Signal, Battery */}
                <div className="flex gap-1.5 items-center">
                  <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3C7.58 3 3.54 4.54.49 7.1L12 21.5l11.51-14.4C20.46 4.54 16.42 3 12 3zm0 2.5c3.55 0 6.82 1.15 9.49 3.1L12 19.5 2.51 8.6C5.18 6.65 8.45 5.5 12 5.5z"/></svg>
                  <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M2 22h20V2z"/></svg>
                  <svg className="w-3.5 h-3.5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
                </div>
              </div>

              {/* Android Hole-Punch Camera */}
              <div className="absolute top-[8px] left-1/2 -translate-x-1/2 w-[14px] h-[14px] bg-black rounded-full z-30 flex items-center justify-center shadow-[0_0_2px_rgba(255,255,255,0.5)]">
                <div className="w-[5px] h-[5px] rounded-full bg-[#0a0a0a] shadow-[inset_0_0_2px_rgba(0,0,200,0.5)]" />
              </div>

              {/* THE USER'S EXACT SCREENSHOT */}
              {/* Added pt-4 to push screenshot down slightly below the status bar so it doesn't overlap weirdly if it has its own */}
              <img 
                src="/app_screenshot.jpg" 
                alt="Serenity AI Chat Interface" 
                className="w-full h-full object-cover relative z-0"
              />

              {/* Android Bottom Gesture Navigation Line */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-[3px] bg-gray-300 rounded-full z-20 pointer-events-none mix-blend-difference" />
            </div>
          </div>

        </div>
        
      </div>
      
      {/* Floating animation keyframes embedded */}
      <style>{`
        @keyframes float-vertical {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
    </div>
  );
}
