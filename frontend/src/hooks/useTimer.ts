import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';

interface TimerState {
  elapsed: number;
  remaining: number;
  isActive: boolean;
  lastUpdate?: number;
}

export function useTimer(
  sessionId: string | null, 
  startTime?: Date, 
  endTime?: Date,
  isPaused?: boolean,
  currentPauseStart?: Date,
  totalPausedDuration?: number
) {
  const [timer, setTimer] = useState<TimerState>({
    elapsed: 0,
    remaining: 0,
    isActive: false,
  });

  const { on, joinRoom, isConnected } = useWebSocket({ namespace: 'customer' });

  // Join session room when sessionId is available
  useEffect(() => {
    if (sessionId && isConnected) {
      joinRoom(`session:${sessionId}`);
    }
  }, [sessionId, isConnected, joinRoom]);

  // Listen for timer updates from server
  useEffect(() => {
    if (!sessionId) return;

    const cleanup = on('timer_update', (data: { session_id: string; elapsed_seconds: number; remaining_seconds: number; new_end_time?: string }) => {
      if (data.session_id === sessionId) {
        setTimer({
          elapsed: data.elapsed_seconds,
          remaining: data.remaining_seconds,
          isActive: true,
          lastUpdate: Date.now(),
        });
      }
    });

    return cleanup;
  }, [sessionId, on]);

  // Fallback: Calculate timer locally if WebSocket is not connected or no updates received
  useEffect(() => {
    if (!startTime || !endTime) return;

    // Always run local timer as fallback, WebSocket updates will override it
    const interval = setInterval(() => {
      const now = Date.now();
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      
      // If paused, calculate elapsed time until pause started
      let elapsed: number;
      if (isPaused && currentPauseStart) {
        const pauseStart = new Date(currentPauseStart).getTime();
        elapsed = Math.floor((pauseStart - start) / 1000);
      } else {
        // Calculate elapsed minus total paused duration
        const totalElapsed = Math.floor((now - start) / 1000);
        const pausedSeconds = (totalPausedDuration || 0) * 60;
        elapsed = Math.max(0, totalElapsed - pausedSeconds);
      }
      
      setTimer(prev => {
        // Calculate remaining time
        let remaining: number;
        if (isPaused) {
          // When paused, remaining time stays the same (timer is frozen)
          remaining = prev.remaining || Math.max(0, Math.floor((end - now) / 1000));
        } else {
          remaining = Math.max(0, Math.floor((end - now) / 1000));
        }

        // If WebSocket provided data recently (within last 12 seconds), use it as base
        // Otherwise use local calculation
        const timeSinceLastUpdate = now - (prev.lastUpdate || 0);
        if (isConnected && prev.lastUpdate && timeSinceLastUpdate < 12000 && !isPaused) {
          // Use WebSocket data but decrement remaining time locally for smooth countdown (only if not paused)
          const localRemaining = Math.max(0, prev.remaining - 1);
          return {
            elapsed: prev.elapsed + 1,
            remaining: localRemaining,
            isActive: localRemaining > 0 && !isPaused,
            lastUpdate: prev.lastUpdate, // Keep original WebSocket timestamp
          };
        }
        
        // Use local calculation (fallback when WebSocket not connected or stale, or when paused)
        return {
          elapsed,
          remaining,
          isActive: !isPaused && now >= start && now < end,
          lastUpdate: isPaused ? prev.lastUpdate : now, // Don't update timestamp when paused
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, endTime, isConnected, isPaused, currentPauseStart, totalPausedDuration]);

  // Listen for session events
  useEffect(() => {
    if (!sessionId) return;

    const cleanup1 = on('session_started', (data: { session_id: string }) => {
      if (data.session_id === sessionId) {
        setTimer(prev => ({ ...prev, isActive: true }));
      }
    });

    const cleanup2 = on('session_ended', (data: { session_id: string }) => {
      if (data.session_id === sessionId) {
        setTimer(prev => ({ ...prev, isActive: false }));
      }
    });

    const cleanup4 = on('session_paused', (data: { session_id: string }) => {
      if (data.session_id === sessionId) {
        setTimer(prev => ({ ...prev, isActive: false })); // Timer stops when paused
      }
    });

    const cleanup5 = on('session_resumed', (data: { session_id: string }) => {
      if (data.session_id === sessionId) {
        setTimer(prev => ({ ...prev, isActive: true })); // Timer resumes
      }
    });

    const cleanup3 = on('session_ending_soon', (data: { session_id: string; remaining_seconds: number }) => {
      if (data.session_id === sessionId) {
        // Could trigger a notification here
        console.log('Session ending soon:', data.remaining_seconds);
      }
    });

    return () => {
      cleanup1();
      cleanup2();
      cleanup3();
      cleanup4();
      cleanup5();
    };
  }, [sessionId, on]);

  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    ...timer,
    formatTime,
  };
}

