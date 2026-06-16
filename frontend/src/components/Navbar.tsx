import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useBaseStore } from '../store/useBaseStore';
import { Search, Cloud, CloudOff, RefreshCw, LogIn, LogOut } from 'lucide-react';
import { Button } from './ui/button';


export const Navbar: React.FC = () => {
  const { 
    isAuthenticated, 
    user, 
    syncStatus, 
    lastSynced, 
    setSearchOpen, 
    login, 
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
        
        {/* Logo */}
        <button 
          onClick={handleLogoClick}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-white font-bold text-lg font-mono shadow-sm shadow-accent/20 group-hover:scale-95 transition-transform">
            B
          </div>
          <span className="font-mono font-bold text-lg tracking-wider text-text-primary group-hover:text-accent transition-colors">
            BASE
          </span>
        </button>

        {/* Action Items */}
        <div className="flex items-center gap-4">
          {/* Spotlight Search Toggle */}
          <Button
            onClick={() => setSearchOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2 bg-bg-app font-medium text-text-secondary"
            title="Search Everything"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search...</span>
            <span className="font-mono text-[9px] opacity-60 bg-black/5 dark:bg-white/5 px-1 py-0.5 rounded">
              ⌘K
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
                <div className="text-[9px] text-text-secondary mt-0.5 font-mono">
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
              onClick={login}
              variant="secondary"
              size="sm"
              className="gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Connect Drive</span>
            </Button>
          )}

        </div>
      </div>
    </nav>
  );
};
