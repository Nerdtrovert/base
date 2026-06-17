import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBaseStore } from '../store/useBaseStore';
import { Search, Cloud, CloudOff, RefreshCw, LogIn, LogOut, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { HamburgerMenu } from './HamburgerMenu';
import { BrandMark } from './BrandMark';


export const Navbar: React.FC = () => {
  const { 
    isAuthenticated, 
    user, 
    syncStatus, 
    lastSynced, 
    setSearchOpen, 
    logout,
    setActiveWorkspaceId
  } = useBaseStore();
  const navigate = useNavigate();

  const handleLogoClick = () => {
    setActiveWorkspaceId(null);
    navigate('/');
  };

  const getSyncTooltip = () => {
    if (!isAuthenticated) return 'Sync disabled. Log in to enable.';
    if (syncStatus === 'syncing') return 'Syncing with Google Drive...';
    if (syncStatus === 'success') {
      return `Synced! Last backup: ${lastSynced ? new Date(lastSynced).toLocaleTimeString() : 'now'}`;
    }
    if (syncStatus === 'error') return 'Sync failed. Retry in a few moments.';
    return 'Cloud storage in sync.';
  };

  return (
    <nav className="border-b border-border-color bg-card-bg/80 backdrop-blur-md sticky top-0 z-40 transition-all duration-200">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        
        <div className="flex items-center gap-2">
          {/* Hamburger Menu Toggle & Side Drawer */}
          <HamburgerMenu />

          {/* Logo */}
          <button 
            onClick={handleLogoClick}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="hero-brand-glow">
              <BrandMark className="h-9 w-9 transition-transform duration-200 group-hover:scale-[0.97]" />
            </div>
            <span className="font-mono font-bold text-lg tracking-[0.38em] text-brand-ink group-hover:text-accent transition-colors">
              BASE
            </span>
          </button>

          {/* Timeline Link (Desktop) */}
          {isAuthenticated && (
            <button
              onClick={() => navigate('/timeline')}
              className="ml-6 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-color bg-bg-app/50 hover:bg-bg-app text-xs font-semibold text-text-secondary hover:text-accent cursor-pointer transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
          )}
        </div>

        {/* Action Items */}
        <div className="flex items-center gap-4">
          {/* Spotlight Search Toggle */}
          <Button
            onClick={() => setSearchOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2 bg-bg-app font-medium text-text-secondary hidden sm:flex"
            title="Search Everything"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search...</span>
            <span className="font-mono text-[9px] opacity-90 bg-bg-app/70 border border-border-color/70 px-1 py-0.5 rounded">
                {typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K'}
              </span>
          </Button>

          {/* Sync Status Badge */}
          <div 
            className="relative cursor-help"
            title={getSyncTooltip()}
          >
            {isAuthenticated ? (
              <div className="flex items-center gap-1 bg-bg-app border border-border-color px-2.5 py-1.5 rounded-xl text-xs text-text-secondary font-medium">
                {syncStatus === 'syncing' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
                ) : syncStatus === 'error' ? (
                  <CloudOff className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                )}
                <span className="hidden md:inline">
                  {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'error' ? 'Sync Error' : 'Cloud Saved'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-bg-app/40 border border-dashed border-border-color px-2.5 py-1.5 rounded-xl text-xs text-text-secondary font-medium">
                <CloudOff className="w-3.5 h-3.5 opacity-60" />
                <span className="hidden md:inline">Offline Mode</span>
              </div>
            )}
          </div>

          {/* Vertical Divider */}
          <div className="w-px h-6 bg-border-color" />

          {/* User Profile / Auth */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-text-primary leading-none">
                  {user.name}
                </div>
                <div className="text-[9px] text-text-muted mt-0.5 font-mono">
                  Google Drive sync
                </div>
              </div>
              <div className="relative group">
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full border border-border-color cursor-pointer object-cover"
                />
                
                {/* Simple dropdown menu on hover */}
                <div className="absolute right-0 mt-2 w-40 bg-card-bg border border-border-color rounded-xl shadow-lg py-1 hidden group-hover:block hover:block animate-fade-in z-50">
                  <div className="px-3 py-1.5 border-b border-border-color text-xs text-text-secondary truncate">
                    {user.email}
                  </div>
                  <Button
                    onClick={logout}
                    variant="ghost"
                    className="w-full justify-start rounded-none px-3 py-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/5 flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => navigate('/login')}
              variant="secondary"
              size="sm"
              className="gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </Button>
          )}

        </div>
      </div>
    </nav>
  );
};
