import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { AlertTriangle, Star, MessageSquare, TrendingUp, ShieldAlert, Trash2 } from 'lucide-react';
import { fetchSummary, fetchReviews } from '../services/api';
import { KpiCard } from '../components/ui/KpiCard';
import { StarRating } from '../components/ui/StarRating';
import { ReviewCard } from '../components/ReviewCard';
import { ReviewFilters } from '../components/ReviewFilters';

export default function DashboardPage({ placeId }) {
  const [filters, setFilters] = useState({ page: 1, limit: 20 });

  // Summary query
  const summaryQuery = useQuery({
    queryKey: ['summary', placeId],
    queryFn: () => fetchSummary(placeId),
    refetchInterval: 30_000,
  });

  // Reviews query
  const reviewsQuery = useQuery({
    queryKey: ['reviews', placeId, filters],
    queryFn: () => fetchReviews(placeId, filters),
    refetchInterval: 30_000,
  });

  const summary = summaryQuery.data;
  const reviewsData = reviewsQuery.data;

  if (summaryQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-red-400 font-semibold">Error al cargar el dashboard</p>
        <p className="text-xs text-gray-500">{summaryQuery.error?.message}</p>
        <p className="text-xs text-gray-600 mt-2">
          Asegúrate de que el backend esté corriendo y hayas ejecutado una sincronización.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Business header */}
      {summary && (
        <div className="card flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{ background: 'rgba(89,178,176,0.1)', border: '1px solid rgba(89,178,176,0.2)' }}>
              📍
            </div>
            <div>
              <h1 className="font-bold text-lg text-brand-50">{summary.businessName}</h1>
              <p className="text-xs text-gray-500">Place ID: {placeId}</p>
            </div>
          </div>
          <div className="text-xs text-gray-500 flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <StarRating rating={Math.round(summary.currentRating)} size={14} />
              <span className="font-bold text-brand-100">{summary.currentRating?.toFixed(1)}</span>
            </div>
            <span>Última sync: {summary.lastSyncedAt ? dayjs(summary.lastSyncedAt).format('HH:mm:ss') : '—'}</span>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Valoración"
          icon={<Star size={12} />}
          value={summary ? `${summary.currentRating?.toFixed(1)}★` : '—'}
          sub="Rating promedio Google"
          accent={summary?.currentRating >= 4 ? 'brand' : summary?.currentRating >= 3 ? 'yellow' : 'red'}
        />
        <KpiCard
          label="Total reseñas"
          icon={<MessageSquare size={12} />}
          value={summary?.totalReviews?.toLocaleString() ?? '—'}
          sub="Acumulado histórico"
          accent="brand"
        />
        <KpiCard
          label="Nuevas"
          icon={<TrendingUp size={12} />}
          value={summary?.newReviewsCount ?? '—'}
          sub="Detectadas en este ciclo"
          accent="green"
        />
        <KpiCard
          label="Negativas"
          icon={<ShieldAlert size={12} />}
          value={summary?.negativeReviewsCount ?? '—'}
          sub="1-2 estrellas en BD"
          accent={summary?.negativeReviewsCount > 0 ? 'red' : 'brand'}
        />
        <KpiCard
          label="Eliminadas"
          icon={<Trash2 size={12} />}
          value={summary?.removedReviewsCount ?? '—'}
          sub="Marcadas como removidas"
          accent={summary?.removedReviewsCount > 0 ? 'yellow' : 'brand'}
        />
      </div>

      {/* Alerts */}
      {summary?.newReviewsCount > 0 && (
        <div className="rounded-xl px-4 py-3 border border-brand-100/25 bg-brand-100/8 text-brand-50 text-sm flex items-center gap-2">
          ✨ <strong>{summary.newReviewsCount}</strong> reseñas nuevas detectadas desde la última visualización.
        </div>
      )}
      {summary?.negativeReviewsCount > 0 && (
        <div className="rounded-xl px-4 py-3 border border-red-500/30 bg-red-950/20 text-red-300 text-sm flex items-center gap-2">
          🚨 <strong>{summary.negativeReviewsCount}</strong> reseñas negativas (1-2★) en la base de datos. Requieren atención.
        </div>
      )}
      {summary?.removedReviewsCount > 0 && (
        <div className="rounded-xl px-4 py-3 border border-amber-500/30 bg-amber-950/20 text-amber-200 text-sm flex items-center gap-2">
          🗑 <strong>{summary.removedReviewsCount}</strong> reseñas fueron marcadas como removidas en Google.
        </div>
      )}

      {/* Reviews section */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-semibold text-brand-50 text-sm flex items-center gap-2">
            <MessageSquare size={15} className="text-brand-300" />
            Reseñas
            {reviewsData && (
              <span className="text-[11px] text-gray-500 font-normal">
                ({reviewsData.total} resultados)
              </span>
            )}
          </h2>
        </div>

        <ReviewFilters filters={filters} onChange={setFilters} />

        {/* List */}
        <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
          {reviewsQuery.isLoading && (
            <div className="text-center py-12 text-gray-500 text-sm">Cargando reseñas…</div>
          )}
          {reviewsQuery.isError && (
            <div className="text-center py-12 text-red-400 text-sm">
              Error: {reviewsQuery.error?.message}
            </div>
          )}
          {reviewsData?.reviews?.length === 0 && (
            <div className="text-center py-12 text-gray-500 text-sm">
              No hay reseñas con los filtros seleccionados.
            </div>
          )}
          {reviewsData?.reviews?.map((review) => (
            <ReviewCard key={review._id} review={review} />
          ))}
        </div>

        {/* Pagination */}
        {reviewsData && reviewsData.pages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-[rgba(89,178,176,0.1)]">
            <span className="text-xs text-gray-500">
              Página {reviewsData.page} de {reviewsData.pages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={reviewsData.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
                className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(89,178,176,0.15)]
                  disabled:opacity-40 text-brand-50 hover:border-brand-300/30"
              >
                ← Anterior
              </button>
              <button
                disabled={reviewsData.page >= reviewsData.pages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
                className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(89,178,176,0.15)]
                  disabled:opacity-40 text-brand-50 hover:border-brand-300/30"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
