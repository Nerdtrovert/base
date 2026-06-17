import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useBaseStore } from '../store/useBaseStore';
import { db, type Workspace, type Task } from '../services/db';
import { 
  Menu, X, Cloud, Plus, Trash2, Folder, Calendar, 
  ArrowRight, ChevronLeft, ChevronRight, CheckSquare, 
  Check, HardDrive, LogIn, LogOut, User as UserIcon,
  Bell, BellOff, Info
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { BrandMark } from './BrandMark';
import { subscribeToPushNotifications, checkNotificationPermission, isPushSupported } from '../utils/pushNotifications';

export const HamburgerMenu: React.FC = () => {
  const { 
    isAuthenticated, 
    user, 
    connectedDriveAccounts, 
    addDriveAccount, 
    removeDriveAccount, 
    toggleDriveAccountActive,
    setActiveWorkspaceId,
    logout,
    showCompanionMessage
  } = useBaseStore();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  
  // Sub-modal triggers
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // Form states
  const [newDriveEmail, setNewDriveEmail] = useState('');
  const [showAddDriveForm, setShowAddDriveForm] = useState(false);
  
  // Database states
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  // Push status states
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Calendar navigation states
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch workspaces & tasks when modals are opened or on mount
  useEffect(() => {
    const fetchData = async () => {
      const w = await db.workspaces.toArray();
      const t = await db.tasks.toArray();
      setAllWorkspaces(w);
      setAllTasks(t);
    };
    fetchData();
  }, [showProjectsModal, showCalendarModal, isOpen]);

  // Check browser notification permission status
  useEffect(() => {
    const checkPush = async () => {
      const supported = await isPushSupported();
      if (!supported) {
        setPushStatus('unsupported');
        return;
      }
      const perm = await checkNotificationPermission();
      setPushStatus(perm);
    };

    if (isOpen) {
      checkPush();
    }
  }, [isOpen]);

  const handleSubscribe = async () => {
    setIsSubscribing(true);
    try {
      const sub = await subscribeToPushNotifications();
      if (sub) {
        setPushStatus('granted');
        showCompanionMessage('Notifications enabled! Check-in scheduled in 15 seconds.', 'success');
      } else {
        const perm = await checkNotificationPermission();
        setPushStatus(perm);
        if (perm === 'denied') {
          showCompanionMessage('Permission blocked. Reset permissions in your browser address bar.', 'warning');
        } else {
          showCompanionMessage('Subscription cancelled or permission dismissed.', 'info');
        }
      }
    } catch (error) {
      console.error('[HamburgerMenu] Subscribe error:', error);
      showCompanionMessage('Failed to subscribe. Is the server running?', 'warning');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleAddDrive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriveEmail.trim()) return;
    addDriveAccount(newDriveEmail.trim());
    setNewDriveEmail('');
    setShowAddDriveForm(false);
  };

  const selectProject = (id: string) => {
    setActiveWorkspaceId(id);
    setIsOpen(false);
    setShowProjectsModal(false);
    navigate(`/workspace/${id}`);
  };

  // Calendar Helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return days;
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday...
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleLoginClick = () => {
    setIsOpen(false);
    navigate('/login');
  };

  return (
    <>
      {/* Hamburger Toggle Button */}
      <Button
        onClick={() => setIsOpen(true)}
        variant="ghost"
        size="icon"
        className="h-10 w-10 text-text-primary hover:bg-bg-app rounded-xl cursor-pointer"
        title="Open Navigation Menu"
      >
        <Menu className="w-5 h-5 text-accent" />
      </Button>

      {/* Portal Container at Body Root */}
      {typeof document !== 'undefined' && createPortal(
        <>
          {/* Drawer & Backdrop */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                key="hamburger-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 bg-black z-[9999] cursor-pointer"
              />
            )}

            {isOpen && (
              <motion.div
                key="hamburger-drawer"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed top-0 left-0 bottom-0 w-80 max-w-[85vw] bg-card-bg border-r border-border-color shadow-2xl z-[9999] flex flex-col overflow-hidden"
              >
                {/* Drawer Header */}
                <div className="p-5 border-b border-border-color flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="hero-brand-glow">
                    <BrandMark className="h-9 w-9" />
                  </div>
                  <span className="font-mono font-bold tracking-[0.3em] text-text-primary text-base">
                    BASE
                    </span>
                  </div>
                  <Button
                    onClick={() => setIsOpen(false)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                  >
                    <X className="w-4 h-4 text-text-secondary" />
                  </Button>
                </div>

                {/* Profile Card inside drawer */}
                <div className="p-4 mx-4 mt-4 rounded-2xl bg-bg-app/50 border border-border-color/60 flex items-center gap-3">
                  {isAuthenticated && user ? (
                    <>
                      <img 
                        src={user.picture} 
                        alt={user.name} 
                        className="w-10 h-10 rounded-full border border-border-color object-cover"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate">{user.name}</p>
                        <p className="text-[10px] text-text-secondary truncate">{user.email}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-border-color flex items-center justify-center text-text-secondary">
                        <UserIcon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-grow">
                        <p className="text-xs font-semibold text-text-primary">Guest Space</p>
                        <button 
                          onClick={handleLoginClick} 
                          className="text-[10px] text-accent hover:underline font-semibold flex items-center gap-0.5 mt-0.5"
                        >
                          <LogIn className="w-3 h-3" />
                          <span>Log in / Sign up</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Navigation Menu Content */}
                <div className="flex-grow overflow-y-auto p-5 space-y-8">
                  {/* 1. Projects Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">
                      <span>WORKSPACES</span>
                      <button 
                        onClick={() => {
                          setIsOpen(false);
                          setShowProjectsModal(true);
                        }} 
                        className="text-accent hover:underline cursor-pointer lowercase"
                      >
                        view all
                      </button>
                    </div>
                    
                    <div className="space-y-1">
                      {allWorkspaces.slice(0, 4).map((ws) => (
                        <button
                          key={ws.id}
                          onClick={() => selectProject(ws.id)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-text-secondary hover:text-text-primary hover:bg-bg-app/60 text-left transition-colors font-medium"
                        >
                          <Folder className="w-4 h-4 text-accent/70" />
                          <span className="truncate">{ws.name}</span>
                        </button>
                      ))}
                      {allWorkspaces.length === 0 && (
                        <p className="text-[11px] text-text-muted italic px-3 py-1">No projects created yet.</p>
                      )}
                    </div>
                  </div>

                  {/* 2. Calendar Link */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">
                      <span>COMING UP</span>
                    </div>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setShowCalendarModal(true);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border-color bg-bg-app/40 hover:bg-bg-app text-left transition-colors"
                    >
                      <div className="flex items-center gap-3 text-xs font-medium text-text-primary">
                        <Calendar className="w-4 h-4 text-accent" />
                        <span>Full Month View</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-text-secondary" />
                    </button>
                  </div>

                  {/* 3. Google Drive Multi-Accounts Section */}
                  <div className="space-y-4">
                    <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">
                      <span>SYNCED</span>
                    </div>

                    {/* Connected accounts list */}
                    <div className="space-y-2">
                      {connectedDriveAccounts.map((acc) => (
                        <div 
                          key={acc.email} 
                          className={`p-3 rounded-xl border flex flex-col gap-1.5 transition-all ${
                            acc.isActive 
                              ? 'border-emerald-500/20 bg-emerald-500/5' 
                              : 'border-border-color bg-bg-app/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-text-primary truncate">{acc.email}</p>
                              <p className="text-[9px] text-text-secondary mt-0.5 flex items-center gap-1">
                                <HardDrive className="w-2.5 h-2.5 text-accent" />
                                <span>{acc.fileCount} synced files</span>
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => toggleDriveAccountActive(acc.email)}
                                className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                  acc.isActive 
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' 
                                    : 'border-border-color text-text-secondary hover:text-text-primary'
                                }`}
                                title={acc.isActive ? "Sync is Active" : "Click to Activate Sync"}
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeDriveAccount(acc.email)}
                                className="p-1.5 rounded-lg border border-border-color text-rose-500 hover:bg-rose-500/5 cursor-pointer transition-colors"
                                title="Disconnect Account"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      {connectedDriveAccounts.length === 0 && (
                        <div className="text-center py-4 border border-dashed border-border-color rounded-xl bg-bg-app/20">
                          <Cloud className="w-5 h-5 mx-auto text-text-secondary/50 mb-1" />
                          <p className="text-[10px] text-text-secondary px-4">Connect backup accounts to backup and sync your base.</p>
                        </div>
                      )}
                    </div>

                    {/* Add mock GDrive Account Form */}
                    {!showAddDriveForm ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddDriveForm(true)}
                        className="w-full gap-2 border-dashed border-border-color hover:border-accent/50 text-[11px] text-text-secondary"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Enable Sync</span>
                      </Button>
                    ) : (
                      <form onSubmit={handleAddDrive} className="flex flex-col gap-2 mt-2">
                        <Input
                          type="email"
                          placeholder="Drive Email (email@...)"
                          value={newDriveEmail}
                          onChange={(e) => setNewDriveEmail(e.target.value)}
                          className="text-xs h-9 bg-bg-app border-border-color focus:border-accent"
                          autoFocus
                        />
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button 
                            type="button" 
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowAddDriveForm(false);
                              setNewDriveEmail('');
                            }}
                            className="text-[11px] h-8 px-2.5"
                          >
                            Cancel
                          </Button>
                          <Button 
                            type="submit" 
                            size="sm"
                            className="h-8 px-3 bg-accent hover:bg-accent/90 text-white rounded-lg flex items-center justify-center cursor-pointer text-[11px]"
                          >
                            Connect
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* 4. Notifications Setup Section */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">
                      <span>NOTIFICATIONS</span>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border-color bg-bg-app/20 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {pushStatus === 'granted' ? (
                            <Bell className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <BellOff className="w-4 h-4 text-text-secondary" />
                          )}
                          <span className="text-xs font-semibold text-text-primary">
                            Status
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                          pushStatus === 'granted' 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/15'
                            : pushStatus === 'denied'
                            ? 'bg-rose-500/10 text-rose-500 border border-rose-500/15'
                            : pushStatus === 'unsupported'
                            ? 'bg-text-muted/10 text-text-muted border border-border-color'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/15'
                        }`}>
                          {pushStatus === 'granted' && 'Enabled'}
                          {pushStatus === 'denied' && 'Blocked'}
                          {pushStatus === 'unsupported' && 'Not Supported'}
                          {pushStatus === 'default' && 'Disabled'}
                        </span>
                      </div>

                      <p className="text-[10px] text-text-secondary leading-normal">
                        Get calendar event check-ins 4-5 hours before start times, and occasional quiet morning motivation prompts.
                      </p>

                      {pushStatus !== 'unsupported' && (
                        <Button
                          type="button"
                          variant={pushStatus === 'granted' ? 'outline' : 'secondary'}
                          size="sm"
                          disabled={isSubscribing || !isAuthenticated}
                          onClick={handleSubscribe}
                          className="w-full text-[11px] font-medium h-8"
                        >
                          {isSubscribing ? 'Connecting...' : pushStatus === 'granted' ? 'Refresh Connection' : 'Enable Notifications'}
                        </Button>
                      )}

                      {!isAuthenticated && (
                        <p className="text-[9px] text-text-muted text-center italic">
                          Please log in to register push notifications.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 5. About Link */}
                  <div className="space-y-3 pt-2">
                    <div className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">
                      <span>ABOUT</span>
                    </div>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/about');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-border-color bg-bg-app/40 hover:bg-bg-app text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 text-xs font-medium text-text-primary">
                        <Info className="w-4 h-4 text-accent" />
                        <span>About Base Workspace</span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-text-secondary" />
                    </button>
                  </div>
                </div>

                {/* Drawer Footer with Logout button */}
                {isAuthenticated && (
                  <div className="p-4 border-t border-border-color bg-bg-app/10 flex items-center">
                    <Button
                      onClick={() => {
                        setIsOpen(false);
                        logout();
                      }}
                      variant="ghost"
                      className="w-full justify-start text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/5 flex items-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Projects Modal Overlay */}
          <AnimatePresence>
            {showProjectsModal && (
              <motion.div
                key="projects-modal-wrapper"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowProjectsModal(false);
                }}
                className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60 backdrop-blur-[2px]"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="w-full max-w-2xl bg-card-bg border border-border-color rounded-[28px] p-6 md:p-8 shadow-2xl relative z-10 overflow-hidden max-h-[85vh] flex flex-col"
                >
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-color">
                    <div className="flex items-center gap-2">
                      <Folder className="w-5 h-5 text-accent" />
                      <h3 className="text-lg font-bold text-text-primary">All Active Workspaces</h3>
                      <span className="bg-bg-app border border-border-color text-text-secondary text-[10px] font-mono px-2 py-0.5 rounded-md">
                        {allWorkspaces.length}
                      </span>
                    </div>
                    <Button
                      onClick={() => setShowProjectsModal(false)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                    >
                      <X className="w-4 h-4 text-text-secondary" />
                    </Button>
                  </div>

                  {/* Grid Workspaces list */}
                  <div className="flex-grow overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 pb-2">
                    {allWorkspaces.map((ws) => (
                      <div 
                        key={ws.id}
                        onClick={() => selectProject(ws.id)}
                        className="p-5 rounded-[28px] border border-border-color bg-bg-app/30 hover:bg-bg-app/90 hover:border-accent/40 cursor-pointer transition-all flex flex-col justify-between h-32 text-left group"
                      >
                        <div>
                          <h4 className="font-bold text-text-primary text-sm truncate group-hover:text-accent transition-colors">
                            {ws.name}
                          </h4>
                          <p className="text-xs text-text-secondary mt-1.5 line-clamp-2">
                            {ws.description || "No description provided. Click to open and add capture cards."}
                          </p>
                        </div>
                        <div className="text-[9px] text-text-muted font-mono mt-3 flex items-center justify-between">
                          <span>Created: {new Date(ws.createdAt).toLocaleDateString()}</span>
                          <span className="text-accent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity font-semibold flex items-center gap-0.5">
                            Open <ArrowRight className="w-2.5 h-2.5" />
                          </span>
                        </div>
                      </div>
                    ))}

                    {allWorkspaces.length === 0 && (
                      <div className="col-span-2 text-center py-12 border border-dashed border-border-color rounded-[28px] bg-bg-app/20">
                        <Folder className="w-8 h-8 mx-auto text-text-secondary/40 mb-2" />
                        <p className="text-sm text-text-primary font-semibold">Your Project Drawer is Empty</p>
                        <p className="text-xs text-text-secondary mt-1">Create your first Workspace from the Home screen.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Calendar Full Month Modal Overlay */}
          <AnimatePresence>
            {showCalendarModal && (
              <motion.div
                key="calendar-modal-wrapper"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => {
                  if (e.target === e.currentTarget) setShowCalendarModal(false);
                }}
                className="fixed inset-0 z-[9999] flex items-center justify-center px-4 bg-black/60 backdrop-blur-[2px]"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  className="w-full max-w-xl bg-card-bg border border-border-color rounded-[28px] p-6 md:p-8 shadow-2xl relative z-10 overflow-hidden flex flex-col"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-color">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-accent" />
                      <h3 className="text-lg font-bold text-text-primary">Workspace Calendar</h3>
                    </div>
                    <Button
                      onClick={() => setShowCalendarModal(false)}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                    >
                      <X className="w-4 h-4 text-text-secondary" />
                    </Button>
                  </div>

                  {/* Month Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                      {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button"
                        onClick={prevMonth}
                        className="p-1.5 rounded-lg border border-border-color hover:bg-bg-app text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button 
                        type="button"
                        onClick={nextMonth}
                        className="p-1.5 rounded-lg border border-border-color hover:bg-bg-app text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Weekday Labels */}
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-text-secondary tracking-wider mb-2">
                    <span>SUN</span>
                    <span>MON</span>
                    <span>TUE</span>
                    <span>WED</span>
                    <span>THU</span>
                    <span>FRI</span>
                    <span>SAT</span>
                  </div>

                  {/* Month Days Grid */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {/* Empty pre-padding days */}
                    {Array.from({ length: getFirstDayOfMonth(currentDate) }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-12 bg-transparent" />
                    ))}

                    {/* Actual Month Days */}
                    {Array.from({ length: getDaysInMonth(currentDate) }).map((_, idx) => {
                      const day = idx + 1;
                      const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      
                      // Check tasks for this specific day
                      const dayTasks = allTasks.filter(t => t.dueDate === dateString);
                      const activeTasks = dayTasks.filter(t => !t.completed);
                      
                      // Check if today
                      const today = new Date();
                      const isToday = today.getDate() === day && 
                                      today.getMonth() === currentDate.getMonth() && 
                                      today.getFullYear() === currentDate.getFullYear();

                      return (
                        <div
                          key={`day-${day}`}
                          className={`h-12 rounded-xl border flex flex-col justify-between p-1.5 transition-all relative ${
                            isToday 
                              ? 'border-accent bg-accent/5 font-bold' 
                              : 'border-border-color/60 hover:border-accent/40 bg-bg-app/20'
                          }`}
                        >
                          <span className={`text-[10px] ${isToday ? 'text-accent' : 'text-text-secondary'}`}>
                            {day}
                          </span>
                          
                          {/* Active tasks dots marker */}
                          {activeTasks.length > 0 && (
                            <div 
                              className="flex items-center gap-0.5 overflow-hidden justify-end"
                              title={`${activeTasks.length} pending tasks due`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                              {activeTasks.length > 1 && (
                                <span className="text-[8px] font-mono text-text-secondary leading-none">
                                  +{activeTasks.length - 1}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Quick upcoming tasks summary under calendar */}
                  <div className="mt-6 border-t border-border-color pt-4 flex-grow overflow-y-auto max-h-40">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-3">
                      <CheckSquare className="w-3.5 h-3.5 text-accent" />
                      <span>UPCOMING TASKS</span>
                    </div>
                    <div className="space-y-2">
                      {allTasks
                        .filter(t => !t.completed)
                        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                        .slice(0, 3)
                        .map(t => (
                          <div key={t.id} className="flex items-center justify-between gap-3 text-xs bg-bg-app/45 border border-border-color p-2.5 rounded-xl">
                            <span className="font-medium text-text-primary truncate">{t.title}</span>
                            <span className="text-[10px] text-accent font-semibold font-mono flex-shrink-0">{t.dueDate}</span>
                          </div>
                        ))}
                      {allTasks.filter(t => !t.completed).length === 0 && (
                        <p className="text-[11px] text-text-muted italic">No upcoming tasks due.</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </>
  );
};
