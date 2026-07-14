'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

export function useSocket(eventId?: string) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!eventId) return;
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-event', eventId);
    });

    return () => {
      if (socket.connected) {
        socket.emit('leave-event', eventId);
        socket.disconnect();
      }
    };
  }, [eventId]);

  const onSeatEvent = useCallback((event: string, handler: (data: any) => void) => {
    socketRef.current?.on(event, handler);
    return () => { socketRef.current?.off(event, handler); };
  }, []);

  return { socket: socketRef.current, onSeatEvent };
}
