import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const IDLE_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

export const useAutoIdle = (
  userId: string | undefined,
  currentStatus: 'online' | 'idle' | 'dnd' | 'offline',
  onStatusChange: (status: 'online' | 'idle' | 'dnd' | 'offline') => void
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wasIdleRef = useRef(false);
  const manualStatusRef = useRef<'online' | 'idle' | 'dnd' | 'offline' | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (!userId) return;
    
    // Don't auto-change if user manually set to DND or offline
    if (manualStatusRef.current === 'dnd' || manualStatusRef.current === 'offline') {
      return;
    }

    // If user was idle and came back, set them online
    if (wasIdleRef.current && currentStatus === 'idle') {
      wasIdleRef.current = false;
      supabase
        .from('profiles')
        .update({ status: 'online', last_seen: new Date().toISOString() })
        .eq('id', userId)
        .then(() => {
          onStatusChange('online');
        });
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new idle timeout
    timeoutRef.current = setTimeout(() => {
      // Only go idle if currently online
      if (currentStatus === 'online') {
        wasIdleRef.current = true;
        supabase
          .from('profiles')
          .update({ status: 'idle', last_seen: new Date().toISOString() })
          .eq('id', userId)
          .then(() => {
            onStatusChange('idle');
          });
      }
    }, IDLE_TIMEOUT);
  }, [userId, currentStatus, onStatusChange]);

  // Track manual status changes
  const setManualStatus = useCallback((status: 'online' | 'idle' | 'dnd' | 'offline') => {
    manualStatusRef.current = status;
    // Reset idle tracking when manually changing status
    wasIdleRef.current = false;
    
    // If setting to online, restart the idle timer
    if (status === 'online') {
      manualStatusRef.current = null;
      resetIdleTimer();
    }
  }, [resetIdleTimer]);

  useEffect(() => {
    if (!userId) return;

    // Events that indicate user activity
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];

    // Throttle to avoid too many updates
    let lastActivity = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivity > 1000) { // Throttle to once per second
        lastActivity = now;
        resetIdleTimer();
      }
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer
    resetIdleTimer();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [userId, resetIdleTimer]);

  return { setManualStatus };
};
