import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const SOCKET_URL = 'http://localhost:3001';

/**
 * Proveedor de Socket.IO para toda la aplicación.
 * Expone: socket, connected, syncStatus
 */
export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | ok | error

  useEffect(() => {
    const socket = io(SOCKET_URL, {
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

    socket.on('sync:started', () => setSyncStatus('syncing'));
    socket.on('sync:finished', () => setSyncStatus('ok'));
    socket.on('sync:error', () => setSyncStatus('error'));

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, syncStatus }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
