import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

let globalSocket: Socket | null = null;

export function useSocket() {
  const { token, company } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
      }
      socketRef.current = null;
      return;
    }

    if (!globalSocket) {
      const wsUrl = import.meta.env.VITE_WS_URL
        || (import.meta.env.VITE_API_URL
          ? String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '')
          : window.location.origin);

      globalSocket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
      });
    }

    socketRef.current = globalSocket;

    if (company?._id) {
      globalSocket.emit('join:company', company._id);
    }

    return () => {
      // Don't disconnect — shared socket
    };
  }, [token, company?._id]);

  return socketRef.current;
}
