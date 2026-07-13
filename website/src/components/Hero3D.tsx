import { useMemo, useRef } from 'react';
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

        {/* Right Column: Realistic Flat App Mockup */}
        <div className="flex-1 w-full flex justify-center lg:justify-end relative">
          
          {/* Glowing Aura Matching Theme */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[110%] bg-accent/20 blur-[120px] rounded-full pointer-events-none" />
          
          {/* Realistic iPhone Mockup Wrapper */}
          <div 
            className="relative z-10 w-[280px] h-[580px] sm:w-[300px] sm:h-[620px] lg:w-[320px] lg:h-[660px] bg-[#000000] rounded-[3.5rem] p-[8px] shadow-[0_30px_60px_rgba(0,0,0,0.8),_0_0_40px_rgba(59,130,246,0.2)] border-[1.5px] border-[#333333] transition-transform duration-1000 ease-in-out hover:-translate-y-2"
            style={{ animation: 'float-vertical 6s ease-in-out infinite' }}
          >
            {/* Hardware Buttons */}
            <div className="absolute top-[110px] -left-[2px] w-[3px] h-[26px] bg-[#333] rounded-l-md" /> {/* Mute Switch */}
            <div className="absolute top-[160px] -left-[2px] w-[3px] h-[55px] bg-[#333] rounded-l-md" /> {/* Vol Up */}
            <div className="absolute top-[230px] -left-[2px] w-[3px] h-[55px] bg-[#333] rounded-l-md" /> {/* Vol Down */}
            <div className="absolute top-[180px] -right-[2px] w-[3px] h-[80px] bg-[#333] rounded-r-md" /> {/* Power */}
            <div className="absolute top-[40px] right-[10px] w-[50px] h-[4px] bg-[#222] rounded-full opacity-30 rotate-45 pointer-events-none" /> {/* Antenna line */}

            {/* Inner Screen Container */}
            <div className="relative w-full h-full bg-white rounded-[3rem] overflow-hidden flex flex-col shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
              
              {/* Dynamic Island / Camera Notch */}
              <div className="absolute top-[12px] left-1/2 -translate-x-1/2 w-[90px] h-[28px] bg-black rounded-full z-20 flex items-center justify-end px-3 shadow-md">
                <div className="w-3.5 h-3.5 rounded-full bg-[#111] border-[0.5px] border-[#333] shadow-[inset_0_0_4px_rgba(255,255,255,0.15)] flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a] shadow-[inset_0_0_2px_rgba(0,0,100,0.5)]" />
                </div>
              </div>
              
              {/* THE USER'S EXACT SCREENSHOT */}
              <img 
                src="/app_screenshot.jpg" 
                alt="Serenity AI Chat Interface" 
                className="w-full h-full object-cover relative z-0"
              />
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
