import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart3, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useToast } from './ui/Toaster';
import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { triggerSync } from '../services/api';

export default function Layout({ children, placeId }) {
  const { connected, syncStatus, socket } = useSocket();
  const { addToast } = useToast();
  const queryClient = useQueryClient();

  // Escuchar eventos de Socket.IO y lanzar toasts
  useEffect(() => {
    if (!socket) return;

    const handleNewReview = ({ review, businessName }) => {
      addToast({
        title: `⭐ Nueva reseña — ${review.rating}★`,
        description: `${review.authorName}: "${(review.text || '').substring(0, 60)}${review.text?.length > 60 ? '…' : ''}"`,
        variant: 'default',
      });
      // Invalidar queries para refrescar datos
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    };

    const handleNegativeReview = ({ review }) => {
      addToast({
        title: `🚨 Reseña negativa — ${review.rating}★`,
        description: `${review.authorName}: "${(review.text || '').substring(0, 60)}…"`,
        variant: 'destructive',
      });
    };

    const handleRemovedReview = ({ review }) => {
      addToast({
        title: '🗑 Reseña removida en Google',
        description: `${review.authorName}: "${(review.text || '').substring(0, 60)}${review.text?.length > 60 ? '…' : ''}"`,
        variant: 'default',
      });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    };

    const handleRatingChanged = ({ previousRating, currentRating }) => {
      const direction = currentRating > previousRating ? '⬆' : '⬇';
      addToast({
        title: `${direction} Rating actualizado`,
        description: `${previousRating} → ${currentRating} estrellas`,
        variant: currentRating > previousRating ? 'success' : 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    };

    socket.on('review:new', handleNewReview);
    socket.on('review:negative', handleNegativeReview);
    socket.on('review:removed', handleRemovedReview);
    socket.on('business:rating_changed', handleRatingChanged);

    return () => {
      socket.off('review:new', handleNewReview);
      socket.off('review:negative', handleNegativeReview);
      socket.off('review:removed', handleRemovedReview);
      socket.off('business:rating_changed', handleRatingChanged);
    };
  }, [socket, addToast, queryClient]);

  const syncMutation = useMutation({
    mutationFn: () => triggerSync(placeId),
    onSuccess: (data) => {
      addToast({
        title: '✅ Sincronización completada',
        description: `${data.newCount} nuevas | ${data.removedCount || 0} removidas | Rating: ${data.currentRating}★`,
        variant: 'success',
      });
      queryClient.invalidateQueries();
    },
    onError: (err) => {
      addToast({
        title: '❌ Error en sincronización',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const syncStatusColors = {
    idle: 'text-gray-400',
    syncing: 'text-brand-100 animate-pulse',
    ok: 'text-green-400',
    error: 'text-red-400',
  };

  const syncStatusLabels = {
    idle: 'En espera',
    syncing: 'Sincronizando…',
    ok: 'Sincronizado',
    error: 'Error',
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#111827' }}>
      {/* Header */}
      <header className="border-b border-[rgba(89,178,176,0.15)] px-6 py-3 flex items-center justify-between sticky top-0 z-30" style={{ background: '#111827' }}>
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-brand-900 text-base"
            style={{ background: 'linear-gradient(135deg, #8cf4ee, #448481)' }}>
            I
          </div>
          <div>
            <div className="font-bold text-brand-50 leading-none text-sm">InnoApp</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Reviews Monitor</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex gap-1">
          {[
            { to: '/', icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
            { to: '/analytics', icon: <BarChart3 size={15} />, label: 'Analítica' },
          ].map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-brand-300/20 text-brand-100 border border-brand-300/30'
                    : 'text-gray-400 hover:text-brand-50 hover:bg-white/5'
                }`
              }
            >
              {icon}{label}
            </NavLink>
          ))}
        </nav>

        {/* Status + sync */}
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-xs">
            {connected
              ? <Wifi size={13} className="text-green-400" />
              : <WifiOff size={13} className="text-red-400" />
            }
            <span className={connected ? 'text-green-400' : 'text-red-400'}>
              {connected ? 'En vivo' : 'Desconectado'}
            </span>
          </div>

          {/* Sync status */}
          <div className={`text-xs ${syncStatusColors[syncStatus]}`}>
            {syncStatusLabels[syncStatus]}
          </div>

          {/* Manual sync button */}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || syncStatus === 'syncing'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
              border-brand-300/30 text-brand-100 bg-brand-300/10 hover:bg-brand-300/20
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw size={12} className={syncMutation.isPending ? 'animate-spin' : ''} />
            Sincronizar
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
