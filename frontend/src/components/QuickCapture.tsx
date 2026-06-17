import React, { useState, useRef } from 'react';
import { useBaseStore } from '../store/useBaseStore';
import { Image, Link as LinkIcon, Save, X, Lightbulb } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { motion, AnimatePresence } from 'framer-motion';

export const QuickCapture: React.FC = () => {
  const { activeWorkspaceId, createCapture, showCompanionMessage } = useBaseStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageAttached, setImageAttached] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleCancel = () => {
    setContent('');
    setUrl('');
    setShowUrlInput(false);
    setImageAttached(null);
    setIsExpanded(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !url && !imageAttached) return;

    let type: 'note' | 'link' | 'image' | 'idea' = 'idea';
    if (url) {
      type = 'link';
    } else if (imageAttached) {
      type = 'image';
    } else if (content.length > 80) {
      type = 'note';
    }

    try {
      await createCapture({
        workspaceId: activeWorkspaceId,
        type,
        content: content.trim(),
        url: url.trim() || undefined,
        mediaPath: imageAttached || undefined
      });
      handleCancel();
    } catch (err) {
      console.error(err);
      showCompanionMessage('Failed to save idea.', 'warning');
    }
  };

  const handleAttachMockImage = () => {
    const mockImages = [
      'https://images.unsplash.com/photo-1516979187457-637abb4f9353?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=600&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=600&auto=format&fit=crop'
    ];
    const randomImg = mockImages[Math.floor(Math.random() * mockImages.length)];
    setImageAttached(randomImg);
    showCompanionMessage('Reference image attached.', 'info');
  };

  return (
    <motion.div 
      className="surface-paper relative overflow-hidden rounded-[1.9rem] border border-border-color"
      layout
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <form onSubmit={handleSave} className="p-5 md:p-6">
        {/* Header */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              className="flex items-center justify-between mb-4 text-xs text-text-secondary font-medium"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <span className="flex items-center gap-1.5 text-accent">
                <Lightbulb className="w-3.5 h-3.5" />
                💡 NEW IDEA {activeWorkspaceId ? '• IN WORKSPACE' : ''}
              </span>
              <Button 
                type="button" 
                variant="ghost" 
                size="icon"
                onClick={handleCancel}
                className="h-6 w-6"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text Area using shadcn/ui */}
        <Textarea
          ref={textareaRef as any}
          placeholder={isExpanded ? "What's on your mind?" : "💡 Had an idea? Quick capture here..."}
          rows={isExpanded ? 8 : 3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={handleFocus}
          className={`w-full border-none shadow-none bg-transparent p-0 text-base md:text-[15px] leading-7 focus-visible:ring-0 ${isExpanded ? 'min-h-[220px]' : 'min-h-[96px]'}`}
        />

        {/* Link Input */}
        <AnimatePresence>
          {isExpanded && showUrlInput && (
            <motion.div 
              className="mt-4 py-3 border-t border-dashed border-border-color"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <Input
                type="url"
                placeholder="Paste link address here (https://...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-bg-app"
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Attachment */}
        <AnimatePresence>
          {isExpanded && imageAttached && (
            <motion.div 
              className="relative mt-4 rounded-xl overflow-hidden border border-border-color max-h-36 bg-bg-app"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <img 
                src={imageAttached} 
                alt="Attached capture" 
                className="w-full h-full object-cover" 
              />
              <button
                type="button"
                onClick={() => setImageAttached(null)}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions Footer */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              className="flex items-center justify-between mt-4 pt-4 border-t border-border-color"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant={imageAttached ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleAttachMockImage}
                >
                  <Image className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Image</span>
                </Button>
                <Button
                  type="button"
                  variant={url ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Link</span>
                </Button>
              </div>

              <Button
                type="submit"
                disabled={!content.trim() && !url && !imageAttached}
                size="sm"
                className="flex items-center gap-1.5 shadow-sm shadow-accent/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </motion.div>
  );
};
