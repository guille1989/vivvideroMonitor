import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';
import { StarRating } from './ui/StarRating';
import ReviewAvatar from './ReviewAvatar';

dayjs.extend(relativeTime);
dayjs.locale('es');

export function ReviewCard({ review }) {
  const colors = ['from-brand-500 to-brand-300', 'from-purple-500 to-pink-400', 'from-amber-500 to-yellow-300'];
  const colorIdx = review.authorName?.charCodeAt(0) % colors.length;

  return (
    <div
      className={`flex gap-3 p-4 rounded-xl border transition-all
        ${review.isNegative
          ? 'border-red-500/25 bg-red-950/10'
          : review.isNew
          ? 'border-brand-100/25 bg-brand-100/5'
          : 'border-[rgba(89,178,176,0.1)] bg-[#1a2235]'
        }`}
    >
      {/* Avatar */}
      <ReviewAvatar
        authorName={review.authorName}
        authorPhotoUrl={review.authorPhotoUrl}
        containerClassName={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm text-white bg-gradient-to-br ${colors[colorIdx]}`}
        imageClassName="w-9 h-9 rounded-full object-cover"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-brand-50">{review.authorName}</span>
            {review.isNew && <span className="badge-new">Nuevo</span>}
            {review.isNegative && <span className="badge-negative">Negativa</span>}
          </div>
          <span className="text-[11px] text-gray-500 flex-shrink-0">
            {review.relativeTimeDescription ||
              (review.syncedAt ? dayjs(review.syncedAt).fromNow() : '—')}
          </span>
        </div>

        <StarRating rating={review.rating} size={13} />

        {review.text && (
          <p className="text-xs text-gray-400 mt-1.5 leading-relaxed line-clamp-3">
            {review.text}
          </p>
        )}
      </div>
    </div>
  );
}
