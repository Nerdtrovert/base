import React, { useState, useRef } from 'react';
import { useBaseStore } from '../store/useBaseStore';
import { Image, Link as LinkIcon, X } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { motion, AnimatePresence } from 'framer-motion';

export const QuickCapture: React.FC = () => {
  const { activeWorkspaceId, createCapture, showCompanionMessage } = useBaseStore();
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [imageAttached, setImageAttached] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCancel = () => {
    setContent('');
    setUrl('');
    setShowUrlInput(false);
    setImageAttached(null);
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
    <div className="pb-6 border-b border-border-color">
      <form onSubmit={handleSave} className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <h3 className="text-lg font-semibold text-text-primary">
              What's on your mind?
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed font-normal">
              Capture now. Organize later.
            </p>
          </div>
          {(content || url || imageAttached) ? (
            <Button 
              type="button" 
              variant="ghost" 
              size="icon"
              onClick={handleCancel}
              className="h-6 w-6 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              title="Clear content"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          ) : null}
        </div>

        {/* Text Area with notebook ruled lines and liquid glass container containing actions locked on the last line */}
        <div className="relative rounded-[28px] border border-border-color bg-card-bg/30 dark:bg-card-bg/10 backdrop-blur-md p-5 shadow-xs flex flex-col justify-between min-h-[220px]">
          <div className="flex-grow">
            <Textarea
              ref={textareaRef as any}
              placeholder="Jot down a quick thought, study note, or link reference..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full border-none shadow-none bg-transparent p-0 text-[15px] focus-visible:ring-0 min-h-[128px] notebook-ruled-lines placeholder:text-text-muted/70 font-sans"
            />
          </div>

          {/* Locked Last Line - Actions inside the text box */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-border-color/40">
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={handleAttachMockImage}
                className={`cursor-pointer transition-colors p-1 rounded-lg ${
                  imageAttached ? 'text-accent' : 'text-text-secondary hover:text-accent'
                }`}
                title="Add Image"
              >
                <Image className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className={`cursor-pointer transition-colors p-1 rounded-lg ${
                  url ? 'text-accent' : 'text-text-secondary hover:text-accent'
                }`}
                title="Add Link"
              >
                <LinkIcon className="w-5 h-5" />
              </button>
            </div>

            <Button
              type="submit"
              disabled={!content.trim() && !url && !imageAttached}
              size="sm"
              className="flex items-center gap-1.5 shadow-sm shadow-accent/20 cursor-pointer h-8 px-4 rounded-xl font-semibold text-xs"
            >
              <span>Save</span>
            </Button>
          </div>
        </div>

        {/* Link Input */}
        <AnimatePresence>
          {showUrlInput && (
            <motion.div 
              className="py-1"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Input
                type="url"
                placeholder="Paste link address here (https://...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="bg-bg-app border-border-color text-xs h-9 rounded-xl"
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Attachment */}
        <AnimatePresence>
          {imageAttached && (
            <motion.div 
              className="relative rounded-[28px] overflow-hidden border border-border-color max-h-36 bg-bg-app"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <img 
                src={imageAttached} 
                alt="Attached capture" 
                className="w-full h-full object-cover" 
              />
              <button
                type="button"
                onClick={() => setImageAttached(null)}
                className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
};
