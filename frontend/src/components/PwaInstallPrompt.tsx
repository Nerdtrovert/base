import React, { useState, useEffect } from 'react';
import { useBaseStore } from '../store/useBaseStore';

export const PwaInstallPrompt: React.FC = () => {
  const { deferredPrompt } = useBaseStore();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem('base_install_prompt_dismissed') === 'true';
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    
    if (deferredPrompt && !dismissed && !isStandalone) {
      setShowPrompt(true);
    } else {
      setShowPrompt(false);
    }
  }, [deferredPrompt]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    // Show the browser install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA Install] User response to prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, clear it
    useBaseStore.setState({ deferredPrompt: null });
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('base_install_prompt_dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="bg-card-bg/60 dark:bg-card-bg/20 border border-accent/20 dark:border-accent/10 rounded-3xl p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6 animate-fade-in mb-6 relative overflow-hidden group">
      
      {/* Background brand glow for premium feel */}
      <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full bg-accent/5 dark:bg-accent/10 blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
      
      <div className="space-y-1.5 max-w-xl z-10">
        <h3 className="text-lg font-bold tracking-tight text-text-primary flex items-center gap-2">
          <span>Welcome to Base</span>
        </h3>
        <p className="text-sm font-medium text-text-secondary">
          Base works in your browser.
        </p>
        <p className="text-xs text-text-muted leading-relaxed">
          For the best offline experience and automatic background protection, install Base on this device.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 z-10 w-full md:w-auto">
        <button
          onClick={handleInstall}
          className="flex-1 md:flex-none h-9 px-4 text-xs font-semibold bg-accent hover:bg-accent/90 text-white rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98] transition-transform"
        >
          Install Base
        </button>
        <button
          onClick={handleDismiss}
          className="flex-1 md:flex-none h-9 px-4 text-xs font-semibold border border-border-color hover:border-text-secondary text-text-secondary hover:text-text-primary rounded-xl flex items-center justify-center cursor-pointer transition-colors active:scale-[0.98]"
        >
          Continue in Browser
        </button>
      </div>
    </div>
  );
};
