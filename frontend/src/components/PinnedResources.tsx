import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Resource } from '../services/db';
import { useBaseStore } from '../store/useBaseStore';
import { ExternalLink, Pin, Trash2, Globe, FileText, HardDrive } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface PinnedResourcesProps {
  workspaceId?: string | null;
  showAll?: boolean;
}

export const PinnedResources: React.FC<PinnedResourcesProps> = ({ workspaceId = null, showAll = false }) => {
  const { toggleResourcePin, deleteResource } = useBaseStore();

  // Query resources
  const resources = useLiveQuery(async () => {
    let list: Resource[] = [];
    if (showAll) {
      list = workspaceId 
        ? await db.resources.where({ workspaceId }).toArray()
        : await db.resources.toArray();
    } else {
      list = await db.resources.where({ pinned: 1 }).toArray();
    }

    const workspaces = await db.workspaces.toArray();
    const wsMap = new Map<string, string>();
    workspaces.forEach(w => wsMap.set(w.id, w.name));

    return list.map(r => ({
      ...r,
      workspaceName: r.workspaceId ? wsMap.get(r.workspaceId) : 'Unorganized'
    })) as (Resource & { workspaceName: string })[];
  }, [workspaceId, showAll]) || [];

  const getResourcePreview = (res: Resource) => {
    if (res.type === 'image') {
      return res.url || 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=400&auto=format&fit=crop';
    }
    
    const colorThemes: Record<Resource['type'], string> = {
      link: 'from-blue-500/20 to-sky-500/10 text-blue-600 dark:text-blue-400',
      drive: 'from-emerald-500/20 to-teal-500/10 text-emerald-600 dark:text-emerald-400',
      pdf: 'from-rose-500/20 to-orange-500/10 text-rose-600 dark:text-rose-400',
      file: 'from-slate-500/20 to-neutral-500/10 text-slate-600 dark:text-slate-400',
      image: 'from-purple-500/20 to-pink-500/10 text-purple-600 dark:text-purple-400'
    };

    return (
      <div className={`w-full h-full bg-gradient-to-br ${colorThemes[res.type]} flex items-center justify-center`}>
        {res.type === 'link' && <Globe className="w-8 h-8 opacity-80" />}
        {res.type === 'drive' && <HardDrive className="w-8 h-8 opacity-80" />}
        {res.type === 'pdf' && <FileText className="w-8 h-8 opacity-80" />}
        {res.type === 'file' && <FileText className="w-8 h-8 opacity-80" />}
      </div>
    );
  };

  const getSourceLabel = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      return url.hostname.replace('www.', '');
    } catch {
      return 'Local Resource';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wider text-text-secondary uppercase">
          {showAll ? 'Resources' : '📌 Pinned Resources'}
        </h3>
      </div>

      {resources.length === 0 ? (
        <Card className="p-8 text-center text-xs text-text-secondary italic">
          {showAll 
            ? 'No resources attached. Drop a link or capture an idea with links.'
            : 'No pinned resources. Click the pin icon on any workspace resource to keep it here.'}
        </Card>
      ) : (
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" layout>
          <AnimatePresence initial={false}>
            {resources.map(res => (
              <motion.div
                key={res.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <Card className="group hover:border-accent/30 hover:-translate-y-0.5 transition-all duration-200 flex flex-col h-full">
                  {/* Preview image or color block */}
                  <div className="h-28 w-full bg-bg-app border-b border-border-color relative overflow-hidden flex-shrink-0">
                    {typeof getResourcePreview(res) === 'string' ? (
                      <img 
                        src={getResourcePreview(res) as string} 
                        alt={res.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      getResourcePreview(res)
                    )}
                    
                    {/* Pin button */}
                    <button
                      onClick={() => toggleResourcePin(res.id)}
                      className={`absolute top-2.5 right-2.5 p-1.5 rounded-lg backdrop-blur-md shadow-sm transition-all ${
                        res.pinned 
                          ? 'bg-accent text-white border border-accent/20' 
                          : 'bg-black/40 text-white/90 hover:bg-black/60 opacity-0 group-hover:opacity-100'
                      }`}
                      title={res.pinned ? "Unpin from home" : "Pin to home"}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Resource info */}
                  <CardContent className="p-4 flex flex-col flex-1 min-w-0 justify-between">
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-text-primary group-hover:text-accent transition-colors truncate mb-1" title={res.title}>
                        {res.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-text-secondary">
                        <span className="truncate bg-bg-app border border-border-color/85 px-1.5 py-0.5 rounded font-medium uppercase">
                          {res.type}
                        </span>
                        <span className="truncate">
                          {getSourceLabel(res.url)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-color/65">
                      <span className="text-[10px] text-text-secondary truncate max-w-[120px]" title={`Workspace: ${res.workspaceName}`}>
                        Workspace: <strong className="font-semibold text-text-primary">{res.workspaceName}</strong>
                      </span>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteResource(res.id)}
                          className="h-7 w-7 text-text-secondary hover:text-rose-500 opacity-0 group-hover:opacity-100"
                          title="Delete resource"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:bg-accent-light px-2.5 py-1.5 rounded-lg border border-accent/10 transition-colors"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
};
