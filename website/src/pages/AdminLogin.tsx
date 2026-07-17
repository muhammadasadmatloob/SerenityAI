import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Shield, Lock, ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const ADMIN_EMAIL = 'donnaserenity25@gmail.com';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && user.email === ADMIN_EMAIL) {
        navigate('/admin/dashboard');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (email.toLowerCase() !== ADMIN_EMAIL) {
      setError('Access Denied. Only authorized administrators can login here.');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user.email !== ADMIN_EMAIL) {
        await signOut(auth);
        setError('Access Denied. Only authorized administrators can login here.');
      } else {
        navigate('/admin/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      setError('Invalid credentials or connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative p-6">
      <Link to="/" className="absolute top-6 left-6 flex items-center text-text-muted hover:text-accent transition-colors">
        <ChevronLeft size={20} className="mr-1" /> Back to Home
      </Link>

      <div className="w-full max-w-md bg-surface p-8 rounded-3xl border border-border shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-accent/10 blur-[50px] rounded-full pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mb-6 border border-accent/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
            <Shield className="text-accent" size={32} />
          </div>
          
          <h2 className="text-2xl font-bold text-text-main mb-2">Crisis Admin Portal</h2>
          <p className="text-text-muted text-sm mb-8 text-center">
            Secure login for authorized Serenity AI administrators only.
          </p>

          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1 ml-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                placeholder="admin@serenityai.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1 ml-1">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-text-main focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                  placeholder="••••••••"
                />
                <Lock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted" />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-500 text-sm font-medium text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-xl text-white font-semibold transition-all mt-4 ${
                loading ? 'bg-accent/70 cursor-not-allowed' : 'bg-accent hover:bg-blue-600 shadow-md shadow-accent/20 hover:shadow-accent/40 hover:-translate-y-0.5'
              }`}
            >
              {loading ? 'Authenticating...' : 'Secure Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
