import { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Environment, Float, Stars } from '@react-three/drei';
import gsap from 'gsap';

function AnimatedSphere() {
  const sphereRef = useRef<any>(null);

  return (
    <Float speed={1.5} rotationIntensity={2} floatIntensity={3}>
      <Sphere ref={sphereRef} args={[1, 128, 128]} scale={2.8}>
        <MeshDistortMaterial
          color="#0d9488"
          attach="material"
          distort={0.45}
          speed={1.5}
          roughness={0.1}
          metalness={0.9}
          emissive="#042f2e"
          emissiveIntensity={0.2}
          clearcoat={1}
          clearcoatRoughness={0.1}
        />
      </Sphere>
    </Float>
  );
}

export default function Hero3D() {
  const contentRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      gsap.fromTo(
        contentRef.current.children,
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 1.2, stagger: 0.15, ease: 'power3.out', delay: 0.2 }
      );
    }
    if (imageRef.current) {
      gsap.fromTo(
        imageRef.current,
        { opacity: 0, scale: 0.8, rotationY: 15 },
        { opacity: 1, scale: 1, rotationY: 0, duration: 1.5, ease: 'power3.out', delay: 0.6 }
      );
    }
  }, []);

  return (
    <div className="relative w-full min-h-screen bg-secondary overflow-hidden flex items-center">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 z-0 opacity-40">
        <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
          <ambientLight intensity={0.2} />
          <directionalLight position={[10, 10, 5]} intensity={2} color="#5eead4" />
          <directionalLight position={[-10, -10, -5]} intensity={1} color="#0f766e" />
          <AnimatedSphere />
          <Stars radius={100} depth={50} count={6000} factor={4} saturation={0.5} fade speed={1.5} />
          <Environment preset="night" />
        </Canvas>
      </div>

      {/* Hero Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-20 flex flex-col lg:flex-row items-center justify-between gap-12">
        
        {/* Left Column (Text) */}
        <div ref={contentRef} className="max-w-2xl text-left pt-12 lg:pt-0">
          <div className="inline-flex items-center px-4 py-2 mb-8 text-sm font-bold text-primary-light bg-primary-dark/20 rounded-full border border-primary-light/30 shadow-[0_0_15px_rgba(20,184,166,0.3)] backdrop-blur-xl">
            <span className="w-2 h-2 rounded-full bg-primary-light mr-3 animate-pulse"></span>
            Next-Generation AI Therapy
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-8 leading-[1.05] drop-shadow-2xl">
            Find Peace with <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary-light via-primary to-primary-dark">
              Serenity AI
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-300 mb-12 font-light leading-relaxed drop-shadow-md">
            Your 24/7 empathetic companion. Experience clinical-grade emotional support, voice conversations, and mood tracking—all in your pocket.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-5">
            <a href="#download" className="group relative px-8 py-4 text-lg font-bold text-secondary bg-primary-light rounded-2xl overflow-hidden transition-all hover:scale-105 shadow-[0_0_30px_rgba(94,234,212,0.4)]">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
              <span className="relative z-10">Download App</span>
            </a>
            <a href="#features" className="px-8 py-4 text-lg font-bold text-white bg-slate-800/40 border border-slate-700/50 rounded-2xl hover:bg-slate-800/80 backdrop-blur-xl transition-all duration-300">
              Explore Features
            </a>
          </div>
        </div>
        
        {/* Right Column (Mockup Image) */}
        <div className="lg:w-1/2 flex justify-center lg:justify-end relative perspective-1000 mt-12 lg:mt-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/20 blur-[120px] rounded-full pointer-events-none z-0 animate-glow" />
          
          <div ref={imageRef} className="relative z-10 transform-gpu shadow-2xl">
            <img 
              src="/app_mockup.png" 
              alt="Serenity AI App Interface" 
              className="w-[320px] md:w-[380px] h-auto object-cover rounded-[3rem] border-[8px] border-slate-800 shadow-[0_30px_60px_-15px_rgba(20,184,166,0.3)]"
            />
            
            {/* Floating Glassmorphism Badge */}
            <div className="absolute -bottom-6 -left-10 bg-slate-900/80 border border-slate-700/50 p-4 rounded-2xl backdrop-blur-xl shadow-xl flex items-center gap-4 animate-bounce" style={{animationDuration: '3s'}}>
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary-dark to-primary-light flex items-center justify-center">
                <svg className="w-6 h-6 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-bold">CBT Trained</p>
                <p className="text-slate-400 text-sm">Empathetic Responses</p>
              </div>
            </div>
          </div>
        </div>

      </div>
      
      {/* Gradient Overlay for blending into next section */}
      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-secondary to-transparent z-10 pointer-events-none" />
    </div>
  );
}
