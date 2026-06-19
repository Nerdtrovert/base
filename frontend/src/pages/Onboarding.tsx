import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBaseStore, BACKEND_URL } from '../store/useBaseStore';
import { db } from '../services/db';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandMark } from '../components/BrandMark';
import { ArrowRight, ArrowLeft, HardDrive, Check, ShieldCheck, FolderPlus, Info } from 'lucide-react';
import { Button } from '../components/ui/button';

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showCompanionMessage } = useBaseStore();
  const [currentStep, setCurrentStep] = useState(0);

  // GDrive state
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [isMounting, setIsMounting] = useState(false);
  const [mountedSuccess, setMountedSuccess] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('student@university.edu');

  const defaultFolders = [
    { id: 'folder-1', name: 'Semester 5' },
    { id: 'folder-2', name: 'Portfolio' },
    { id: 'folder-3', name: 'Research' },
    { id: 'folder-4', name: 'Personal Notes' },
  ];

  const [folders, setFolders] = useState<{ id: string; name: string }[]>(defaultFolders);

  const fetchFolders = async (email?: string) => {
    try {
      const url = email 
        ? `${BACKEND_URL}/api/sync/drive/folders?email=${encodeURIComponent(email)}`
        : `${BACKEND_URL}/api/sync/drive/folders`;
      const response = await fetch(url, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.folders && data.folders.length > 0) {
          const filtered = data.folders
            .filter((f: any) => f.id !== 'f_root')
            .map((f: any) => ({ id: f.id, name: f.name }));
          if (filtered.length > 0) {
            setFolders(filtered);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load dynamic Google Drive folders, using defaults:', e);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('status');
    const email = params.get('email');
    const errorMsg = params.get('error');

    if (status === 'success') {
      setIsDriveConnected(true);
      setCurrentStep(2);
      if (email) {
        setGoogleEmail(email);
      }
      showCompanionMessage('Google Drive connected. Please select mounting folders.', 'success');
      fetchFolders(email || undefined);
    } else if (status === 'error') {
      setCurrentStep(2);
      setIsDriveConnected(false);
      showCompanionMessage(errorMsg || 'Failed to connect Google Drive.', 'warning');
    }
  }, [location]);

  const handleConnectDrive = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/google/url`);
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        throw new Error('No auth URL returned from server');
      }
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
      showCompanionMessage('Failed to initialize Google Drive connection.', 'warning');
    }
  };

  const handleToggleFolder = (folderName: string) => {
    setSelectedFolders((prev) =>
      prev.includes(folderName) ? prev.filter((f) => f !== folderName) : [...prev, folderName]
    );
  };

  const handleMountFolders = async () => {
    if (selectedFolders.length === 0) return;
    setIsMounting(true);

    try {
      // Mount folders in IndexedDB knowledgeSources
      for (const name of selectedFolders) {
        const matched = folders.find(f => f.name === name);
        await db.knowledgeSources.add({
          id: crypto.randomUUID(),
          name,
          folderId: matched?.id || `gdrive-id-${name.toLowerCase().replace(/\s+/g, '-')}`,
          googleEmail: googleEmail,
          createdAt: Date.now(),
        });
      }

      setIsMounting(false);
      setMountedSuccess(true);
      showCompanionMessage('Knowledge Sources mounted successfully!', 'success');
      
      // Delay redirection slightly for user to see check animation
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1500);
    } catch (err) {
      console.error(err);
      setIsMounting(false);
      showCompanionMessage('Failed to mount Knowledge Sources.', 'warning');
    }
  };

  const nextStep = () => {
    if (currentStep < 2) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };



  return (
    <div className="bg-blueprint-grid min-h-[85vh] text-text-primary flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Blueprint accent light glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/3 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl flex flex-col items-center space-y-8 relative z-10 font-sans">
        
        {/* Step Cards Sheet */}
        <div className="w-full bg-card-bg/95 border border-border-color rounded-[2.5rem] shadow-card-shadow p-8 md:p-12 relative min-h-[420px] flex flex-col justify-between overflow-hidden">
          
          <AnimatePresence mode="wait" initial={false}>
            {currentStep === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-6 text-center"
              >
                <div className="flex justify-center mb-2">
                  <div className="hero-brand-glow">
                    <BrandMark className="h-16 w-16" />
                  </div>
                </div>
                <h1 className="font-mono font-bold text-3xl tracking-[0.25em] text-text-primary">
                  BASE
                </h1>
                <p className="text-base font-bold text-text-secondary tracking-tight">
                  A workspace that remembers, so you can focus.
                </p>
                <div className="w-10 h-px bg-border-color mx-auto my-4" />
                
                <p className="text-sm text-text-secondary leading-relaxed max-w-[420px] mx-auto font-normal">
                  Base is built on a <strong className="text-text-primary">Local First • User Owned Data</strong> philosophy.
                </p>
                <p className="text-xs md:text-sm text-text-secondary leading-relaxed max-w-[420px] mx-auto">
                  It is not another cloud storage application or note-taking platform. Instead, it acts as a quiet memory layer over the tools and resources students already use.
                </p>
              </motion.div>
            )}

            {currentStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <h2 className="text-lg font-bold text-text-primary text-center">Your Workspace Belongs to You</h2>
                <div className="w-10 h-px bg-border-color mx-auto my-3" />

                <div className="space-y-3 text-xs md:text-sm text-text-secondary leading-relaxed font-normal">
                  <p>
                    Your notes, tasks, ideas, history, and workspace state stay securely on <strong className="text-text-primary">your device</strong>, providing instant performance and complete offline functionality.
                  </p>
                  <p>
                    Your PDFs, images, presentations, documents, and other resources remain in <strong className="text-text-primary">your own Google Drive</strong>.
                  </p>
                  <p className="text-xs italic text-text-secondary/80">
                    Base simply remembers how everything is connected.
                  </p>
                </div>

                {/* What lives where grid */}
                <div className="bg-bg-app/40 border border-border-color/60 rounded-2xl p-4 space-y-2.5 text-xs">
                  <div className="font-semibold text-text-primary flex items-center gap-1.5 select-none text-[10px] uppercase tracking-wider">
                    <Info className="w-3.5 h-3.5 text-accent" />
                    <span>What Base Stores</span>
                  </div>
                  <div className="space-y-1.5 text-text-secondary font-medium">
                    <p className="flex items-start gap-1.5">
                      <span className="text-emerald-500">✓</span>
                      <span>Notes, tasks, ideas, history, and preferences → <span className="text-text-primary">Local IndexedDB</span></span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="text-emerald-500">✓</span>
                      <span>PDFs, images, presentations, and resources → <span className="text-text-primary">User's Google Drive</span></span>
                    </p>
                    <p className="flex items-start gap-1.5">
                      <span className="text-emerald-500">✓</span>
                      <span>Linked accounts, folder metadata, sync state → <span className="text-text-primary">Base PostgreSQL</span></span>
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="text-center">
                  <h2 className="text-lg font-bold text-text-primary">Knowledge Sources</h2>
                  <p className="text-xs text-text-secondary mt-1">
                    Choose the folders that Base should remember.
                  </p>
                </div>

                {mountedSuccess ? (
                  <div className="py-8 text-center space-y-4 animate-fade-in">
                    <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto animate-bounce">
                      <Check className="w-8 h-8" />
                    </div>
                    <h3 className="text-md font-bold text-text-primary">Knowledge Sources Mounted</h3>
                    <p className="text-xs text-text-secondary">Mounting your secure memory layer. Redirecting to home...</p>
                  </div>
                ) : !isDriveConnected ? (
                  /* Calm Setup Card */
                  <div className="border border-border-color bg-bg-app/30 p-5 rounded-2xl space-y-4 flex flex-col items-center text-center max-w-sm mx-auto shadow-xs">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-text-primary">Protect your workspace</h4>
                      <p className="text-[11px] text-text-secondary leading-normal">
                        Your notes stay on your device.<br/>
                        Your resources stay in your own cloud storage.
                      </p>
                    </div>

                    <Button
                      onClick={handleConnectDrive}
                      disabled={isConnecting}
                      className="w-full bg-accent hover:bg-accent/90 text-white font-semibold h-10 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-accent/15"
                    >
                      {isConnecting ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <HardDrive className="w-4 h-4" />
                          <span>Connect Google Drive</span>
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  /* Folder Picker */
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center gap-2 text-xs font-semibold text-text-primary px-1 select-none">
                      <FolderPlus className="w-4 h-4 text-accent" />
                      <span>Select Google Drive folders to index:</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {folders.map((folder) => {
                        const isSelected = selectedFolders.includes(folder.name);
                        return (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => handleToggleFolder(folder.name)}
                            className={`p-3 border rounded-xl flex items-center justify-between text-left transition-all duration-150 cursor-pointer ${
                              isSelected
                                ? 'bg-accent-light/35 border-accent text-accent'
                                : 'bg-bg-app/40 border-border-color text-text-secondary hover:border-accent/40'
                            }`}
                          >
                            <span className="text-xs font-semibold">{folder.name}</span>
                            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-accent border-accent text-white' : 'border-border-color'
                            }`}>
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <Button
                      onClick={handleMountFolders}
                      disabled={selectedFolders.length === 0 || isMounting}
                      className="w-full bg-accent hover:bg-accent/90 text-white font-semibold h-11 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      {isMounting ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <ShieldCheck className="w-4.5 h-4.5" />
                          <span>Mount {selectedFolders.length} Folder{selectedFolders.length === 1 ? '' : 's'}</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-8 border-t border-border-color/50 pt-6">
            <button
              onClick={prevStep}
              disabled={currentStep === 0 || mountedSuccess}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            {/* Dots indicator */}
            <div className="flex items-center gap-2 select-none">
              {[0, 1, 2].map(step => (
                <div
                  key={step}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    currentStep === step ? 'w-5 bg-accent' : 'w-2 bg-border-color'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={nextStep}
              disabled={currentStep === 2 || mountedSuccess}
              className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <span>Next</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
