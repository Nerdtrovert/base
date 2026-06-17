import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Workspace } from '../services/db';
import { useBaseStore } from '../store/useBaseStore';
import { TaskDashboard } from '../components/TaskDashboard';
import { PinnedResources } from '../components/PinnedResources';
import { RecentActivity } from '../components/RecentActivity';
import { QuickCapture } from '../components/QuickCapture';
import { ChevronLeft, Folder, Plus, X, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { extractTextFromPdf } from '../utils/pdfParser';

export const WorkspaceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { setActiveWorkspaceId, createResource, showCompanionMessage, connectedDriveAccounts } = useBaseStore();
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [showResourceForm, setShowResourceForm] = useState(false);
  
  // Resource Form States
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resType, setResType] = useState<'link' | 'drive' | 'pdf' | 'file'>('link');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [base64FileContent, setBase64FileContent] = useState('');
  const [extractedPdfText, setExtractedPdfText] = useState('');

  // Google Drive Upload Sub-Step States
  const [uploadToDrive, setUploadToDrive] = useState(false);
  const [selectedDriveEmail, setSelectedDriveEmail] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState('f_root');
  const [driveFolders, setDriveFolders] = useState<{ id: string; name: string; path: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const getBackendUrl = () => {
    if (typeof window === 'undefined') return 'http://localhost:5001';
    const hostname = window.location.hostname;
    if (hostname.includes('devtunnels.ms')) {
      return window.location.origin.replace('-5173', '-5001');
    }
    return `http://${hostname}:5001`;
  };

  const BACKEND_URL = getBackendUrl();

  // Load GDrive accounts on mount
  useEffect(() => {
    if (connectedDriveAccounts && connectedDriveAccounts.length > 0 && !selectedDriveEmail) {
      setSelectedDriveEmail(connectedDriveAccounts[0].email);
    }
  }, [connectedDriveAccounts, selectedDriveEmail]);

  // Fetch GDrive folders when upload checked or account changed
  useEffect(() => {
    if (uploadToDrive && selectedDriveEmail) {
      const fetchFolders = async () => {
        try {
          const res = await fetch(`${BACKEND_URL}/api/sync/drive/folders?email=${encodeURIComponent(selectedDriveEmail)}`, {
            credentials: 'include'
          });
          if (res.ok) {
            const data = await res.json();
            setDriveFolders(data.folders || []);
          }
        } catch (err) {
          console.error('[Folders] Error fetching folders:', err);
        }
      };
      fetchFolders();
    }
  }, [uploadToDrive, selectedDriveEmail]);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFile(file);
    if (!resTitle.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setResTitle(baseName);
    }
    setResUrl(`file:///local/${file.name}`);

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    try {
      if (isPdf) {
        showCompanionMessage('Reading and indexing PDF content locally...', 'info', 3000);
      }
      
      const reader = new FileReader();
      reader.onload = async (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        
        // Safe conversion of array buffer to base64
        const uint8Array = new Uint8Array(buffer);
        let binaryString = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, chunk as any);
        }
        const base64 = window.btoa(binaryString);
        setBase64FileContent(base64);

        if (isPdf) {
          try {
            const text = await extractTextFromPdf(buffer);
            setExtractedPdfText(text);
            showCompanionMessage(`Successfully parsed PDF "${file.name}" (${text.split(/\s+/).length} words).`, 'success');
          } catch (err) {
            console.error('[PDF Parser] Error:', err);
            showCompanionMessage('Failed to extract text from PDF. It will still be indexed by title.', 'warning');
          }
        } else {
          showCompanionMessage(`Attached file "${file.name}" successfully.`, 'success');
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error('[File Reader] Error:', err);
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim()) return;
    if (!uploadToDrive && !resUrl.trim()) return;

    let finalUrl = resUrl.trim();
    let finalType = resType;
    let finalExtractedText = resType === 'pdf' ? extractedPdfText : undefined;

    try {
      if (uploadToDrive && selectedDriveEmail) {
        setIsUploading(true);
        showCompanionMessage('Uploading resource to cloud storage...', 'info');

        const response = await fetch(`${BACKEND_URL}/api/sync/drive/upload`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: selectedDriveEmail,
            fileName: resTitle.trim(),
            folderId: selectedFolderId,
            content: base64FileContent || window.btoa(`Mock file content for resource: ${resTitle.trim()}`),
            mimeType: attachedFile ? attachedFile.type : 'text/plain'
          })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Upload failed');
        }

        finalUrl = data.webViewLink;
        finalType = 'drive';
        setIsUploading(false);
      }

      await createResource({
        title: resTitle.trim(),
        url: finalUrl,
        type: finalType,
        workspaceId: id || null,
        extractedText: finalExtractedText
      });

      setResTitle('');
      setResUrl('');
      setResType('link');
      setAttachedFile(null);
      setBase64FileContent('');
      setExtractedPdfText('');
      setUploadToDrive(false);
      setShowResourceForm(false);
      showCompanionMessage('Resource added to workspace and synced.', 'success');
    } catch (err: any) {
      console.error(err);
      setIsUploading(false);
      showCompanionMessage(err.message || 'Failed to add resource.', 'warning');
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
                      disabled={isUploading}
                      onChange={(e) => setResTitle(e.target.value)}
                      required
                    />
                  </div>
                  
                  {!uploadToDrive && (
                    <div className="space-y-2">
                      {(resType === 'pdf' || resType === 'file') && (
                        <div className="pb-1">
                          <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                            {resType === 'pdf' ? 'Attach Local PDF File' : 'Attach Local File'}
                          </label>
                          <input
                            type="file"
                            accept={resType === 'pdf' ? 'application/pdf' : '*'}
                            onChange={handleFileChange}
                            disabled={isUploading}
                            className="w-full text-xs text-text-primary file:mr-3 file:py-1 file:px-2.5 file:rounded-lg file:border file:border-border-color file:text-[10px] file:font-semibold file:bg-bg-app file:text-text-primary hover:file:bg-bg-app/80 file:cursor-pointer cursor-pointer"
                          />
                          {attachedFile && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                              ✓ Attached: {attachedFile.name}
                            </div>
                          )}
                          <div className="text-[9px] text-text-secondary mt-1">
                            Or enter a web link / path below:
                          </div>
                        </div>
                      )}
                      <div>
                        <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">
                          {resType === 'drive' ? 'Synced Link / Doc ID' :
                           resType === 'pdf' ? 'PDF Link or Local Path' :
                           resType === 'file' ? 'File Link or File Path' :
                           'URL / Link'}
                        </label>
                        <Input
                          type="text"
                          placeholder={
                            resType === 'drive' ? 'Cloud Link or Doc ID' :
                            resType === 'pdf' ? 'https://... or /path/to/file.pdf' :
                            resType === 'file' ? 'https://... or C:\\projects\\notes.txt' :
                            'https://example.com/article'
                          }
                          value={resUrl}
                          onChange={(e) => setResUrl(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload to Google Drive Sub-Step Section */}
                {connectedDriveAccounts && connectedDriveAccounts.length > 0 && (
                  <div className="p-3 bg-bg-app/40 border border-border-color rounded-xl space-y-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={uploadToDrive}
                        disabled={isUploading}
                        onChange={(e) => {
                          setUploadToDrive(e.target.checked);
                          if (e.target.checked) {
                            setResType('drive');
                          } else {
                            setResType('link');
                          }
                        }}
                        className="rounded border-border-color text-accent focus:ring-accent"
                      />
                      <span>☁️ Upload/Sync this resource to cloud storage</span>
                    </label>

                    {uploadToDrive && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-color/60 animate-fade-in">
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Select Synced Account</label>
                          <select
                            value={selectedDriveEmail}
                            disabled={isUploading}
                            onChange={(e) => setSelectedDriveEmail(e.target.value)}
                            className="w-full text-xs h-9 bg-card-bg border border-border-color rounded-xl px-2.5 focus:border-accent outline-none"
                          >
                            {connectedDriveAccounts.map(acc => (
                              <option key={acc.email} value={acc.email}>
                                {acc.email}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Select Destination Folder</label>
                          <select
                            value={selectedFolderId}
                            disabled={isUploading}
                            onChange={(e) => setSelectedFolderId(e.target.value)}
                            className="w-full text-xs h-9 bg-card-bg border border-border-color rounded-xl px-2.5 focus:border-accent outline-none"
                          >
                            {driveFolders.map(folder => (
                              <option key={folder.id} value={folder.id}>
                                {folder.name} ({folder.path})
                              </option>
                            ))}
                            {driveFolders.length === 0 && (
                              <option value="f_root">My Drive (Root)</option>
                            )}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border-color/60">
                  <div className="flex items-center gap-1.5">
                    {(!uploadToDrive ? (['link', 'drive', 'pdf', 'file'] as const) : (['drive'] as const)).map(type => (
                      <Button
                        key={type}
                        type="button"
                        variant={resType === type ? 'secondary' : 'ghost'}
                        size="sm"
                        disabled={isUploading}
                        onClick={() => setResType(type)}
                        className="h-6 px-2.5 text-[10px]"
                      >
                        {type}
                      </Button>
                    ))}
                  </div>

                  <Button
                    type="submit"
                    disabled={isUploading}
                    size="sm"
                  >
                    {isUploading ? 'Uploading...' : 'Save Resource'}
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
