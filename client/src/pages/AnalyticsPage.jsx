import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { BarChart3, AlertTriangle } from 'lucide-react';
import { fetchMetrics, fetchTrustpilotMetrics, fetchTrustpilotSummary } from '../services/api';

const BRAND_COLORS = ['#448481', '#59b2b0', '#8cf4ee', '#c5efec', '#1f293d'];
const STAR_COLORS = {
  1: '#ef4444',
  2: '#f97316',
  3: '#eab308',
  4: '#59b2b0',
  5: '#8cf4ee',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1a2235] border border-[rgba(89,178,176,0.2)] rounded-xl px-3 py-2 text-xs">
        <p className="font-semibold text-brand-50 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage({ placeId }) {
  const [source, setSource] = useState('google');

  const metricsQuery = useQuery({
    queryKey: ['metrics', placeId],
    queryFn: () => fetchMetrics(placeId),
    refetchInterval: 60_000,
  });

  const tpMetricsQuery = useQuery({
    queryKey: ['tp-metrics'],
    queryFn: fetchTrustpilotMetrics,
    refetchInterval: 60_000,
    retry: 1,
  });

  const tpSummaryQuery = useQuery({
    queryKey: ['tp-summary'],
    queryFn: fetchTrustpilotSummary,
    refetchInterval: 60_000,
    retry: 1,
  });

  const isGoogleSource = source === 'google';
  const selectedMetrics = isGoogleSource ? metricsQuery.data : tpMetricsQuery.data;

  if (isGoogleSource && metricsQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-red-400 font-semibold">Error al cargar métricas</p>
        <p className="text-xs text-gray-500">{metricsQuery.error?.message}</p>
      </div>
    );
  }

  if (isGoogleSource && metricsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 text-sm">
        Cargando métricas…
      </div>
    );
  }

  // Preparar datos de distribución por estrella
  const starData = [1, 2, 3, 4, 5].map((s) => {
    const found = selectedMetrics?.starDistribution?.find((d) => d.stars === s);
    return { stars: `${s}★`, count: found?.count || 0, fill: STAR_COLORS[s] };
  });

  // Total de reviews en BD
  const totalInDBByDistribution = starData.reduce((a, b) => a + b.count, 0);
  const trustpilotTotalInDB =
    tpSummaryQuery.data?.totalInDB ??
    tpSummaryQuery.data?.totalReviewsInDB ??
    tpSummaryQuery.data?.totalReviews;
  const totalInDB = isGoogleSource
    ? totalInDBByDistribution
    : (typeof trustpilotTotalInDB === 'number' ? trustpilotTotalInDB : totalInDBByDistribution);
  const negativeCount = isGoogleSource
    ? (selectedMetrics?.negativeCount ?? 0)
    : (tpSummaryQuery.data?.negativeCount ?? selectedMetrics?.negativeCount ?? 0);

  // Rating history para línea
  const ratingHistory = (selectedMetrics?.ratingHistory || []).map((r, i) => ({
    idx: i + 1,
    rating: r.rating,
  }));

  // Reviews por día
  const reviewsByDay = selectedMetrics?.reviewsByDay || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-brand-300" />
          <h1 className="font-bold text-brand-50">Analítica de Reseñas</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSource('google')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              source === 'google'
                ? 'bg-brand-300/20 text-brand-100 border-brand-300/30'
                : 'bg-[#1a2235] border-[rgba(89,178,176,0.15)] text-gray-400 hover:border-brand-300/30'
            }`}
          >
            Google
          </button>
          <button
            onClick={() => setSource('trustpilot')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
              source === 'trustpilot'
                ? 'bg-brand-300/20 text-brand-100 border-brand-300/30'
                : 'bg-[#1a2235] border-[rgba(89,178,176,0.15)] text-gray-400 hover:border-brand-300/30'
            }`}
          >
            {source === 'trustpilot' && (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-green-400" fill="currentColor" aria-hidden="true">
                <path d="M12 1.7l3.09 6.26 6.91 1-5 4.87 1.18 6.89L12 17.77 5.82 20.72 7 13.83 2 8.96l6.91-1L12 1.7z" />
              </svg>
            )}
            Trustpilot
          </button>
        </div>
      </div>

      {source === 'trustpilot' && tpMetricsQuery.isLoading && (
        <div className="text-xs text-gray-500">Cargando datos de Trustpilot…</div>
      )}
      {source === 'trustpilot' && tpMetricsQuery.isError && (
        <div className="text-xs rounded-lg px-3 py-2 border border-amber-500/30 bg-amber-950/20 text-amber-200">
          Trustpilot data unavailable — run a sync first
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total en BD', value: totalInDB, color: 'text-brand-100' },
          { label: 'Negativas (1-2★)', value: negativeCount, color: 'text-red-400' },
          { label: 'Variaciones rating', value: ratingHistory.length, color: 'text-yellow-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card text-center">
            <div className={`text-3xl font-extrabold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Distribución por estrella */}
      <div className="card">
        <h2 className="font-semibold text-sm text-brand-50 mb-4">Distribución por Estrellas</h2>
        {totalInDB === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">Sin datos todavía. Ejecuta una sincronización.</div>
        ) : (
          <div className="flex gap-6 flex-wrap">
            {/* Bar chart */}
            <div className="flex-1 min-w-[260px] h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={starData} barCategoryGap="30%">
                  <XAxis dataKey="stars" tick={{ fill: '#7a9a98', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#7a9a98', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Reseñas" radius={[6, 6, 0, 0]}>
                    {starData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart */}
            <div className="w-48 h-56 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={starData.filter((d) => d.count > 0)}
                    dataKey="count"
                    nameKey="stars"
                    cx="50%" cy="50%"
                    innerRadius={40} outerRadius={70}
                    paddingAngle={3}
                  >
                    {starData.filter((d) => d.count > 0).map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(v) => <span className="text-xs text-gray-400">{v}</span>}
                    iconSize={8}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Reviews detectadas por día */}
      <div className="card">
        <h2 className="font-semibold text-sm text-brand-50 mb-4">Reseñas Detectadas por Día (últimos 30 días)</h2>
        {reviewsByDay.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">Sin datos de actividad reciente.</div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reviewsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(89,178,176,0.08)" />
                <XAxis dataKey="date" tick={{ fill: '#7a9a98', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7a9a98', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Nuevas" fill="#59b2b0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Evolución del rating */}
      {ratingHistory.length > 1 && (
        <div className="card">
          <h2 className="font-semibold text-sm text-brand-50 mb-4">Evolución del Rating</h2>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ratingHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(89,178,176,0.08)" />
                <XAxis dataKey="idx" tick={{ fill: '#7a9a98', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[1, 5]} tick={{ fill: '#7a9a98', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="rating"
                  name="Rating"
                  stroke="#8cf4ee"
                  strokeWidth={2}
                  dot={{ fill: '#448481', r: 3 }}
                  activeDot={{ r: 5, fill: '#8cf4ee' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
