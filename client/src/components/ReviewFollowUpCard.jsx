import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import { ChevronDown } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ReviewAvatar from './ReviewAvatar';
import { updateReviewTracking } from '../services/api';
import { useToast } from './ui/Toaster';

dayjs.extend(relativeTime);
dayjs.locale('es');

const TRACKING_OPTIONS = [
  {
    value: 'managed',
    label: 'Gestionada',
    dotClassName: 'bg-lime-400',
    badgeClassName: 'text-lime-300 border-lime-400/30 bg-lime-400/10',
    selectedClassName: 'text-lime-200 border-lime-400/40 bg-lime-400/14',
  },
  {
    value: 'in_follow_up',
    label: 'En seguimiento',
    dotClassName: 'bg-amber-400',
    badgeClassName: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
    selectedClassName: 'text-amber-200 border-amber-400/40 bg-amber-400/14',
  },
  {
    value: 'ignored',
    label: 'Ignorar',
    dotClassName: 'bg-slate-400',
    badgeClassName: 'text-slate-300 border-slate-400/30 bg-slate-400/10',
    selectedClassName: 'text-slate-200 border-slate-400/40 bg-slate-400/14',
  },
  {
    value: 'escalated',
    label: 'Escalar',
    dotClassName: 'bg-violet-400',
    badgeClassName: 'text-violet-300 border-violet-400/30 bg-violet-400/10',
    selectedClassName: 'text-violet-200 border-violet-400/40 bg-violet-400/14',
  },
];

const DEFAULT_TRACKING_META = {
  value: 'unmanaged',
  label: 'Sin gestionar',
  dotClassName: 'bg-slate-500',
  badgeClassName: 'text-slate-300 border-slate-400/30 bg-slate-400/10',
  selectedClassName: 'text-slate-200 border-slate-400/40 bg-slate-400/14',
};

function getTrackingMeta(status) {
  return TRACKING_OPTIONS.find((option) => option.value === status) || DEFAULT_TRACKING_META;
}

function replaceReviewInCache(currentData, updatedReview) {
  if (!currentData || !Array.isArray(currentData.reviews)) return currentData;

  return {
    ...currentData,
    reviews: currentData.reviews.map((review) => (
      review._id === updatedReview._id ? updatedReview : review
    )),
  };
}

export default function ReviewFollowUpCard({ review, source }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const currentStatus = review.trackingStatus || 'unmanaged';
  const currentNote = review.trackingNote || '';
  const [draftStatus, setDraftStatus] = useState(currentStatus);
  const [draftNote, setDraftNote] = useState(currentNote);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setDraftStatus(currentStatus);
    setDraftNote(currentNote);
  }, [currentStatus, currentNote, review._id]);

  const trackingMeta = getTrackingMeta(currentStatus);
  const trackingEvents = useMemo(() => {
    if (Array.isArray(review.trackingHistory) && review.trackingHistory.length > 0) {
      return [...review.trackingHistory].reverse();
    }

    if (currentStatus !== 'unmanaged' || currentNote) {
      return [{
        status: currentStatus,
        note: currentNote,
        createdAt: review.trackingUpdatedAt || review.updatedAt || review.syncedAt || null,
        synthetic: true,
      }];
    }

    return [];
  }, [review.trackingHistory, currentStatus, currentNote, review.trackingUpdatedAt, review.updatedAt, review.syncedAt]);
  const latestTrackingEvent = trackingEvents[0] || null;
  const hasChanges = draftStatus !== currentStatus || draftNote !== currentNote;
  const timeLabel = review.relativeTimeDescription || (review.syncedAt ? dayjs(review.syncedAt).fromNow() : '--');
  const previewText = review.text || latestTrackingEvent?.note || '';

  useEffect(() => {
    if (hasChanges) {
      setIsExpanded(true);
    }
  }, [hasChanges]);

  const mutation = useMutation({
    mutationFn: () => updateReviewTracking(review._id, {
      trackingStatus: draftStatus,
      trackingNote: draftNote,
    }),
    onSuccess: ({ review: updatedReview }) => {
      queryClient.setQueriesData({ queryKey: ['reviews'] }, (data) => replaceReviewInCache(data, updatedReview));
      queryClient.setQueriesData({ queryKey: ['tp-reviews'] }, (data) => replaceReviewInCache(data, updatedReview));
      queryClient.setQueriesData({ queryKey: ['tp-reviews-dashboard'] }, (data) => replaceReviewInCache(data, updatedReview));
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['tp-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['tp-reviews-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      queryClient.invalidateQueries({ queryKey: ['tp-summary'] });
      queryClient.invalidateQueries({ queryKey: ['tp-summary-dashboard'] });

      addToast({
        title: 'Seguimiento guardado',
        description: `${updatedReview.authorName}: ${getTrackingMeta(updatedReview.trackingStatus || 'unmanaged').label}`,
        variant: 'success',
      });
    },
    onError: (error) => {
      addToast({
        title: 'Error al guardar seguimiento',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const stars = Math.max(0, Math.min(5, Number(review.rating) || 0));
  const offStars = Math.max(0, 5 - stars);
  const star = '\u2605';
  const showTrackingBadge = currentStatus !== 'unmanaged';

  return (
    <div
      className={`rm-review-item rm-review-followup ${source === 'google' ? 'google' : 'trustpilot'} ${review.isNew ? 'is-new' : ''} ${review.isNegative ? 'is-negative' : ''}`}
    >
      <div className="rm-review-shell">
        <span className={`rm-review-tracking-dot ${trackingMeta.dotClassName}`} aria-hidden="true" />

        <ReviewAvatar
          authorName={review.authorName}
          authorPhotoUrl={review.authorPhotoUrl}
          containerClassName="rm-avatar"
          imageClassName="rm-avatar-img"
        />

        <div className="rm-review-content">
          <button
            type="button"
            className="rm-review-toggle"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
          >
            <div className="rm-review-top">
              <div className="min-w-0">
                <div className="rm-review-author">{review.authorName || 'Anonimo'}</div>

                <div className="rm-review-pill-row">
                  {review.isNegative && <span className="rm-badge neg">Negativa</span>}
                  {review.isNew && <span className="rm-badge new">Nueva</span>}
                  {showTrackingBadge && (
                    <span className={`rm-badge tracking ${trackingMeta.badgeClassName}`}>
                      {trackingMeta.label}
                    </span>
                  )}
                </div>
              </div>

              <div className="rm-review-meta-end">
                <div className="rm-review-time">{timeLabel}</div>
                <span className={`rm-review-caret ${isExpanded ? 'is-open' : ''}`} aria-hidden="true">
                  <ChevronDown size={14} />
                </span>
              </div>
            </div>

            <div className="rm-review-stars-row">
              <span className="rm-review-stars-on">{star.repeat(stars)}</span>
              {offStars > 0 && <span className="rm-review-stars-off">{star.repeat(offStars)}</span>}
            </div>

            {previewText && (
              <div className={`rm-review-text ${isExpanded ? 'line-clamp-none' : 'line-clamp-2'}`}>
                {previewText}
              </div>
            )}
          </button>

          {isExpanded && (
            <div className="rm-review-body-panel">
              {trackingEvents.length > 0 && (
                <div className="rm-tracking-history">
                  <div className="rm-tracking-history-head">
                    Historial de gestion
                    <span className="rm-tracking-history-count">{trackingEvents.length}</span>
                  </div>

                  <div className="rm-tracking-history-list">
                    {trackingEvents.map((event, index) => {
                      const eventMeta = getTrackingMeta(event?.status);

                      return (
                        <div key={`${review._id}-tracking-${index}`} className="rm-tracking-event">
                          <span className={`rm-tracking-event-dot ${eventMeta.dotClassName}`} aria-hidden="true" />

                          <div className="rm-tracking-event-body">
                            <div className="rm-tracking-event-meta">
                              <span>{event?.createdAt ? dayjs(event.createdAt).fromNow() : 'Sin fecha'}</span>
                              <span>|</span>
                              <span>{eventMeta.label}</span>
                            </div>

                            {event?.note && (
                              <div className="rm-tracking-event-note">{event.note}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="rm-tracking-panel">
                <div className="rm-tracking-row">
                  <div className="rm-tracking-label">Estado</div>
                  <div className="rm-tracking-actions">
                    {TRACKING_OPTIONS.map((option) => {
                      const isSelected = draftStatus === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setDraftStatus(option.value)}
                          className={`rm-track-btn ${isSelected ? option.selectedClassName : 'text-brand-50 border-[rgba(89,178,176,0.15)] bg-[#182033]'}`}
                        >
                          <span className={`rm-track-btn-dot ${option.dotClassName}`} aria-hidden="true" />
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rm-tracking-row note">
                  <div className="rm-tracking-label">Nota interna</div>
                  <div className="rm-tracking-note-wrap">
                    <textarea
                      value={draftNote}
                      onChange={(event) => setDraftNote(event.target.value)}
                      className="rm-tracking-note"
                      rows={2}
                      placeholder="Anade una nota: accion tomada, respuesta enviada, proximo paso..."
                    />

                    <button
                      type="button"
                      onClick={() => mutation.mutate()}
                      disabled={!hasChanges || mutation.isPending}
                      className="rm-track-save"
                    >
                      {mutation.isPending ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
