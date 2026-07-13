import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Icosahedron, Wireframe } from '@react-three/drei';

function MinimalShape() {
  const meshRef = useRef<any>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2;
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <Icosahedron ref={meshRef} args={[1.5, 1]} position={[0, 0, 0]}>
      <meshBasicMaterial color="#262626" wireframe={false} transparent opacity={0.2} />
      <Wireframe stroke={"#3B82F6"} thickness={0.02} fill={"#000000"} fillOpacity={1} />
    </Icosahedron>
  );
}

export default function Hero3D() {
  return (
    <div className="relative w-full min-h-screen bg-background overflow-hidden flex items-center border-b border-border">
      
      {/* Super lightweight 3D Canvas Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <MinimalShape />
        </Canvas>
      </div>

      {/* Clean, Centered Content */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center">
        
        <div className="inline-flex items-center px-4 py-1.5 mb-8 text-sm font-medium text-text-muted bg-surface border border-border rounded-full shadow-sm">
          Clinical-Grade AI Therapy
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold text-text-main tracking-tight mb-6 leading-tight">
          Find Peace with <br className="hidden md:block" />
          <span className="text-accent">Serenity AI</span>
        </h1>
        
        <p className="text-lg md:text-xl text-text-muted mb-12 max-w-2xl mx-auto font-normal leading-relaxed">
          Your 24/7 empathetic companion. Experience professional emotional support, voice conversations, and mood tracking—all in a beautifully simple interface.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <a href="#download" className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-background bg-text-main rounded-full hover:bg-gray-200 transition-colors shadow-sm text-center">
            Download App
          </a>
          <a href="#features" className="w-full sm:w-auto px-8 py-3.5 text-base font-medium text-text-main bg-surface border border-border rounded-full hover:bg-surface-hover transition-colors text-center">
            Explore Features
          </a>
        </div>
        
      </div>
    </div>
  );
}
