import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useBaseStore } from './store/useBaseStore';
import { Navbar } from './components/Navbar';
import { SpotlightSearch } from './components/SpotlightSearch';
import { Home } from './pages/Home';
import { WorkspaceDetail } from './pages/WorkspaceDetail';
import { AuthCallback } from './pages/AuthCallback';
import { Home as HomeIcon, Search, PlusCircle, Folder, CheckSquare } from 'lucide-react';

// Wrapper component to handle routing hooks (useLocation, checkAuth, mobile actions)
function AppContent() {
  const { checkAuthStatus, setSearchOpen } = useBaseStore();
  const location = useLocation();
  const navigate = useNavigate();


  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // Sync window page title with current context
  useEffect(() => {
    if (location.pathname === '/') {
      document.title = 'Base • Calm Student Workspace';
    } else if (location.pathname.startsWith('/workspace/')) {
      document.title = 'Base • Workspace';
    }
  }, [location]);

  return (
    <div className="bg-blueprint-grid min-h-screen text-text-primary flex flex-col pb-16 sm:pb-0">
      
      {/* Top Navbar */}
      <Navbar />

      {/* Main Pages router */}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/workspace/:id" element={<WorkspaceDetail />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </main>

      {/* Spotlight Search Overlay Modal */}
      <SpotlightSearch />

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
