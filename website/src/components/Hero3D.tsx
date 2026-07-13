import { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Environment, Float, Stars } from '@react-three/drei';
import gsap from 'gsap';

function AnimatedSphere() {
  const sphereRef = useRef<any>(null);

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <Sphere ref={sphereRef} args={[1, 64, 64]} scale={2.5}>
        <MeshDistortMaterial
          color="#4ade80"
          attach="material"
          distort={0.4}
          speed={2}
          roughness={0.2}
          metalness={0.8}
        />
      </Sphere>
    </Float>
  );
}

export default function Hero3D() {
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textRef.current) {
      gsap.fromTo(
        textRef.current.children,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, stagger: 0.2, ease: 'power3.out', delay: 0.5 }
      );
    }
  }, []);

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 z-0 opacity-60">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <AnimatedSphere />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <Environment preset="city" />
        </Canvas>
      </div>

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full text-center px-6">
        <div ref={textRef} className="max-w-4xl">
          <div className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold text-primary bg-primary/10 rounded-full border border-primary/20 backdrop-blur-md">
            Clinical-Grade AI Therapy
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6 drop-shadow-lg">
            Find Peace with <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300">
              Serenity AI
            </span>
          </h1>
          <p className="text-lg md:text-2xl text-slate-300 mb-10 max-w-2xl mx-auto font-light leading-relaxed drop-shadow-md">
            Your 24/7 empathetic companion. Voice calls, emotional tracking, and therapeutic support—whenever you need it most.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#download" className="px-8 py-4 text-lg font-bold text-slate-900 bg-primary rounded-xl hover:bg-emerald-400 hover:scale-105 transition-all duration-300 shadow-[0_0_20px_rgba(74,222,128,0.4)]">
              Download App Now
            </a>
            <a href="#features" className="px-8 py-4 text-lg font-bold text-white bg-slate-800/80 border border-slate-700 rounded-xl hover:bg-slate-700 backdrop-blur-md transition-all duration-300">
              Explore Features
            </a>
          </div>
        </div>
      </div>
      
      {/* Gradient Overlay for blending into next section */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-slate-900 to-transparent z-10" />
    </div>
  );
}
