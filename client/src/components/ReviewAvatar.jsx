import { useEffect, useState } from 'react';
import { getReviewAvatarSrc } from '../utils/avatarUrl';

export default function ReviewAvatar({
  authorName,
  authorPhotoUrl,
  containerClassName,
  imageClassName,
  fallbackClassName = '',
}) {
  const initial = authorName?.charAt(0)?.toUpperCase() || '?';
  const src = getReviewAvatarSrc(authorPhotoUrl);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  return (
    <div className={containerClassName}>
      {!hasError && src ? (
        <img
          src={src}
          alt={initial}
          className={imageClassName}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className={fallbackClassName}>{initial}</span>
      )}
    </div>
  );
}
