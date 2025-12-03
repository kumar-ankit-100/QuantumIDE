'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Loader2, AlertCircle, Github } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LoadProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadComplete?: () => void;
}

export default function LoadProjectModal({
  isOpen,
  onClose,
  onLoadComplete,
}: LoadProjectModalProps) {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState('');
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async () => {
    if (!repoUrl) {
      setError('Repository URL is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/projects/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoUrl,
          name: name || undefined,
          token: token || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load project');
      }

      const data = await res.json();
      
      // Call onLoadComplete if provided
      if (onLoadComplete) {
        onLoadComplete();
      }
      
      // Navigate to the editor
      router.push(`/code-editor/${data.projectId}`);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Load Project from GitHub
          </DialogTitle>
          <DialogDescription>
            Clone an existing GitHub repository to continue working on it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="loadRepoUrl">Repository URL *</Label>
            <Input
              id="loadRepoUrl"
              placeholder="https://github.com/username/repo.git"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="loadName">Project Name (Optional)</Label>
            <Input
              id="loadName"
              placeholder="My Awesome Project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="loadToken">
              GitHub Token (Optional)
            </Label>
            <Input
              id="loadToken"
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Only needed for private repositories
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleLoad} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Github className="mr-2 h-4 w-4" />
                Load Project
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
