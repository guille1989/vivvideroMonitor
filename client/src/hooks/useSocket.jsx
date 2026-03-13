import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  || (import.meta.env.DEV
    ? 'http://localhost:3002'
    : window.location.origin);

/**
 * Proveedor de Socket.IO para toda la aplicación.
 * Expone: socket, connected, syncStatus
 */
export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | ok | error
  const [lastSyncStartedAt, setLastSyncStartedAt] = useState(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('🔌 Socket conectado:', socket.id);
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('🔌 Socket desconectado');
    });

    socket.on('sync:started', ({ startedAt } = {}) => {
      setSyncStatus('syncing');
      setLastSyncStartedAt(startedAt || new Date().toISOString());
    });
    socket.on('sync:finished', () => setSyncStatus('ok'));
    socket.on('sync:error', () => setSyncStatus('error'));

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, syncStatus, lastSyncStartedAt }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
