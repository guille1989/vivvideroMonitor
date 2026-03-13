const PROXIED_HOST_SUFFIXES = ['googleusercontent.com'];

function shouldProxyAvatar(hostname) {
  return PROXIED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}

export function getReviewAvatarSrc(authorPhotoUrl) {
  if (!authorPhotoUrl) return null;

  try {
    const parsedUrl = new URL(authorPhotoUrl);
    if (parsedUrl.protocol !== 'https:') return null;

    if (shouldProxyAvatar(parsedUrl.hostname)) {
      return `/api/media/avatar?url=${encodeURIComponent(parsedUrl.toString())}`;
    }

    return parsedUrl.toString();
  } catch (_error) {
    return null;
  }
}
