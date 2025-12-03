// hooks/useBeforeUnload.ts - Handle cleanup before user leaves
import { useEffect, useCallback } from 'react';

interface UseBeforeUnloadOptions {
  onBeforeUnload: () => Promise<void> | void;
  enabled?: boolean;
}

export function useBeforeUnload({ onBeforeUnload, enabled = true }: UseBeforeUnloadOptions) {
  const handleBeforeUnload = useCallback(
    (e: BeforeUnloadEvent) => {
      if (!enabled) return;

      // Show confirmation dialog
      e.preventDefault();
      e.returnValue = '';

      // Perform cleanup (note: async operations may not complete)
      onBeforeUnload();
    },
    [onBeforeUnload, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBeforeUnload, enabled]);
}
