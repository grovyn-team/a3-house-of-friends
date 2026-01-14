import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useToast } from './use-toast';

const getBaseUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace('/api', '');
  }
  return 'http://localhost:3001';
};

const WS_URL = getBaseUrl();

interface UseWebSocketOptions {
  namespace?: 'customer' | 'admin' | 'staff';
  authToken?: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { namespace = 'customer', authToken, onConnect, onDisconnect, onError } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const socketInstance = io(`${WS_URL}/${namespace}`, {
      auth: authToken ? { authToken } : {},
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      // Reduce error logging
      autoConnect: true,
    });

    socketInstance.on('connect', () => {
      console.log(`✅ WebSocket connected to ${namespace}`);
      setIsConnected(true);
      setSocket(socketInstance);
      onConnect?.();
    });

    socketInstance.on('disconnect', () => {
      console.log(`⚠️ WebSocket disconnected from ${namespace}`);
      setIsConnected(false);
      onDisconnect?.();
    });

    socketInstance.on('connect_error', (error) => {
      // Only log errors, don't show toast for auth errors (expected when not logged in)
      if (error.message === 'Unauthorized' || error.message === 'Invalid token') {
        // Silently handle auth errors - they're expected when not logged in
        return;
      }
      
      // Only log connection errors once, not repeatedly
      if (!socketInstance.recovered) {
        console.warn(`⚠️ WebSocket connection error for ${namespace}:`, error.message);
        // Only show toast for unexpected errors in customer namespace
        if (namespace === 'customer') {
          toast({
            title: 'WebSocket Connection Error',
            description: error.message || 'Could not connect to real-time server.',
            variant: 'destructive',
          });
        }
      }
      onError?.(error);
    });

    socketRef.current = socketInstance;

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [namespace, authToken, onConnect, onDisconnect, onError]);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }, []);

  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  const off = useCallback((event: string, callback?: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  const joinRoom = useCallback((room: string) => {
    if (namespace === 'customer') {
      if (room.startsWith('activity:')) {
        emit('join_activity', { activity_id: room.replace('activity:', '') });
      } else if (room.startsWith('session:')) {
        emit('join_session', { session_id: room.replace('session:', '') });
      } else if (room.startsWith('order:')) {
        emit('join_order', { order_id: room.replace('order:', '') });
      } else if (room.startsWith('reservation:')) {
        emit('join_reservation', { reservation_id: room.replace('reservation:', '') });
      }
    }
  }, [namespace, emit]);

  return {
    socket,
    isConnected,
    emit,
    on,
    off,
    joinRoom,
  };
}

