import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutDashboard, BarChart3, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useToast } from './ui/Toaster';
import { fetchHealth, fetchSummary, triggerSync, triggerTrustpilotSync } from '../services/api';

function formatCountdown(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '--:--';

  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function Layout({ children, placeId }) {
  const { connected, syncStatus, socket, lastSyncStartedAt } = useSocket();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 60_000,
  });

  const summaryQuery = useQuery({
    queryKey: ['summary', placeId],
    queryFn: () => fetchSummary(placeId),
    enabled: Boolean(placeId),
    refetchInterval: 30_000,
  });

  // Listen to Socket.IO events and show toasts.
  useEffect(() => {
    if (!socket) return;

    const handleNewReview = ({ review }) => {
      addToast({
        title: `Nueva resena - ${review.rating}*`,
        description: `${review.authorName}: "${(review.text || '').substring(0, 60)}${review.text?.length > 60 ? '...' : ''}"`,
        variant: 'default',
      });

      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['tp-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['tp-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tp-reviews-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tp-summary-dashboard'] });
    };

    const handleNegativeReview = ({ review }) => {
      addToast({
        title: `Resena negativa - ${review.rating}*`,
        description: `${review.authorName}: "${(review.text || '').substring(0, 60)}..."`,
        variant: 'destructive',
      });
    };

    const handleRemovedReview = ({ review }) => {
      addToast({
        title: 'Resena removida',
        description: `${review.authorName}: "${(review.text || '').substring(0, 60)}${review.text?.length > 60 ? '...' : ''}"`,
        variant: 'default',
      });

      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['tp-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['tp-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tp-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['tp-reviews-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tp-summary-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tp-metrics-dashboard'] });
    };

    const handleRatingChanged = ({ previousRating, currentRating }) => {
      const direction = currentRating > previousRating ? 'Sube' : 'Baja';
      addToast({
        title: `${direction} rating`,
        description: `${previousRating} -> ${currentRating} estrellas`,
        variant: currentRating > previousRating ? 'success' : 'destructive',
      });

      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['tp-summary'] });
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
    mutationFn: async () => {
      const [googleResult, trustpilotResult] = await Promise.allSettled([
        triggerSync(placeId),
        triggerTrustpilotSync(),
      ]);

      return { googleResult, trustpilotResult };
    },
    onSuccess: ({ googleResult, trustpilotResult }) => {
      const googleOk = googleResult.status === 'fulfilled';
      const trustpilotOk = trustpilotResult.status === 'fulfilled';

      const parts = [];

      if (googleOk) {
        const g = googleResult.value || {};
        parts.push(`Google: ${Number(g.newCount || 0)} nuevas | ${Number(g.removedCount || 0)} removidas | Rating: ${g.currentRating ?? '-'}*`);
      } else {
        const msg = googleResult.reason?.message || 'sync fallida';
        parts.push(`Google: error (${msg})`);
      }

      if (trustpilotOk) {
        const t = trustpilotResult.value || {};
        parts.push(`Trustpilot: ${Number(t.newCount || 0)} nuevas | ${Number(t.removedCount || 0)} removidas | Rating: ${t.currentRating ?? '-'}*`);
      } else {
        const msg = trustpilotResult.reason?.message || 'sync fallida';
        parts.push(`Trustpilot: error (${msg})`);
      }

      const variant = googleOk && trustpilotOk ? 'success' : (!googleOk && !trustpilotOk ? 'destructive' : 'default');
      const title = googleOk && trustpilotOk
        ? 'Sincronizacion completada'
        : (!googleOk && !trustpilotOk ? 'Error en sincronizacion' : 'Sincronizacion parcial');

      addToast({
        title,
        description: parts.join(' || '),
        variant,
      });

      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['tp-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tp-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['tp-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['tp-summary-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tp-metrics-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['tp-reviews-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['health'] });
      queryClient.invalidateQueries();
    },
    onError: (err) => {
      addToast({
        title: 'Error en sincronizacion',
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
    syncing: 'Sincronizando...',
    ok: 'Sincronizado',
    error: 'Error',
  };

  const syncIntervalMs = useMemo(() => {
    const candidate = Number(healthQuery.data?.syncIntervalMs);
    return Number.isFinite(candidate) && candidate > 0 ? candidate : 120_000;
  }, [healthQuery.data?.syncIntervalMs]);

  const syncReference = lastSyncStartedAt || summaryQuery.data?.lastSyncedAt || null;
  const remainingMs = useMemo(() => {
    if (!syncReference) return null;

    const referenceMs = new Date(syncReference).getTime();
    if (!Number.isFinite(referenceMs)) return null;

    const elapsed = Math.max(0, nowMs - referenceMs);
    const remainder = syncIntervalMs - (elapsed % syncIntervalMs);

    return remainder === syncIntervalMs && elapsed > 0 ? syncIntervalMs : remainder;
  }, [nowMs, syncIntervalMs, syncReference]);

  const syncCountdownLabel = useMemo(() => {
    if (syncStatus === 'syncing') return 'Robot actualizando...';
    if (remainingMs === null) return null;

    const prefix = syncStatus === 'error' ? 'Reintento en' : 'Prox. robot en';
    return `${prefix} ${formatCountdown(remainingMs)}`;
  }, [remainingMs, syncStatus]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#111827' }}>
      {/* Header */}
      <header className="border-b border-[rgba(89,178,176,0.15)] px-6 py-3 flex items-center justify-between sticky top-0 z-30" style={{ background: '#111827' }}>
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-brand-900 text-base"
            style={{ background: 'linear-gradient(135deg, #8cf4ee, #448481)' }}
          >
            I
          </div>
          <div>
            <div className="font-bold text-brand-50 leading-none text-sm">InnoApp</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Reviews Monitor</div>
          </div>
        </div>

        {/* Nav 
        <nav className="flex gap-1">
          {[
            { to: '/', icon: <LayoutDashboard size={15} />, label: 'Dashboard' },
            { to: '/analytics', icon: <BarChart3 size={15} />, label: 'Analitica' },
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
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>*/}

        {/* Status + sync */}
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-1.5 text-xs">
            {connected
              ? <Wifi size={13} className="text-green-400" />
              : <WifiOff size={13} className="text-red-400" />}
            <span className={connected ? 'text-green-400' : 'text-red-400'}>
              {connected ? 'En vivo' : 'Desconectado'}
            </span>
          </div>

          {/* Sync status */}
          <div className={`text-xs ${syncStatusColors[syncStatus]}`}>
            {syncStatusLabels[syncStatus]}
            {syncCountdownLabel ? ` | ${syncCountdownLabel}` : ''}
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
