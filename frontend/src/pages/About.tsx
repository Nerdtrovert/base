import React from 'react';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { BrandMark } from '../components/BrandMark';

export const About: React.FC = () => {
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
    'Workspaces instead of folders.',
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
            Version 1.0
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
