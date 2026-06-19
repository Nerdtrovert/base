import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Capture } from '../services/db';
import { useBaseStore } from '../store/useBaseStore';
import { BookOpen, Star, Check, Edit3, X } from 'lucide-react';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export const RevisionEngine: React.FC = () => {
  const { visitCapture, toggleCaptureImportance, updateCaptureContent } = useBaseStore();
  const [reviewingItem, setReviewingItem] = useState<Capture | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');

  // 1. Fetch captures and calculate priority scores
  const reviewQueue = useLiveQuery(async () => {
    const captures = await db.captures.toArray();
    const workspaces = await db.workspaces.toArray();

    // Create a workspace map for last opened references
    const workspaceMap = new Map(workspaces.map(w => [w.id, w]));

    const scored = captures
      .filter(c => c.type === 'note' || c.type === 'idea')
      .map(c => {
        const now = Date.now();
        const createdAt = c.createdAt;
        const lastOpenedAt = c.lastOpenedAt || c.createdAt;
        const visitCount = c.visitCount || 1;
        const importance = c.importance || 0;

        const daysSinceLastOpened = (now - lastOpenedAt) / (1000 * 60 * 60 * 24);
        const daysSinceCreated = (now - createdAt) / (1000 * 60 * 60 * 24);

        // Score formula: prioritize decay, manual stars, and older creations, offset by frequent visits
        let score = (daysSinceLastOpened * 1.8) + (importance * 12) + (daysSinceCreated * 0.15) - (visitCount * 0.4);

        // Boost score if the workspace it belongs to is active/recently opened (meaning it is highly relevant now!)
        if (c.workspaceId) {
          const ws = workspaceMap.get(c.workspaceId);
          if (ws) {
            const wsDaysSinceOpen = (now - ws.lastOpenedAt) / (1000 * 60 * 60 * 24);
            if (wsDaysSinceOpen < 3) {
              score += 5; // Workspace active in last 3 days gets a relevance bump
            }
          }
        }

        return {
          capture: c,
          score,
          daysSinceLastOpened: Math.floor(daysSinceLastOpened)
        };
      });

    // Sort descending by score, only surface items opened > 1 day ago (or never reviewed)
    // Show top 3
    return scored
      .filter(item => item.daysSinceLastOpened >= 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }) || [];

  const handleStartReview = async (item: Capture) => {
    setReviewingItem(item);
    setEditContent(item.content);
    setEditMode(false);
    // Mark as visited to update lastOpenedAt right away
    await visitCapture(item.id);
  };

  const handleSaveEdit = async () => {
    if (!reviewingItem) return;
    await updateCaptureContent(reviewingItem.id, editContent);
    setReviewingItem({ ...reviewingItem, content: editContent });
    setEditMode(false);
  };

  const handleDoneReviewing = () => {
    setReviewingItem(null);
  };

  return (
    <div className="pb-6 border-b border-border-color">
      {/* Quiet Header */}
      <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-text-secondary uppercase mb-4">
        <BookOpen className="w-4 h-4 text-accent" />
        <span>Quiet Revision</span>
      </div>

      {reviewQueue.length === 0 ? (
        <div className="text-xs text-text-secondary italic py-2">
          Your learning sessions are fully active. Forgotten items will quietly appear here later.
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            Surface checks. Gently reminding you of fading notes:
          </p>

          <div className="space-y-3">
            {reviewQueue.map(({ capture, daysSinceLastOpened }) => {
              const displayTitle = capture.content.split('\n')[0].substring(0, 60) || 'Untitled Note';
              return (
                <div 
                  key={capture.id}
                  className="flex items-center justify-between py-2.5 border-b border-dashed border-border-color/50 last:border-b-0 hover:bg-accent-light/10 px-2 rounded-xl transition-all"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {displayTitle}
                    </p>
                    <p className="text-[10px] text-text-secondary mt-0.5">
                      You haven't opened this in {daysSinceLastOpened} {daysSinceLastOpened === 1 ? 'day' : 'days'}
                    </p>
                  </div>

                  <button
                    onClick={() => handleStartReview(capture)}
                    className="text-xs font-bold text-accent hover:text-accent/80 border border-accent/20 bg-accent-light/30 px-3 py-1 rounded-lg flex-shrink-0 transition-colors"
                  >
                    Review? (2 min)
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review Dialog */}
      <AnimatePresence>
        {reviewingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-[3px]">
            <motion.div 
              className="w-full max-w-xl bg-card-bg border border-border-color rounded-[28px] overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
            >
              {/* Review Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-accent" />
                  <span className="font-bold text-sm tracking-wide uppercase text-text-secondary">Revision Recall</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleCaptureImportance(reviewingItem.id)}
                    className={`p-1.5 rounded-lg border transition-all ${
                      reviewingItem.importance === 1 
                        ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' 
                        : 'text-text-secondary border-border-color hover:text-text-primary'
                    }`}
                    title="Toggle Importance"
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                  <button
                    onClick={handleDoneReviewing}
                    className="p-1.5 border border-border-color text-text-secondary hover:text-text-primary rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Review Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {editMode ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-48 bg-transparent border-none outline-none resize-none font-sans text-sm leading-relaxed text-text-primary notebook-ruled-lines"
                    autoFocus
                  />
                ) : (
                  <div className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap font-sans min-h-[120px] notebook-ruled-lines">
                    {reviewingItem.content}
                  </div>
                )}
              </div>

              {/* Review Footer */}
              <div className="px-6 py-4 bg-bg-app/50 border-t border-border-color flex items-center justify-between">
                {editMode ? (
                  <>
                    <Button 
                      variant="outline" 
                      onClick={() => setEditMode(false)}
                      size="sm"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveEdit}
                      size="sm"
                    >
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditMode(true)}
                      className="text-xs font-semibold text-text-secondary hover:text-accent flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Refine notes
                    </button>
                    <Button 
                      onClick={handleDoneReviewing}
                      className="flex items-center gap-1.5"
                      size="sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>Reviewed</span>
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
