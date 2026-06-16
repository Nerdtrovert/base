import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Workspace } from '../services/db';
import { useBaseStore } from '../store/useBaseStore';
import { TaskDashboard } from '../components/TaskDashboard';
import { PinnedResources } from '../components/PinnedResources';
import { RecentActivity } from '../components/RecentActivity';
import { QuickCapture } from '../components/QuickCapture';
import { CompanionBanner } from '../components/CompanionBanner';
import { ChevronLeft, Folder, Plus, X, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

export const WorkspaceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveWorkspaceId, createResource, showCompanionMessage } = useBaseStore();
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [showResourceForm, setShowResourceForm] = useState(false);
  
  // Resource Form States
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resType, setResType] = useState<'link' | 'drive' | 'pdf' | 'file'>('link');

  // Load workspace data reactively
  const workspace = useLiveQuery(() => id ? db.workspaces.get(id) : Promise.resolve(undefined), [id]) as Workspace | undefined;


  useEffect(() => {
    if (id) {
      setActiveWorkspaceId(id);
    }
    return () => setActiveWorkspaceId(null);
  }, [id, setActiveWorkspaceId]);

  if (workspace === null) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold">Workspace not found</h2>
        <button 
          onClick={() => navigate('/')} 
          className="text-accent font-semibold hover:underline"
        >
          Return Home
        </button>
      </div>
    );
  }

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resUrl.trim()) return;

    try {
      await createResource({
        title: resTitle.trim(),
        url: resUrl.trim(),
        type: resType,
        workspaceId: id || null
      });
      setResTitle('');
      setResUrl('');
      setResType('link');
      setShowResourceForm(false);
      showCompanionMessage('Resource added to workspace.', 'success');
    } catch (err) {
      console.error(err);
      showCompanionMessage('Failed to add resource.', 'warning');
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8 animate-fade-in relative min-h-[calc(100vh-4rem)]">
      
      {/* Back & Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-text-secondary text-sm font-medium">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 hover:text-accent transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Home</span>
        </button>
        <span>/</span>
        <span className="text-text-primary flex items-center gap-1 font-semibold">
          <Folder className="w-3.5 h-3.5 text-accent" />
          {workspace?.name}
        </span>
      </div>

      {/* Workspace Header */}
      <div className="border-b border-border-color pb-5">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
          {workspace?.name}
        </h1>
        {workspace?.description && (
          <p className="text-sm text-text-secondary mt-1.5 max-w-2xl leading-relaxed">
            {workspace.description}
          </p>
        )}
      </div>

      {/* Companion Banner Notification */}
      <CompanionBanner />

      {/* Workspace-specific Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (Contextual Tasks & Resources) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Workspace Tasks */}
          <TaskDashboard />

          {/* Resources Panel with inline Adder */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wider text-text-secondary uppercase">
                Resources
              </h3>
              <Button
                onClick={() => setShowResourceForm(!showResourceForm)}
                variant="outline"
                size="sm"
              >
                {showResourceForm ? 'Cancel' : 'Add Resource'}
              </Button>
            </div>

            {/* Quick Add Resource Form */}
            {showResourceForm && (
              <form onSubmit={handleAddResource} className="p-4 bg-card-bg border border-border-color rounded-2xl shadow-card-shadow space-y-3 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Title</label>
                    <Input
                      placeholder="e.g. Google Drive Slides, Reference Sheet"
                      value={resTitle}
                      onChange={(e) => setResTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">URL / Link</label>
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={resUrl}
                      onChange={(e) => setResUrl(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-color/60">
                  <div className="flex items-center gap-1.5">
                    {(['link', 'drive', 'pdf', 'file'] as const).map(type => (
                      <Button
                        key={type}
                        type="button"
                        variant={resType === type ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setResType(type)}
                        className="h-6 px-2.5 text-[10px]"
                      >
                        {type}
                      </Button>
                    ))}
                  </div>

                  <Button
                    type="submit"
                    size="sm"
                  >
                    Save Resource
                  </Button>
                </div>
              </form>
            )}

            {/* Resource Grid Cards */}
            <PinnedResources workspaceId={id} showAll={true} />
          </div>

        </div>

        {/* Right Column (Timeline View) */}
        <div className="space-y-6">
          <RecentActivity />
        </div>

      </div>

      {/* Floating Action Button for Workspace Quick Capture */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={() => setShowCaptureModal(true)}
          className="w-12 h-12 rounded-full bg-accent hover:bg-accent/90 text-white flex items-center justify-center shadow-lg shadow-accent/25 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="New Workspace Capture"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Workspace Quick Capture modal overlay */}
      {showCaptureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 dark:bg-black/55 backdrop-blur-[2px]">
          <div className="w-full max-w-lg bg-card-bg border border-border-color rounded-2xl shadow-2xl overflow-hidden animate-fade-in p-1">
            <div className="flex justify-end p-2 pb-0">
              <button
                onClick={() => setShowCaptureModal(false)}
                className="p-1 text-text-secondary hover:bg-bg-app rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 pt-0">
              <QuickCapture />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
