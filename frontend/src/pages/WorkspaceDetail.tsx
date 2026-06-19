import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Workspace, type Capture } from '../services/db';
import { useBaseStore } from '../store/useBaseStore';
import { TaskDashboard } from '../components/TaskDashboard';
import { PinnedResources } from '../components/PinnedResources';
import { RecentActivity } from '../components/RecentActivity';
import { 
  ChevronLeft, 
  Folder, 
  X, 
  AlertCircle, 
  Star, 
  Trash2, 
  Save, 
  FileText, 
  BookOpen, 
  Sun, 
  Moon, 
  Tag
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { extractTextFromPdf } from '../utils/pdfParser';
import { BACKEND_URL } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';

export const WorkspaceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { 
    setActiveWorkspaceId, 
    createResource, 
    showCompanionMessage, 
    connectedDriveAccounts,
    createCapture,
    updateCaptureContent,
    visitCapture,
    toggleCaptureImportance,
    deleteCapture
  } = useBaseStore();

  // Resource Form States
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [resTitle, setResTitle] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [resType, setResType] = useState<'link' | 'drive' | 'pdf' | 'file'>('link');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [base64FileContent, setBase64FileContent] = useState('');
  const [extractedPdfText, setExtractedPdfText] = useState('');

  // Google Drive Upload Sub-Step States
  const [uploadToDrive, setUploadToDrive] = useState(false);
  const [selectedDriveEmail, setSelectedDriveEmail] = useState('');
  const selectedFolderId = 'f_root';
  const [isUploading, setIsUploading] = useState(false);

  // Focus Workspace persistent state
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState('');
  const [isNoteStarred, setIsNoteStarred] = useState(false);
  const [notesFilter, setNotesFilter] = useState<'all' | 'starred'>('all');
  const [notesSearch, setNotesSearch] = useState('');
  const [showRelatedNoteModal, setShowRelatedNoteModal] = useState<Capture | null>(null);

  // Load GDrive accounts on mount
  useEffect(() => {
    if (connectedDriveAccounts && connectedDriveAccounts.length > 0 && !selectedDriveEmail) {
      setSelectedDriveEmail(connectedDriveAccounts[0].email);
    }
  }, [connectedDriveAccounts, selectedDriveEmail]);



  // Load workspace data reactively
  const workspace = useLiveQuery(() => id ? db.workspaces.get(id) : Promise.resolve(undefined), [id]) as Workspace | undefined;

  // Reactively fetch notes and ideas belonging to this workspace
  const myNotes = useLiveQuery(async () => {
    if (!id) return [];
    const captures = await db.captures.where({ workspaceId: id }).toArray();
    // Filter to notes/ideas
    return captures.filter(c => c.type === 'note' || c.type === 'idea');
  }, [id]) || [];

  // Reactively fetch related notes from other workspaces
  const relatedNotes = useLiveQuery(async () => {
    if (!id || myNotes.length === 0) return [];
    
    // Extract tags (hashtags like #tagname) from current notes
    const myTags = new Set<string>();
    myNotes.forEach(n => {
      const tags = n.content.match(/#[\w-]+/g);
      if (tags) tags.forEach(t => myTags.add(t.toLowerCase()));
    });

    const allCaptures = await db.captures.toArray();
    // Filter other workspaces notes
    const otherNotes = allCaptures.filter(c => c.workspaceId !== id && (c.type === 'note' || c.type === 'idea'));
    
    const workspaces = await db.workspaces.toArray();
    const wsMap = new Map(workspaces.map(w => [w.id, w.name]));

    return otherNotes.map(n => {
      let score = 0;
      // Match tags
      const otherTags = n.content.match(/#[\w-]+/g);
      if (otherTags) {
        otherTags.forEach(t => {
          if (myTags.has(t.toLowerCase())) {
            score += 10;
          }
        });
      }

      // Proximity score based on matching keywords
      const words = myNotes.flatMap(myN => myN.content.split(/\s+/).slice(0, 15));
      words.forEach(word => {
        if (word.length > 4 && n.content.toLowerCase().includes(word.toLowerCase())) {
          score += 1;
        }
      });

      return {
        note: n,
        workspaceName: n.workspaceId ? wsMap.get(n.workspaceId) : 'Unorganized',
        score
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.note)
    .slice(0, 4);
  }, [id, myNotes]) || [];

  // Toggle active workspace in store
  useEffect(() => {
    if (id) {
      setActiveWorkspaceId(id);
    }
    return () => setActiveWorkspaceId(null);
  }, [id, setActiveWorkspaceId]);

  // Restore Theme on Workspace mount
  useEffect(() => {
    const nextTheme = workspace?.uiState?.theme;
    if (nextTheme) {
      if (nextTheme === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    }
  }, [workspace?.id]);

  // Restore Scroll Position, filters, draft editor on mount
  useEffect(() => {
    if (workspace?.id) {
      // Restore filters
      if (workspace.uiState?.selectedFilters) {
        const filters = workspace.uiState.selectedFilters;
        if (filters.notesFilter) setNotesFilter(filters.notesFilter);
        if (filters.notesSearch) setNotesSearch(filters.notesSearch);
      }
      
      // Restore Open Note
      if (workspace.uiState?.openNoteId) {
        setSelectedNoteId(workspace.uiState.openNoteId);
      } else {
        setSelectedNoteId(null);
      }

      // Restore last editing draft state
      const editingState = workspace.uiState?.lastEditingState || '';
      setDraftContent(editingState);

      // Restore cursor position if available
      const cursorState = workspace.uiState?.cursorPosition;
      if (cursorState !== undefined) {
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = cursorState;
            textareaRef.current.selectionEnd = cursorState;
            textareaRef.current.focus();
          }
        }, 200);
      }

      // Restore scroll position
      if (workspace.uiState?.scrollPosition) {
        const scrollPos = workspace.uiState.scrollPosition;
        const timer = setTimeout(() => {
          window.scrollTo({
            top: scrollPos,
            behavior: 'auto'
          });
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [workspace?.id]);

  // Save last editing state debounced
  useEffect(() => {
    if (!id || draftContent === undefined) return;
    const timer = setTimeout(() => {
      db.workspaces.update(id, {
        'uiState.lastEditingState': draftContent
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [draftContent, id]);

  // Save scroll position debounced
  useEffect(() => {
    const handleScroll = () => {
      if (!id) return;
      const scrollPos = window.scrollY;
      const timer = setTimeout(() => {
        db.workspaces.update(id, {
          'uiState.scrollPosition': scrollPos
        });
      }, 300);
      return () => clearTimeout(timer);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [id]);

  // Save filters to workspace UI state
  const handleNotesFilterChange = (filter: 'all' | 'starred') => {
    setNotesFilter(filter);
    if (id) {
      db.workspaces.update(id, {
        'uiState.selectedFilters.notesFilter': filter
      });
    }
  };

  const handleNotesSearchChange = (query: string) => {
    setNotesSearch(query);
    if (id) {
      db.workspaces.update(id, {
        'uiState.selectedFilters.notesSearch': query
      });
    }
  };

  // Save selected note ID
  const handleSelectNote = async (noteId: string | null) => {
    setSelectedNoteId(noteId);
    if (id) {
      db.workspaces.update(id, {
        'uiState.openNoteId': noteId
      });
    }

    if (noteId) {
      const note = myNotes.find(n => n.id === noteId);
      if (note) {
        setDraftContent(note.content);
        setIsNoteStarred(note.importance === 1);
        await visitCapture(noteId); // Increment views
      }
    } else {
      setDraftContent('');
      setIsNoteStarred(false);
    }
  };

  // Toggle Workspace local Theme
  const handleToggleWorkspaceTheme = () => {
    if (!id || !workspace) return;
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }

    db.workspaces.update(id, {
      'uiState.theme': nextTheme
    });
    showCompanionMessage(`Theme set to ${nextTheme === 'dark' ? 'Night Studio' : 'Quiet Notebook'} for this focus mode.`, 'success');
  };

  // File attached action
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
        
        // Convert to base64
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

  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const start = e.currentTarget.selectionStart;
    if (id) {
      db.workspaces.update(id, {
        'uiState.cursorPosition': start
      });
    }
  };

  // Create workspace note
  const handleSaveWorkspaceNote = async () => {
    if (!draftContent.trim() || !id) return;

    if (selectedNoteId) {
      // Edit existing note
      await updateCaptureContent(selectedNoteId, draftContent.trim());
      showCompanionMessage('Focus Mode note saved.', 'success');
    } else {
      // Create new note
      const type = draftContent.length > 80 ? 'note' : 'idea';
      await createCapture({
        workspaceId: id,
        type,
        content: draftContent.trim()
      });
      setDraftContent('');
      handleSelectNote(null);
    }
  };

  // Toggle selected note importance
  const handleToggleNoteImportance = async () => {
    if (selectedNoteId) {
      await toggleCaptureImportance(selectedNoteId);
      setIsNoteStarred(!isNoteStarred);
    }
  };

  // Delete selected note
  const handleDeleteNote = async (noteId: string) => {
    if (confirm('Delete this note?\n\nIf it was synced earlier, your latest version is still recoverable for 30 days.')) {
      await deleteCapture(noteId);
      if (selectedNoteId === noteId) {
        handleSelectNote(null);
      }
      showCompanionMessage('Note deleted.', 'info');
    }
  };

  // Add workspace Resource
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
      showCompanionMessage('Resource added to focus mode and synced.', 'success');
    } catch (err: any) {
      console.error(err);
      setIsUploading(false);
      showCompanionMessage(err.message || 'Failed to add resource.', 'warning');
    }
  };

  if (workspace === null) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold">Focus Mode not found</h2>
        <button 
          onClick={() => navigate('/')} 
          className="text-accent font-semibold hover:underline"
        >
          Return Home
        </button>
      </div>
    );
  }

  // Filters index notes list
  const filteredNotes = myNotes.filter(note => {
    if (notesFilter === 'starred' && note.importance !== 1) return false;
    if (notesSearch.trim()) {
      return note.content.toLowerCase().includes(notesSearch.toLowerCase());
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10 space-y-8 animate-fade-in relative min-h-[calc(100vh-4rem)]">
      
      {/* 1. Breadcrumb navigation */}
      <div className="flex items-center justify-between text-text-secondary text-sm font-medium">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1 hover:text-accent transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Home</span>
          </button>
          <span>/</span>
          <span className="text-text-primary flex items-center gap-1 font-semibold select-none">
            <Folder className="w-3.5 h-3.5 text-accent" />
            {workspace?.name}
          </span>
        </div>

        {/* Custom Workspace Local Theme Toggle */}
        <button
          onClick={handleToggleWorkspaceTheme}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border-color rounded-xl hover:bg-bg-app text-xs transition-colors"
          title="Switch workspace theme perspective"
        >
          {document.documentElement.classList.contains('dark') ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-text-primary font-semibold">Notebook theme</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-text-primary font-semibold">Night Studio</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Workspace Title Header */}
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

      {/* 3. Focus-mode columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column (Notes Editor & Ruled Pane Index) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wider text-text-secondary uppercase">
                Notes & Captured Ideas
              </h3>
              <Button
                variant={selectedNoteId === null ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => handleSelectNote(null)}
              >
                New Capture
              </Button>
            </div>

            {/* Note Editor Card Sheet */}
            <div className="relative rounded-[28px] border border-border-color bg-card-bg/30 dark:bg-card-bg/10 backdrop-blur-md p-6 shadow-sm flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between pb-3 border-b border-border-color/40 mb-4">
                <span className="text-xs font-bold font-mono text-text-secondary uppercase">
                  {selectedNoteId ? 'Edit Capture Note' : 'Draft Capture'}
                </span>
                
                {selectedNoteId && (
                  <button
                    onClick={handleToggleNoteImportance}
                    className={`p-1.5 rounded-lg border transition-all ${
                      isNoteStarred 
                        ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' 
                        : 'text-text-secondary border-border-color hover:text-text-primary'
                    }`}
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                )}
              </div>

              <div className="flex-grow">
                <textarea
                  ref={textareaRef}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  onSelect={handleTextareaSelect}
                  placeholder="Capture notes, details, thoughts, or tag tags with #hashtag..."
                  className="w-full h-56 bg-transparent border-none outline-none resize-none font-sans text-sm leading-relaxed text-text-primary notebook-ruled-lines"
                />
              </div>

              {/* Editor Save action locked line */}
              <div className="flex items-center justify-end pt-4 mt-2 border-t border-border-color/40">
                <Button
                  onClick={handleSaveWorkspaceNote}
                  disabled={!draftContent.trim()}
                  size="sm"
                  className="flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{selectedNoteId ? 'Save Note' : 'Capture'}</span>
                </Button>
              </div>
            </div>

            {/* Ruled index notes list */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between pb-2 border-b border-dashed border-border-color/60">
                <input
                  type="text"
                  placeholder="Filter captures..."
                  value={notesSearch}
                  onChange={(e) => handleNotesSearchChange(e.target.value)}
                  className="w-full sm:w-60 h-8 bg-transparent text-xs border border-border-color rounded-xl px-2.5 outline-none focus:border-accent"
                />
                
                <div className="flex bg-bg-app/60 border border-border-color p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => handleNotesFilterChange('all')}
                    className={`px-2.5 py-0.5 rounded-md font-semibold ${notesFilter === 'all' ? 'bg-card-bg text-accent shadow-xs' : 'text-text-secondary'}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => handleNotesFilterChange('starred')}
                    className={`px-2.5 py-0.5 rounded-md font-semibold ${notesFilter === 'starred' ? 'bg-card-bg text-accent shadow-xs' : 'text-text-secondary'}`}
                  >
                    Starred
                  </button>
                </div>
              </div>

              <div className="space-y-0">
                {filteredNotes.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-secondary italic">
                    No captures saved under this criteria.
                  </div>
                ) : (
                  filteredNotes.map(note => {
                    const isSelected = selectedNoteId === note.id;
                    const dateStr = new Date(note.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric'
                    });
                    const firstLine = note.content.split('\n')[0].substring(0, 50) || 'Untitled note';

                    return (
                      <div 
                        key={note.id}
                        onClick={() => handleSelectNote(note.id)}
                        className={`flex items-center justify-between py-3 border-b border-border-color/60 last:border-b-0 px-2 cursor-pointer transition-all hover:bg-accent-light/10 ${
                          isSelected ? 'bg-accent-light/25 border-l-4 border-accent pl-3' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="text-sm font-semibold text-text-primary truncate leading-snug">
                            {firstLine}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-text-secondary">
                            <span>{dateStr}</span>
                            <span>•</span>
                            <span className="capitalize">{note.type}</span>
                            {note.importance === 1 && (
                              <Star className="w-3 h-3 text-amber-500 fill-current" />
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteNote(note.id); }}
                            className="p-1 text-text-secondary hover:text-rose-500 rounded-lg hover:bg-bg-app transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Center/Right Column (Tasks, Resources, Related Notes, Timeline) */}
        <div className="space-y-8">
          
          {/* Tasks Widget */}
          <TaskDashboard />

          {/* Resources and Synced cloud storage links */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wider text-text-secondary uppercase">
                Resources & Links
              </h3>
              <Button
                onClick={() => setShowResourceForm(!showResourceForm)}
                variant="outline"
                size="sm"
              >
                {showResourceForm ? 'Cancel' : 'Add'}
              </Button>
            </div>

            {showResourceForm && (
              <form onSubmit={handleAddResource} className="p-4 bg-card-bg border border-border-color rounded-2xl shadow-card-shadow space-y-3 animate-fade-in">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1">Title</label>
                    <Input
                      placeholder="e.g. Slide Deck, PDF study book"
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
                            resType === 'file' ? 'https://... or path/to/file.txt' :
                            'https://example.com'
                          }
                          value={resUrl}
                          onChange={(e) => setResUrl(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}
                </div>

                {connectedDriveAccounts && connectedDriveAccounts.length > 0 && (
                  <div className="p-3 bg-bg-app/40 border border-border-color rounded-xl space-y-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-text-primary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={uploadToDrive}
                        disabled={isUploading}
                        onChange={(e) => {
                          setUploadToDrive(e.target.checked);
                          if (e.target.checked) setResType('drive');
                          else setResType('link');
                        }}
                        className="rounded border-border-color text-accent focus:ring-accent"
                      />
                      <span>☁️ Upload/Sync to cloud drive</span>
                    </label>

                    {uploadToDrive && (
                      <div className="grid grid-cols-1 gap-2 pt-2 border-t border-border-color/60 animate-fade-in text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase mb-1 text-[9px]">Select Synced Account</label>
                          <select
                            value={selectedDriveEmail}
                            disabled={isUploading}
                            onChange={(e) => setSelectedDriveEmail(e.target.value)}
                            className="w-full text-xs h-8 bg-card-bg border border-border-color rounded-lg px-2 focus:border-accent outline-none"
                          >
                            {connectedDriveAccounts.map(acc => (
                              <option key={acc.email} value={acc.email}>
                                {acc.email}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border-color/60">
                  <div className="flex items-center gap-1">
                    {(!uploadToDrive ? (['link', 'drive', 'pdf', 'file'] as const) : (['drive'] as const)).map(type => (
                      <Button
                        key={type}
                        type="button"
                        variant={resType === type ? 'secondary' : 'ghost'}
                        size="sm"
                        disabled={isUploading}
                        onClick={() => setResType(type)}
                        className="h-6 px-2 text-[10px]"
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
                    {isUploading ? 'Uploading...' : 'Save'}
                  </Button>
                </div>
              </form>
            )}

            <PinnedResources workspaceId={id} showAll={true} />
          </div>

          {/* Related Notes widget */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-text-secondary uppercase">
              <Tag className="w-4 h-4 text-accent" />
              <span>Related notes</span>
            </div>

            {relatedNotes.length === 0 ? (
              <div className="text-xs text-text-secondary italic py-2">
                No related notes from other workspace modules detected.
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[11px] text-text-secondary leading-normal">
                  Fuzzy links to matching workspace subjects:
                </p>
                <div className="space-y-2">
                  {relatedNotes.map(note => {
                    const firstLine = note.content.split('\n')[0].substring(0, 50) || 'Untitled note';
                    return (
                      <button
                        key={note.id}
                        onClick={() => setShowRelatedNoteModal(note)}
                        className="w-full text-left p-3 border border-border-color bg-card-bg/20 rounded-xl hover:bg-accent-light/10 hover:border-accent/30 transition-all flex items-start gap-2.5"
                      >
                        <FileText className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text-primary truncate">{firstLine}</p>
                          <p className="text-[9px] font-semibold text-text-secondary mt-0.5 uppercase tracking-wider">
                            Cross-linked module
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Workspace Timeline Widget */}
          <RecentActivity />

        </div>

      </div>

      {/* Related Note Viewer Modal */}
      <AnimatePresence>
        {showRelatedNoteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-[3px]">
            <motion.div 
              className="w-full max-w-xl bg-card-bg border border-border-color rounded-[28px] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
                <div className="flex items-center gap-2 text-text-secondary font-bold text-sm tracking-wide uppercase">
                  <BookOpen className="w-5 h-5 text-accent" />
                  <span>Cross-Reference note</span>
                </div>
                <button
                  onClick={() => setShowRelatedNoteModal(null)}
                  className="p-1.5 border border-border-color text-text-secondary hover:text-text-primary rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap font-sans notebook-ruled-lines min-h-[150px]">
                  {showRelatedNoteModal.content}
                </div>
              </div>

              <div className="px-6 py-4 bg-bg-app/50 border-t border-border-color flex justify-end">
                <Button 
                  onClick={() => setShowRelatedNoteModal(null)}
                  size="sm"
                >
                  Close Reference
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
