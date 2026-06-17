import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBaseStore } from '../store/useBaseStore';
import { Mail, Lock, User as UserIcon, ArrowRight, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandMark } from '../components/BrandMark';

export const Login: React.FC = () => {
  const { loginWithEmail, registerWithEmail, login, isAuthLoading } = useBaseStore();
  const navigate = useNavigate();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!email || !password) {
      setValidationError('Please fill in all fields.');
      return;
    }
    if (isSignUp && !name) {
      setValidationError('Please enter your name.');
      return;
    }
    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters.');
      return;
    }

    let success = false;
    if (isSignUp) {
      success = await registerWithEmail(email, password, name);
    } else {
      success = await loginWithEmail(email, password);
    }

    if (success) {
      navigate('/');
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center text-center space-y-4 px-4">
        <div className="hero-brand-glow inline-block mb-2">
          <BrandMark className="h-12 w-12 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold tracking-tight text-text-primary animate-pulse">
          {isSignUp ? 'Setting up your Base...' : 'Loading your Base...'}
        </h2>
        <p className="text-xs text-text-secondary">
          {isSignUp ? 'Personalizing your workspaces...' : 'Securing your database access...'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-1/4 left-10 w-72 h-72 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-10 w-80 h-80 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md surface-paper rounded-[2.5rem] border border-border-color p-8 md:p-10 shadow-card-shadow bg-card-bg/95 backdrop-blur-md relative z-10"
      >
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="hero-brand-glow">
              <BrandMark className="h-14 w-14" />
            </div>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-text-primary leading-tight max-w-[320px] mx-auto">
            It looks like you're not logged in
          </h2>
          <p className="text-xs md:text-sm text-text-secondary mt-3 max-w-[340px] mx-auto leading-relaxed">
            Let's personalize your workspace and set up your own Base. Log in or sign up to get started.
          </p>
        </div>

        {/* Validation Errors */}
        <AnimatePresence mode="wait">
          {validationError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl px-4 py-3 text-xs font-medium mb-6 text-center"
            >
              {validationError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="popLayout">
            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">
                  <UserIcon className="w-4 h-4" />
                </div>
                <Input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-11 h-12 bg-bg-app border-border-color rounded-xl focus:border-accent"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">
              <Mail className="w-4 h-4" />
            </div>
            <Input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-11 h-12 bg-bg-app border-border-color rounded-xl focus:border-accent"
              required
            />
          </div>

          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary">
              <Lock className="w-4 h-4" />
            </div>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-11 h-12 bg-bg-app border-border-color rounded-xl focus:border-accent"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={isAuthLoading}
            className="w-full h-12 rounded-xl bg-accent hover:bg-accent/90 text-white font-semibold flex items-center justify-center gap-2 shadow-md shadow-accent/15 cursor-pointer mt-6"
          >
            {isAuthLoading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{isSignUp ? 'Sign Up' : 'Log In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        {/* Toggle between Log In and Sign Up */}
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setValidationError('');
            }}
            className="text-xs font-semibold text-accent hover:underline cursor-pointer"
          >
            {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center my-6">
          <div className="flex-grow h-px bg-border-color" />
          <span className="px-3 text-[11px] font-semibold text-text-secondary uppercase tracking-widest">
            or
          </span>
          <div className="flex-grow h-px bg-border-color" />
        </div>

        {/* Google OAuth Option */}
        <button
          onClick={login}
          type="button"
          className="w-full h-12 rounded-xl border border-border-color bg-bg-app/50 hover:bg-bg-app flex items-center justify-center gap-3 transition-colors cursor-pointer text-sm font-semibold text-text-primary"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Connect Google Drive</span>
        </button>

        {/* Security / Privacy notice */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-text-secondary">
          <ShieldCheck className="w-3.5 h-3.5 text-accent" />
          <span>Local database is AES-encrypted & synced securely</span>
        </div>
      </motion.div>
    </div>
  );
};
