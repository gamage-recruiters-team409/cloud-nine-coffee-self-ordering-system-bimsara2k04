'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { resolveApiUrl } from '@/lib/api';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Resolved inside the effect, not at module load, so the socket targets
    // the host the page was served from rather than a build-time constant.
    const socketInstance = io(resolveApiUrl(), {
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return { socket, isConnected };
}