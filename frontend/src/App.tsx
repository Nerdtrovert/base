import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useBaseStore } from './store/useBaseStore';
import { Navbar } from './components/Navbar';
import { SpotlightSearch } from './components/SpotlightSearch';
import { CompanionBanner } from './components/CompanionBanner';
import { Home } from './pages/Home';
import { WorkspaceDetail } from './pages/WorkspaceDetail';
import { AuthCallback } from './pages/AuthCallback';
import { Login } from './pages/Login';
import { Timeline } from './pages/Timeline';
import { Home as HomeIcon, Search, PlusCircle, Folder, CheckSquare, Clock } from 'lucide-react';
import { BrandMark } from './components/BrandMark';

// Wrapper component to handle routing hooks (useLocation, checkAuth, mobile actions)
function AppContent() {
  const { checkAuthStatus, setSearchOpen, isAuthenticated, isAuthLoading } = useBaseStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Auto-subscribe/refresh push notifications if permission is already granted
  useEffect(() => {
    if (isAuthenticated) {
      const checkAndSubscribe = async () => {
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            const { subscribeToPushNotifications } = await import('./utils/pushNotifications');
            await subscribeToPushNotifications();
            console.log('[App] Auto-refreshed push notification subscription.');
          } catch (e) {
            console.error('[App] Failed to auto-refresh push subscription:', e);
          }
        }
      };
      checkAndSubscribe();
    }
  }, [isAuthenticated]);

  // Sync window page title with current context
  useEffect(() => {
    if (location.pathname === '/') {
      document.title = 'Base • Calm Student Workspace';
    } else if (location.pathname.startsWith('/workspace/')) {
      document.title = 'Base • Workspace';
    } else if (location.pathname === '/timeline') {
      document.title = 'Base • Timeline';
    }
  }, [location]);

  if (isAuthLoading) {
    return (
      <div className="bg-blueprint-grid min-h-screen text-text-primary flex flex-col items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="hero-brand-glow inline-block mb-2">
            <BrandMark className="h-12 w-12 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-text-primary animate-pulse">
            Loading your Base...
          </h2>
          <p className="text-xs text-text-secondary">
            Initializing your secure memory layers...
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated and trying to access private page
  if (!isAuthenticated && location.pathname !== '/login' && location.pathname !== '/auth/callback') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="bg-blueprint-grid min-h-screen text-text-primary flex flex-col pb-16 sm:pb-0">
      
      {/* Top Navbar */}
      <Navbar />

      {/* Main Pages router */}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/workspace/:id" element={<WorkspaceDetail />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/timeline" element={<Timeline />} />
        </Routes>
      </main>

      {/* Spotlight Search Overlay Modal */}
      <SpotlightSearch />

      {/* Floating Workspace Companion Toast */}
      <CompanionBanner />

      {/* Bottom Mobile Navigation (Fixed on small screens, hidden on desktop) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-card-bg/95 backdrop-blur-md border-t border-border-color h-16 flex items-center justify-around px-4 z-40 shadow-lg">
        <button
          onClick={() => navigate('/')}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
            location.pathname === '/' ? 'text-accent' : 'text-text-secondary'
          }`}
        >
          <HomeIcon className="w-5 h-5" />
          <span>Home</span>
        </button>

        <button
          onClick={() => setSearchOpen(true)}
          className="flex flex-col items-center gap-1 text-[10px] font-medium text-text-secondary hover:text-accent transition-colors"
        >
          <Search className="w-5 h-5" />
          <span>Search</span>
        </button>

        {/* Floating Quick Capture Trigger */}
        <button
          onClick={() => {
            if (location.pathname.startsWith('/workspace/')) {
              // Trigger workspace floating capture
              const floatingBtn = document.querySelector('[title="New Workspace Capture"]') as HTMLButtonElement;
              if (floatingBtn) floatingBtn.click();
            } else {
              // Open quick capture on home page or navigate home
              navigate('/');
              setTimeout(() => {
                const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                if (textarea) textarea.focus();
              }, 100);
            }
          }}
          className="flex flex-col items-center justify-center -mt-6 w-12 h-12 rounded-full bg-accent text-white shadow-md shadow-accent/20 hover:scale-95 transition-transform"
        >
          <PlusCircle className="w-6 h-6" />
        </button>

        <button
          onClick={() => {
            // Find Workspaces section and scroll into view or navigate
            if (location.pathname !== '/') {
              navigate('/');
            }
            setTimeout(() => {
              const wsSection = document.querySelector('.bg-card-bg.border.border-border-color.rounded-2xl.shadow-card-shadow.p-5');
              if (wsSection) wsSection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
          className="flex flex-col items-center gap-1 text-[10px] font-medium text-text-secondary hover:text-accent transition-colors"
        >
          <Folder className="w-5 h-5" />
          <span>Workspaces</span>
        </button>

        <button
          onClick={() => {
            if (location.pathname !== '/') {
              navigate('/');
            }
            setTimeout(() => {
              const tasksSection = document.querySelector('form + .space-y-4');
              if (tasksSection) tasksSection.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }}
          className="flex flex-col items-center gap-1 text-[10px] font-medium text-text-secondary hover:text-accent transition-colors"
        >
          <CheckSquare className="w-5 h-5" />
          <span>Tasks</span>
        </button>

        <button
          onClick={() => navigate('/timeline')}
          className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-colors ${
            location.pathname === '/timeline' ? 'text-accent' : 'text-text-secondary'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span>Timeline</span>
        </button>
      </div>

    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
