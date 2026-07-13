/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { LogIn, UserPlus, Lock, Mail, User, ShieldAlert, Cpu } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (userId: string) => void;
  onGuestLogin: () => void;
}

export default function LoginScreen({ onLoginSuccess, onGuestLogin }: LoginScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let loginEmail = email.trim();
    if (loginEmail.toLowerCase() === 'quaver') {
      loginEmail = 'quaver@aetheros.com';
    }

    try {
      if (isSignUp) {
        if (!username.trim()) {
          throw new Error('Please enter a display name.');
        }
        // Register user
        const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, password);
        const user = userCredential.user;

        const isAdminUser = loginEmail.toLowerCase() === 'quaver@aetheros.com' && password === 'BenisBest@1';

        // Initialize user profile document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          userName: isAdminUser ? 'Quaver' : username,
          isAdmin: isAdminUser ? true : false,
          desktopWallpaper: isAdminUser ? 'neon' : 'aurora',
          glassBlur: 20,
          customApiKey: '',
          createdAt: Date.now(),
          lastAccessed: Date.now()
        });

        onLoginSuccess(user.uid);
      } else {
        // Log in user
        try {
          const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
          
          // Double check: if this is Quaver logging in with the correct password, ensure they are marked as Admin
          const isAdminUser = loginEmail.toLowerCase() === 'quaver@aetheros.com' && password === 'BenisBest@1';
          if (isAdminUser) {
            await setDoc(doc(db, 'users', userCredential.user.uid), {
              userName: 'Quaver',
              isAdmin: true,
              desktopWallpaper: 'neon',
              glassBlur: 20,
              customApiKey: '',
              createdAt: Date.now(),
              lastAccessed: Date.now()
            }, { merge: true });
          }

          onLoginSuccess(userCredential.user.uid);
        } catch (loginErr: any) {
          // Special fallback: if Quaver logging in but the account is not yet created in Auth, auto-create it!
          const isAdminUser = loginEmail.toLowerCase() === 'quaver@aetheros.com' && password === 'BenisBest@1';
          if (isAdminUser && (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential')) {
            const userCredential = await createUserWithEmailAndPassword(auth, 'quaver@aetheros.com', 'BenisBest@1');
            const user = userCredential.user;

            await setDoc(doc(db, 'users', user.uid), {
              userName: 'Quaver',
              isAdmin: true,
              desktopWallpaper: 'neon',
              glassBlur: 20,
              customApiKey: '',
              createdAt: Date.now(),
              lastAccessed: Date.now()
            });

            onLoginSuccess(user.uid);
          } else {
            throw loginErr;
          }
        }
      }
    } catch (err: any) {
      let message = err.message || 'An error occurred during authentication.';
      if (err.code === 'auth/user-not-found') message = 'No account found with this email.';
      if (err.code === 'auth/wrong-password') message = 'Incorrect password.';
      if (err.code === 'auth/email-already-in-use') message = 'An account already exists with this email.';
      if (err.code === 'auth/weak-password') message = 'Password must be at least 6 characters.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = () => {
    setEmail('demo@aetheros.com');
    setPassword('demo1234');
    setIsSignUp(false);
  };

  return (
    <div id="login-container" className="fixed inset-0 w-full h-full flex items-center justify-center bg-[#08090a] p-4 select-none font-sans overflow-hidden">
      {/* Background Atmospheric Glows */}
      <div className="absolute top-[-100px] left-[-100px] w-[500px] h-[500px] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-50px] right-[-50px] w-[400px] h-[400px] bg-cyan-900/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Subtle Grid Overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative w-full max-w-md p-8 rounded-[2rem] border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-2xl shadow-black/80 z-10"
      >
        {/* Futuristic Brand Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-4 rounded-2xl bg-gradient-to-tr from-cyan-500/30 to-purple-500/30 border border-white/20 shadow-inner mb-3">
            <Cpu className="w-10 h-10 text-cyan-300 animate-spin-slow" />
          </div>
          <h1 className="text-3xl font-bold font-display tracking-wider bg-gradient-to-r from-white via-cyan-100 to-purple-200 bg-clip-text text-transparent">
            AETHER OS
          </h1>
          <p className="text-sm text-cyan-200/60 font-light mt-1">
            Seamless Fluid Cloud Workspace
          </p>
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs flex items-start gap-2.5"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div className="relative">
              <label className="block text-xs text-cyan-200/80 mb-1 ml-1 font-medium">Display Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/40" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="John Doe"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-white placeholder-white/30 focus:border-cyan-400/50 focus:bg-white/10 outline-none text-sm transition-all"
                />
              </div>
            </div>
          )}

          <div className="relative">
            <label className="block text-xs text-cyan-200/80 mb-1 ml-1 font-medium">Email Address or Username</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/40" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com or quaver"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-white placeholder-white/30 focus:border-cyan-400/50 focus:bg-white/10 outline-none text-sm transition-all"
              />
            </div>
          </div>

          <div className="relative">
            <label className="block text-xs text-cyan-200/80 mb-1 ml-1 font-medium">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-200/40" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-white placeholder-white/30 focus:border-cyan-400/50 focus:bg-white/10 outline-none text-sm transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="relative w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-cyan-500/80 to-purple-600/80 hover:from-cyan-400 hover:to-purple-500 border border-white/10 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_5px_15px_rgba(0,180,216,0.3)] disabled:opacity-50"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isSignUp ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Cloud Account</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Initialize Workspace</span>
              </>
            )}
          </button>
        </form>

        {/* Dynamic toggle and demo triggers */}
        <div className="mt-6 pt-5 border-t border-white/10 text-center flex flex-col gap-3">
          <p className="text-xs text-cyan-200/50">
            {isSignUp ? 'Already have a secure workspace?' : 'New to Aether OS?'}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError('');
              }}
              className="text-cyan-300 font-medium ml-1.5 hover:underline bg-transparent border-none cursor-pointer"
            >
              {isSignUp ? 'Log In' : 'Sign Up'}
            </button>
          </p>

          {!isSignUp && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-cyan-200/30">Or select your access method</p>
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={fillDemoAccount}
                  className="text-xs py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-200/80 transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Fill Demo</span>
                </button>
                <button
                  type="button"
                  onClick={onGuestLogin}
                  className="text-xs py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-300 font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.1)] hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                >
                  <span>Continue as Guest</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Futuristic footer credentials */}
      <div className="absolute bottom-4 text-[10px] text-white/30 font-mono tracking-wider">
        AETHER DESKTOP ARCHITECTURE v2.1.0 • ENCRYPTED FIRESTORE BACKEND
      </div>
    </div>
  );
}
