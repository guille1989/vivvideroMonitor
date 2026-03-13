import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  fetchSummary,
  fetchReviews,
  fetchMetrics,
  fetchTrustpilotSummary,
  fetchTrustpilotReviews,
  fetchTrustpilotMetrics,
  fetchHealth,
} from '../services/api';
import { useSocket } from '../hooks/useSocket';
import ECGCanvas from '../components/ECGCanvas';
import ReviewFollowUpCard from '../components/ReviewFollowUpCard';

dayjs.extend(relativeTime);

const SCORE_STATE_TEXT = {
  good: 'Saludable',
  warn: 'Vigilancia',
  bad: 'Critico',
};

const TRACKING_FILTER_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'unmanaged', label: 'Sin gestionar' },
  { value: 'managed', label: 'Gestionadas' },
  { value: 'in_follow_up', label: 'Seguimiento' },
  { value: 'escalated', label: 'Escaladas' },
  { value: 'ignored', label: 'Ignoradas' },
];

const TRACKING_METRIC_OPTIONS = [
  { value: 'managed', label: 'Gestionadas' },
  { value: 'in_follow_up', label: 'En seguimiento' },
  { value: 'escalated', label: 'Escaladas' },
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getTrackingCount(trackingCounts, status) {
  return toNumber(trackingCounts?.[status]);
}

function getTrackingTotal(trackingCounts) {
  return TRACKING_FILTER_OPTIONS
    .filter((option) => option.value !== 'all')
    .reduce((sum, option) => sum + getTrackingCount(trackingCounts, option.value), 0);
}

function getStarDistribution(metrics) {
  return [1, 2, 3, 4, 5].map((stars) => {
    const found = metrics?.starDistribution?.find((item) => item.stars === stars);
    return { stars, count: found?.count || 0 };
  });
}

function getRoundedStars(rating) {
  return Math.max(0, Math.min(5, Math.round(toNumber(rating))));
}

function getRatingDelta(ratingHistory = []) {
  if (!Array.isArray(ratingHistory) || ratingHistory.length < 2) return 0;
  const last = toNumber(ratingHistory[ratingHistory.length - 1]?.rating);
  const prev = toNumber(ratingHistory[ratingHistory.length - 2]?.rating);
  return Number((last - prev).toFixed(1));
}

function getTrendBadge(delta) {
  const value = toNumber(delta);
  if (value > 0) return { label: `+${value.toFixed(1)}`, tone: 'up' };
  if (value < 0) return { label: `${value.toFixed(1)}`, tone: 'down' };
  return { label: '0.0', tone: 'flat' };
}

function getTrustScoreLabel(rating) {
  const value = toNumber(rating);
  if (value >= 4.5) return 'Excellent';
  if (value >= 3.5) return 'Great';
  if (value >= 2.5) return 'Average';
  if (value >= 1.5) return 'Poor';
  return 'Bad';
}

function getScoreState(rating) {
  const value = toNumber(rating);
  if (value >= 4) return 'good';
  if (value >= 3) return 'warn';
  return 'bad';
}

function getVolumeTrend(reviewsByDay = []) {
  if (!Array.isArray(reviewsByDay) || reviewsByDay.length === 0) return 0;
  const sorted = [...reviewsByDay].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const recent = sorted.slice(-7);
  const previous = sorted.slice(-14, -7);

  const recentAvg = recent.length
    ? recent.reduce((sum, item) => sum + toNumber(item.count), 0) / recent.length
    : 0;
  const previousAvg = previous.length
    ? previous.reduce((sum, item) => sum + toNumber(item.count), 0) / previous.length
    : 0;

  return Number((recentAvg - previousAvg).toFixed(1));
}

function getSourceHealth(lastSyncedAt) {
  if (!lastSyncedAt) return { label: 'Sin datos', tone: 'err' };
  const minutesAgo = dayjs().diff(dayjs(lastSyncedAt), 'minute');
  if (minutesAgo <= 2) return { label: 'OK', tone: 'ok' };
  if (minutesAgo <= 10) return { label: 'Warn', tone: 'warn' };
  return { label: 'Lag', tone: 'err' };
}

function getHealthBadgeClass(tone) {
  if (tone === 'ok') return 'rm-health-status ok';
  if (tone === 'warn') return 'rm-health-status warn';
  return 'rm-health-status err';
}

function StarLine({ rating }) {
  const rounded = getRoundedStars(rating);
  const star = '\u2605';
  return (
    <div className="rm-ecg-stars" aria-hidden="true">
      <span className="on">{star.repeat(rounded)}</span>
      <span className="off">{star.repeat(5 - rounded)}</span>
    </div>
  );
}

function ReviewsPanel({
  title,
  count,
  source,
  tab,
  setTab,
  trackingFilter,
  setTrackingFilter,
  trackingCounts,
  reviews,
}) {
  const visibleReviews = useMemo(() => {
    if (!Array.isArray(reviews)) return [];
    if (tab === 'new') return reviews.filter((review) => review.isNew);
    if (tab === 'negative') return reviews.filter((review) => review.isNegative);
    return reviews;
  }, [reviews, tab]);

  return (
    <div className="rm-section">
      <div className="rm-section-head">
        <div className="rm-section-title">
          <span className={`rm-source-dot ${source}`} />
          {title}
        </div>
        <div className="rm-section-badge">{count}</div>
      </div>

      <div className="rm-source-tabs">
        <button type="button" onClick={() => setTab('all')} className={`rm-source-tab ${tab === 'all' ? 'active-all' : ''}`}>
          Todas
        </button>
        <button type="button" onClick={() => setTab('new')} className={`rm-source-tab ${tab === 'new' ? 'active-g' : ''}`}>
          Solo nuevas
        </button>
        <button type="button" onClick={() => setTab('negative')} className={`rm-source-tab ${tab === 'negative' ? 'active-tp' : ''}`}>
          Negativas
        </button>
      </div>

      <div className="rm-review-metrics">
        {TRACKING_METRIC_OPTIONS.map((metric) => (
          <div key={metric.value} className={`rm-review-metric ${metric.value}`}>
            <span className="rm-review-metric-label">{metric.label}</span>
            <span className="rm-review-metric-value">{getTrackingCount(trackingCounts, metric.value)}</span>
          </div>
        ))}
      </div>

      <div className="rm-track-filter-row">
        {TRACKING_FILTER_OPTIONS.map((option) => {
          const optionCount = option.value === 'all'
            ? getTrackingTotal(trackingCounts)
            : getTrackingCount(trackingCounts, option.value);
          const isActive = trackingFilter === option.value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTrackingFilter(option.value)}
              className={`rm-track-filter ${isActive ? `is-${source}` : ''}`}
            >
              <span>{option.label}</span>
              <span className="rm-track-filter-count">{optionCount}</span>
            </button>
          );
        })}
      </div>

      <div className="rm-reviews-scroll">
        {visibleReviews.length === 0 && (
          <div className="rm-empty-state">Sin resenas para este filtro.</div>
        )}

        {visibleReviews.map((review) => {
          return (
            <ReviewFollowUpCard
              key={review._id}
              review={review}
              source={source}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage({ placeId }) {
  const { connected } = useSocket();
  const [viewMode, setViewMode] = useState('focus');
  const [focusDemoRating, setFocusDemoRating] = useState(null);
  const [googleTab, setGoogleTab] = useState('all');
  const [trustpilotTab, setTrustpilotTab] = useState('all');
  const [googleTrackingFilter, setGoogleTrackingFilter] = useState('all');
  const [trustpilotTrackingFilter, setTrustpilotTrackingFilter] = useState('all');
  const [thresholds, setThresholds] = useState({
    googleMin: true,
    trustpilotMin: true,
    negativeBurst: true,
    ratingChange: true,
    hourlyBurst: false,
  });

  const summaryQuery = useQuery({
    queryKey: ['summary', placeId],
    queryFn: () => fetchSummary(placeId),
    refetchInterval: 30_000,
  });

  const metricsQuery = useQuery({
    queryKey: ['metrics', placeId],
    queryFn: () => fetchMetrics(placeId),
    refetchInterval: 60_000,
  });

  const reviewsQuery = useQuery({
    queryKey: ['reviews', placeId, 'dashboard', googleTrackingFilter],
    queryFn: () => fetchReviews(placeId, {
      page: 1,
      limit: 50,
      trackingStatus: googleTrackingFilter === 'all' ? undefined : googleTrackingFilter,
    }),
    refetchInterval: 30_000,
  });

  const tpSummaryQuery = useQuery({
    queryKey: ['tp-summary-dashboard'],
    queryFn: fetchTrustpilotSummary,
    refetchInterval: 30_000,
    retry: 1,
  });

  const tpMetricsQuery = useQuery({
    queryKey: ['tp-metrics-dashboard'],
    queryFn: fetchTrustpilotMetrics,
    refetchInterval: 60_000,
    retry: 1,
  });

  const tpReviewsQuery = useQuery({
    queryKey: ['tp-reviews-dashboard', trustpilotTrackingFilter],
    queryFn: () => fetchTrustpilotReviews({
      page: 1,
      limit: 50,
      trackingStatus: trustpilotTrackingFilter === 'all' ? undefined : trustpilotTrackingFilter,
    }),
    refetchInterval: 30_000,
    retry: 1,
  });

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  const gSummary = summaryQuery.data || {};
  const tSummary = tpSummaryQuery.data || {};
  const gMetrics = metricsQuery.data || {};
  const tMetrics = tpMetricsQuery.data || {};
  const gReviews = reviewsQuery.data?.reviews || [];
  const tReviews = tpReviewsQuery.data?.reviews || [];

  const gDist = useMemo(() => getStarDistribution(gMetrics), [gMetrics]);
  const tDist = useMemo(() => getStarDistribution(tMetrics), [tMetrics]);
  const gDistMax = Math.max(...gDist.map((item) => item.count), 1);
  const tDistMax = Math.max(...tDist.map((item) => item.count), 1);

  const gDelta = getRatingDelta(gMetrics?.ratingHistory || []);
  const tDelta = getRatingDelta(tMetrics?.ratingHistory || []);
  const gTrendBadge = getTrendBadge(gDelta);
  const tTrendBadge = getTrendBadge(tDelta);

  const gVolumeTrend = getVolumeTrend(gMetrics?.reviewsByDay || []);
  const tVolumeTrend = getVolumeTrend(tMetrics?.reviewsByDay || []);
  const gVolumeTrendLabel = `${gVolumeTrend >= 0 ? '+' : ''}${gVolumeTrend.toFixed(1)}`;
  const tVolumeTrendLabel = `${tVolumeTrend >= 0 ? '+' : ''}${tVolumeTrend.toFixed(1)}`;

  const totalNegative = toNumber(gSummary?.negativeReviewsCount) + toNumber(tSummary?.negativeReviewsCount);
  const totalNew = toNumber(gSummary?.newReviewsCount) + toNumber(tSummary?.newReviewsCount);

  const totalReviewsCombined = toNumber(gSummary?.totalReviews) + toNumber(tSummary?.totalReviews);
  const combinedRating = totalReviewsCombined > 0
    ? ((toNumber(gSummary?.currentRating) * toNumber(gSummary?.totalReviews)) + (toNumber(tSummary?.currentRating) * toNumber(tSummary?.totalReviews))) / totalReviewsCombined
    : 0;
  const visibleFocusRating = focusDemoRating ?? combinedRating;

  const focusState = getScoreState(visibleFocusRating);

  const now = dayjs();
  const sixHoursAgo = now.subtract(6, 'hour');
  const googlePositiveRecent = gReviews.filter((review) => {
    const syncedAt = review.syncedAt ? dayjs(review.syncedAt) : null;
    return review.rating >= 4 && syncedAt && syncedAt.isAfter(sixHoursAgo);
  }).length;

  const alerts = [];
  if (totalNegative > 0) {
    alerts.push({
      type: 'danger',
      text: `${totalNegative} resenas negativas activas requieren atencion.`,
      source: 'Global',
    });
  }
  if (toNumber(tSummary?.currentRating) > 0 && toNumber(tSummary?.currentRating) < 4) {
    alerts.push({
      type: 'warn',
      text: `Trustpilot por debajo de umbral: ${toNumber(tSummary?.currentRating).toFixed(1)} (< 4.0).`,
      source: 'Trustpilot',
    });
  }
  if (googlePositiveRecent > 0) {
    alerts.push({
      type: 'info',
      text: `${googlePositiveRecent} resenas positivas nuevas en Google durante las ultimas 6h.`,
      source: 'Google',
    });
  }

  const activityData = useMemo(() => {
    const gMap = new Map((gMetrics?.reviewsByDay || []).map((item) => [item.date, item.count]));
    const tMap = new Map((tMetrics?.reviewsByDay || []).map((item) => [item.date, item.count]));
    const allDates = Array.from(new Set([...gMap.keys(), ...tMap.keys()])).sort();
    const selected = allDates.slice(-7);

    if (selected.length === 0) {
      return Array.from({ length: 7 }).map((_, index) => {
        const date = dayjs().subtract(6 - index, 'day');
        return {
          date: date.format('YYYY-MM-DD'),
          label: date.format('DD/MM'),
          google: 0,
          trustpilot: 0,
        };
      });
    }

    return selected.map((date) => ({
      date,
      label: dayjs(date).format('DD/MM'),
      google: toNumber(gMap.get(date)),
      trustpilot: toNumber(tMap.get(date)),
    }));
  }, [gMetrics, tMetrics]);

  const activityMax = Math.max(
    ...activityData.flatMap((item) => [toNumber(item.google), toNumber(item.trustpilot)]),
    1
  );

  const gHealth = getSourceHealth(gSummary?.lastSyncedAt);
  const tHealth = getSourceHealth(tSummary?.lastSyncedAt);
  const dbTone = healthQuery.data?.database === 'connected' ? 'ok' : 'err';
  const socketTone = connected ? 'ok' : 'err';

  const trustpilotUnavailable = tpSummaryQuery.isError || tpMetricsQuery.isError || tpReviewsQuery.isError;
  const ratingStar = '\u2605';

  if (summaryQuery.isError && tpSummaryQuery.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle size={40} className="text-red-400" />
        <p className="text-red-400 font-semibold">No se pudo cargar el dashboard</p>
        <p className="text-xs text-gray-500">Google y Trustpilot devolvieron error.</p>
      </div>
    );
  }

  return (
    <div className="rm-dashboard">
      {viewMode === 'focus' && (
        <div className="rm-focus-view">
          <div className="rm-focus-inner">
            <div className="rm-focus-sources">
              <div className="rm-source-pill google">
                <span className="dot" />
                <span className="value">{toNumber(gSummary?.currentRating).toFixed(1)}{ratingStar}</span>
                <span className="label">Google</span>
              </div>
              <div className="rm-source-pill trustpilot">
                <span className="dot" />
                <span className="value">{toNumber(tSummary?.currentRating).toFixed(1)}{ratingStar}</span>
                <span className="label">Trustpilot</span>
              </div>
            </div>

            <button
              type="button"
              className={`rm-ecg-card ${focusState} ${focusState === 'bad' ? 'shaking' : ''}`}
              onClick={() => setViewMode('detail')}
            >
              <div className="rm-ecg-card-label">
                <div className="rm-ecg-lbl">Puntuacion combinada</div>
                <div className="rm-ecg-hint">
                  Ver dashboard completo
                  <ChevronRight size={12} />
                </div>
              </div>

              <div className="rm-ecg-score">{visibleFocusRating > 0 ? visibleFocusRating.toFixed(1) : '-'}</div>
              <StarLine rating={visibleFocusRating} />

              <div className="rm-ecg-wrap">
                <ECGCanvas rating={visibleFocusRating} height={72} radius={12} showScan />
              </div>

              <div className={`rm-ecg-status ${focusState}`}>
                <span className="rm-ecg-status-dot" />
                <span className="rm-ecg-status-text">{SCORE_STATE_TEXT[focusState]}</span>
              </div>

              <div className="rm-ecg-split">
                <div className="rm-split-box">
                  <div className="rm-split-val g">{toNumber(gSummary?.currentRating).toFixed(1)}{ratingStar}</div>
                  <div className="rm-split-lbl">Google · {toNumber(gSummary?.totalReviews)}</div>
                </div>
                <div className="rm-split-box">
                  <div className="rm-split-val tp">{toNumber(tSummary?.currentRating).toFixed(1)}{ratingStar}</div>
                  <div className="rm-split-lbl">Trustpilot · {toNumber(tSummary?.totalReviews)}</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {viewMode === 'detail' && (
        <div className="rm-detail-view rm-detail-enter">
          <div className="rm-back-bar">
            <button type="button" className="rm-btn-back" onClick={() => setViewMode('focus')}>
              <ChevronLeft size={13} />
              Volver
            </button>
            <span className="rm-back-title">Dashboard completo</span>
          </div>

          {trustpilotUnavailable && (
            <div className="rm-inline-notice">
              Trustpilot data unavailable - run a sync first.
            </div>
          )}

          <div className="rm-score-hero">
            <div className="rm-score-card google">
              <div className={`rm-delta-badge ${gTrendBadge.tone}`}>{gTrendBadge.label}</div>
              <div className="rm-score-source">Google Maps</div>

              <div className="rm-score-main-row">
                <div className="rm-big-score">{toNumber(gSummary?.currentRating).toFixed(1)}</div>
                <div className="rm-score-meta">
                  <StarLine rating={gSummary?.currentRating} />
                  <div className="rm-score-total">{toNumber(gSummary?.totalReviews)} resenas - {gSummary?.businessName || 'google profile'}</div>
                </div>
              </div>

              <div className="rm-mini-dist">
                {[...gDist].reverse().map((row) => (
                  <div key={`g-${row.stars}`} className="rm-dist-row">
                    <span className="rm-dist-label">{row.stars}</span>
                    <div className="rm-dist-track">
                      <div className="rm-dist-fill google" style={{ width: `${(row.count / gDistMax) * 100}%` }} />
                    </div>
                    <span className="rm-dist-count">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rm-score-card trustpilot">
              <div className={`rm-delta-badge ${tTrendBadge.tone}`}>{tTrendBadge.label}</div>
              <div className="rm-score-source">Trustpilot</div>

              <div className="rm-score-main-row">
                <div className="rm-big-score">{toNumber(tSummary?.currentRating).toFixed(1)}</div>
                <div className="rm-score-meta">
                  <StarLine rating={tSummary?.currentRating} />
                  <div className="rm-score-total">{toNumber(tSummary?.totalReviews)} resenas - uk.trustpilot.com</div>
                  <span className="rm-trust-label">{getTrustScoreLabel(tSummary?.currentRating)}</span>
                </div>
              </div>

              <div className="rm-mini-dist">
                {[...tDist].reverse().map((row) => (
                  <div key={`t-${row.stars}`} className="rm-dist-row">
                    <span className="rm-dist-label">{row.stars}</span>
                    <div className="rm-dist-track">
                      <div className="rm-dist-fill trustpilot" style={{ width: `${(row.count / tDistMax) * 100}%` }} />
                    </div>
                    <span className="rm-dist-count">{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>      

          <div className="rm-main-grid">
            <ReviewsPanel
              title="Resenas Google"
              count={gSummary?.trackingCounts ? getTrackingTotal(gSummary.trackingCounts) : toNumber(gSummary?.totalReviews)}
              source="google"
              tab={googleTab}
              setTab={setGoogleTab}
              trackingFilter={googleTrackingFilter}
              setTrackingFilter={setGoogleTrackingFilter}
              trackingCounts={gSummary?.trackingCounts}
              reviews={gReviews}
            />

            <ReviewsPanel
              title="Resenas Trustpilot"
              count={tSummary?.trackingCounts ? getTrackingTotal(tSummary.trackingCounts) : toNumber(tSummary?.totalReviews)}
              source="trustpilot"
              tab={trustpilotTab}
              setTab={setTrustpilotTab}
              trackingFilter={trustpilotTrackingFilter}
              setTrackingFilter={setTrustpilotTrackingFilter}
              trackingCounts={tSummary?.trackingCounts}
              reviews={tReviews}
            />
          </div>
        </div>
      )}

      {(summaryQuery.isLoading || tpSummaryQuery.isLoading || metricsQuery.isLoading || tpMetricsQuery.isLoading) && (
        <div className="rm-loading-note">
          <RefreshCw size={12} className="animate-spin" />
          Cargando datos en tiempo real...
        </div>
      )}
    </div>
  );
}
