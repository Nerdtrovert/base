import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useBaseStore } from '../store/useBaseStore';
import { BrandMark } from '../components/BrandMark';
import { Button } from '../components/ui/button';
import { CheckCircle2, Loader2, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';

export const About: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const isOnboarding = queryParams.get('onboarding') === 'true';

  const { syncStatus, isAuthenticated, triggerSync } = useBaseStore();
  const pendingSyncCount = useLiveQuery(() => db.syncQueue.count()) ?? 0;

  useEffect(() => {
    if (isOnboarding && isAuthenticated) {
      triggerSync(true);
    }
  }, [isOnboarding, isAuthenticated, triggerSync]);

  const isSyncing = isAuthenticated && (syncStatus === 'syncing' || pendingSyncCount > 0);
  const isError = isAuthenticated && syncStatus === 'error';
  const isSuccess = !isAuthenticated || syncStatus === 'success' || (syncStatus === 'idle' && pendingSyncCount === 0);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 15
      }
    }
  };

  const principles = [
    'Capture first, organize later.',
    'Search instead of navigation.',
    'Focus modes instead of folders.',
    'Context over storage.',
    'Local-first, cloud-enabled.',
    'Calm over productivity pressure.'
  ];

  const techStack = [
    'React',
    'TypeScript',
    'Tailwind CSS',
    'shadcn/ui',
    'Zustand',
    'IndexedDB',
    'Dexie',
    'PostgreSQL',
    'Google Drive API'
  ];

  return (
    <div className="bg-blueprint-grid min-h-[85vh] text-text-primary py-16 px-6 md:py-24 relative overflow-hidden">
      {/* Subtle blueprint accent lights */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/3 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-[760px] mx-auto space-y-16 md:space-y-24 relative z-10 font-sans"
      >
        {/* 1. Hero Section */}
        <motion.section variants={itemVariants} className="text-center space-y-6">
          <div className="flex justify-center mb-4">
            <div className="hero-brand-glow">
              <BrandMark className="h-16 w-16" />
            </div>
          </div>
          <h1 className="font-mono font-bold text-4xl tracking-[0.25em] text-text-primary">
            BASE
          </h1>
          <p className="text-xl md:text-2xl font-bold tracking-tight text-text-primary/90 max-w-md mx-auto leading-tight">
            A workspace that remembers, <br />
            so you can focus.
          </p>
          <div className="w-12 h-px bg-border-color mx-auto my-4" />
          <p className="text-xs md:text-sm text-text-secondary italic max-w-lg mx-auto font-medium">
            "Built to remember the little things, so students can focus on the big ones."
          </p>
        </motion.section>

        {/* Onboarding Status Card */}
        {isOnboarding && (
          <motion.div
            variants={itemVariants}
            className={`p-6 md:p-8 rounded-[2rem] border bg-card-bg/35 backdrop-blur-xs shadow-card-shadow relative overflow-hidden transition-all duration-500 ${
              isSuccess
                ? 'border-emerald-500/30 shadow-emerald-500/5'
                : isError
                ? 'border-amber-500/30 shadow-amber-500/5'
                : 'border-accent/30 shadow-accent/5'
            }`}
          >
            {/* Background glowing decorations */}
            <div className={`absolute -right-8 -top-8 w-24 h-24 rounded-full blur-xl pointer-events-none transition-colors duration-500 ${
              isSuccess ? 'bg-emerald-500/10' : isError ? 'bg-amber-500/10' : 'bg-accent/10'
            }`} />
            <div className={`absolute -left-8 -bottom-8 w-24 h-24 rounded-full blur-xl pointer-events-none transition-colors duration-500 ${
              isSuccess ? 'bg-emerald-500/5' : isError ? 'bg-amber-500/5' : 'bg-accent/5'
            }`} />

            {isSyncing && (
              <div className="space-y-4 text-center py-4 relative z-10">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-accent/20 blur-md animate-ping" />
                    <Loader2 className="w-10 h-10 text-accent animate-spin relative z-10" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-text-primary">
                    Assembling secure memory layers...
                  </h3>
                  <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
                    Connecting to Google Drive and configuring your automatic background protection. This will only take a moment.
                  </p>
                </div>
                {pendingSyncCount > 0 && (
                  <p className="text-[10px] font-mono text-accent font-semibold animate-pulse">
                    Syncing {pendingSyncCount} pending change{pendingSyncCount === 1 ? '' : 's'}...
                  </p>
                )}
              </div>
            )}

            {isError && (
              <div className="space-y-4 text-center py-4 relative z-10">
                <div className="flex justify-center">
                  <div className="h-10 w-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-text-primary">
                    Sync is taking longer than expected
                  </h3>
                  <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
                    Your changes are saved locally on this device, but we couldn't complete the cloud backup right now. Don't worry, your data is safe.
                  </p>
                </div>
                <div className="pt-2 flex justify-center">
                  <Button
                    onClick={() => navigate('/')}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-6 py-2 rounded-xl flex items-center gap-2 cursor-pointer shadow-xs text-xs border-none"
                  >
                    <span>Proceed to Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {isSuccess && (
              <div className="space-y-5 text-center py-2 relative z-10 animate-fade-in">
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-md animate-pulse" />
                    <CheckCircle2 className="w-12 h-12 text-emerald-500 relative z-10" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-text-primary flex items-center justify-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-accent animate-pulse" />
                    <span>Onboarding Complete!</span>
                  </h3>
                  <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
                    Your local storage is configured and quiet background protection is active. Welcome to your calm workspace.
                  </p>
                </div>
                <div className="pt-2 flex justify-center">
                  <Button
                    onClick={() => navigate('/')}
                    className="bg-accent hover:bg-accent/90 text-white font-bold px-8 py-3 rounded-xl flex items-center gap-2 cursor-pointer shadow-md hover:scale-102 transition-all duration-200 border-none group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span>Your Base is Ready</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* 2. Why Base? */}
        <motion.section variants={itemVariants} className="space-y-4">
          <h2 className="text-xs font-bold text-accent uppercase tracking-[0.2em]">
            Why Base?
          </h2>
          <p className="text-sm md:text-base text-text-secondary leading-relaxed text-justify font-normal">
            As a student, I realized I was spending more time searching through folders, browser tabs, notes, downloads, and links than actually learning or building. Base was created to reduce that invisible work by quietly remembering ideas, tasks, resources, and context, allowing students to spend less time organizing and more time creating.
          </p>
        </motion.section>

        {/* 3. Core Principles */}
        <motion.section variants={itemVariants} className="space-y-5">
          <h2 className="text-xs font-bold text-accent uppercase tracking-[0.2em]">
            Core Principles
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {principles.map((principle, index) => (
              <div
                key={index}
                className="p-4.5 rounded-2xl border border-border-color bg-card-bg/25 backdrop-blur-xs flex items-center gap-3 transition-all hover:bg-card-bg/50 hover:border-accent/30 group"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-125 transition-transform" />
                <span className="text-xs font-medium text-text-primary group-hover:text-accent transition-colors">
                  {principle}
                </span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* 4. Philosophy Card */}
        <motion.section variants={itemVariants}>
          <div className="p-8 rounded-[2rem] border border-border-color bg-card-bg/35 backdrop-blur-xs text-center space-y-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-accent" />
            <p className="text-sm md:text-base font-semibold italic text-text-primary">
              "Your files stay where they are. Base simply remembers them."
            </p>
          </div>
        </motion.section>

        {/* 5. Built With */}
        <motion.section variants={itemVariants} className="space-y-4">
          <h2 className="text-xs font-bold text-accent uppercase tracking-[0.2em]">
            Built With
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {techStack.map((tech, index) => (
              <span
                key={index}
                className="px-3.5 py-1.5 rounded-full border border-border-color bg-bg-app/50 text-[10px] md:text-xs font-semibold font-mono text-text-secondary hover:border-accent/40 transition-colors"
              >
                {tech}
              </span>
            ))}
          </div>
        </motion.section>

        {/* 6. Credits */}
        <motion.section variants={itemVariants} className="text-center space-y-4 pt-4 border-t border-dashed border-border-color/60">
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">
            Designed & Developed by
          </p>
          <a
            href="https://nerdtrovert.github.io/portfolio-page/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-base font-bold text-text-primary hover:text-accent hover:underline transition-colors block cursor-pointer"
          >
            Prajwal Navada G P
          </a>
          <p className="text-xs text-text-secondary italic max-w-md mx-auto">
            "Built with curiosity, late-night ideas, and a lot of student frustration."
          </p>
        </motion.section>

        {/* 7. Footer */}
        <motion.section variants={itemVariants} className="text-center space-y-3 pt-12 border-t border-border-color">
          <div className="flex justify-center">
            <span className="font-mono font-bold tracking-[0.3em] text-xs text-text-muted">
              BASE
            </span>
          </div>
          <p className="text-[11px] font-mono text-text-muted">
            Version 1.1.7
          </p>
          <p className="text-[11px] text-text-secondary/80 leading-relaxed max-w-xs mx-auto font-normal">
            Built to remember the little things, <br />
            so students can focus on the big ones.
          </p>
        </motion.section>
      </motion.div>
    </div>
  );
};
