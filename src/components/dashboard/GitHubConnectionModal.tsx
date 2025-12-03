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
import { Github, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface GitHubConnectionModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GitHubConnectionModal({
  projectId,
  isOpen,
  onClose,
  onSuccess,
}: GitHubConnectionModalProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('Auto-commit from QuantumIDE');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!repoUrl) {
      setError('Repository URL is required');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/projects/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          repoUrl,
          message,
          token: token || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to connect to GitHub');
      }

      const data = await res.json();
      setSuccess(data.message || 'Successfully connected to GitHub!');
      
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            Connect to GitHub
          </DialogTitle>
          <DialogDescription>
            Push your project to a GitHub repository for persistence and collaboration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="repoUrl">Repository URL *</Label>
            <Input
              id="repoUrl"
              placeholder="https://github.com/username/repo.git"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Create a new empty repository on GitHub first
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">
              GitHub Personal Access Token (Optional)
            </Label>
            <Input
              id="token"
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Required for private repositories. Get one from{' '}
              <a
                href="https://github.com/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                GitHub Settings
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Commit Message</Label>
            <Input
              id="message"
              placeholder="Initial commit"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-500 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect & Push
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
