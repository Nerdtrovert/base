import React, { useEffect } from 'react';
import { useBaseStore } from '../store/useBaseStore';
import { Sparkles, X, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const CompanionBanner: React.FC = () => {
  const { companionMessage, clearCompanionMessage } = useBaseStore();

  // Auto-dismiss the companion toast after 6 seconds so it doesn't linger forever
  useEffect(() => {
    if (companionMessage) {
      const timer = setTimeout(() => {
        clearCompanionMessage();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [companionMessage, clearCompanionMessage]);

  const typeConfig = {
    info: {
      bg: 'bg-card-bg/95 border-accent/25 text-text-primary',
      icon: <Info className="w-4 h-4 text-accent" />,
      accentBar: 'bg-accent'
    },
    success: {
      bg: 'bg-card-bg/95 border-emerald-500/25 text-text-primary',
      icon: <CheckCircle className="w-4 h-4 text-emerald-500" />,
      accentBar: 'bg-emerald-500'
    },
    warning: {
      bg: 'bg-card-bg/95 border-amber-500/25 text-text-primary',
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      accentBar: 'bg-amber-500'
    }
  };

  const currentType = companionMessage 
    ? (typeConfig[companionMessage.type] || typeConfig.info) 
    : typeConfig.info;

  return (
    <AnimatePresence>
      {companionMessage && (
        <motion.div
          key="companion-toast"
          initial={{ opacity: 0, y: 40, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 15, scale: 0.95, transition: { duration: 0.15 } }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
          className={`fixed bottom-20 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 sm:w-80 max-w-md ${currentType.bg} border rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.12)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.35)] z-[9999] flex items-start gap-3 overflow-hidden backdrop-blur-md`}
        >
          {/* Left vertical brand accent bar */}
          <div className={`absolute top-0 bottom-0 left-0 w-1 ${currentType.accentBar}`} />
          
          <div className="flex-shrink-0 mt-0.5 ml-1">
            {currentType.icon}
          </div>

          <div className="flex-grow min-w-0 pr-1 pl-0.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[11px] font-bold tracking-wider text-text-primary uppercase">COMPANION</span>
              <Sparkles className="w-3 h-3 text-accent animate-pulse" />
            </div>
            <p className="text-[11px] text-text-secondary leading-relaxed font-medium">
              {companionMessage.text}
            </p>
          </div>

          <button 
            onClick={clearCompanionMessage}
            className="flex-shrink-0 p-1 hover:bg-bg-app rounded-lg transition-colors text-text-muted hover:text-text-primary"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
