'use client';

import { Github, CheckCircle2, AlertCircle, Loader2, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface GitHubStatusProps {
  projectId: string;
  onManualSave?: () => void;
  isSaving?: boolean;
  lastSaved?: Date | null;
  saveStatus?: 'idle' | 'saving' | 'success' | 'error';
}

export function GitHubStatus({ 
  projectId, 
  onManualSave, 
  isSaving = false,
  lastSaved = null,
  saveStatus = 'idle'
}: GitHubStatusProps) {
  const [githubRepo, setGithubRepo] = useState<string>('');
  const [repoName, setRepoName] = useState<string>('');

  useEffect(() => {
    loadMetadata();
  }, [projectId]);

  const loadMetadata = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/metadata`);
      const data = await res.json();
      console.log('GitHubStatus - metadata loaded:', data);
      if (data.githubRepo) {
        setGithubRepo(data.githubRepo);
        // Extract repo name from URL
        const match = data.githubRepo.match(/github\.com[/:](.+?)(?:\.git)?$/);
        if (match) {
          setRepoName(match[1]);
        }
      }
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  const getLastSavedText = () => {
    if (!lastSaved) return 'Never';
    const seconds = Math.floor((Date.now() - lastSaved.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  if (!githubRepo) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
        <AlertCircle className="h-4 w-4 text-yellow-500" />
        <span className="text-xs text-yellow-500">No GitHub repo connected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <a
        href={githubRepo.replace('.git', '')}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors group"
      >
        <Github className="h-4 w-4 text-slate-400 group-hover:text-white" />
        <span className="text-xs text-slate-400 group-hover:text-white">
          {repoName}
        </span>
        <GitBranch className="h-3 w-3 text-slate-500" />
        <span className="text-xs text-slate-500">main</span>
      </a>

      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md">
        {saveStatus === 'saving' && (
          <>
            <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />
            <span className="text-xs text-slate-400">Saving...</span>
          </>
        )}
        {saveStatus === 'success' && (
          <>
            <CheckCircle2 className="h-3 w-3 text-green-400" />
            <span className="text-xs text-slate-400">Saved {getLastSavedText()}</span>
          </>
        )}
        {saveStatus === 'error' && (
          <>
            <AlertCircle className="h-3 w-3 text-red-400" />
            <span className="text-xs text-red-400">Save failed</span>
          </>
        )}
        {saveStatus === 'idle' && lastSaved && (
          <>
            <CheckCircle2 className="h-3 w-3 text-slate-500" />
            <span className="text-xs text-slate-500">Saved {getLastSavedText()}</span>
          </>
        )}
      </div>

      <Button
        size="sm"
        variant="outline"
        onClick={onManualSave}
        disabled={isSaving}
        className="h-8 px-3"
      >
        {isSaving ? (
          <>
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            Saving
          </>
        ) : (
          <>
            <Github className="h-3 w-3 mr-1.5" />
            Save to GitHub
          </>
        )}
      </Button>
    </div>
  );
}
