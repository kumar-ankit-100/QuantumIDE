// hooks/useAutoSave.ts - Custom hook for auto-saving to GitHub
import { useEffect, useRef, useCallback } from 'react';

interface UseAutoSaveOptions {
  projectId: string;
  enabled: boolean;
  interval?: number; // milliseconds
  githubToken?: string;
  onSave?: (success: boolean) => void;
}

export function useAutoSave({
  projectId,
  enabled,
  interval = 30000, // 30 seconds default
  githubToken,
  onSave,
}: UseAutoSaveOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  const performAutoSave = useCallback(async () => {
    if (isSavingRef.current) return;

    isSavingRef.current = true;
    try {
      const res = await fetch('/api/projects/autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, githubToken }),
      });

      const data = await res.json();
      const success = res.ok && data.success;
      
      onSave?.(success);
      
      if (!success && data.needsSetup) {
        console.warn('Auto-save skipped: GitHub not configured');
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      onSave?.(false);
    } finally {
      isSavingRef.current = false;
    }
  }, [projectId, githubToken, onSave]);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Perform immediate save on enable
    performAutoSave();

    // Set up interval
    intervalRef.current = setInterval(performAutoSave, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, performAutoSave]);

  return { performAutoSave };
}
