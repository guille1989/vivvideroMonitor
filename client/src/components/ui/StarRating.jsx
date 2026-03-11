export function StarRating({ rating, size = 14 }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          style={{ fontSize: size }}
          className={star <= rating ? 'text-yellow-400' : 'text-gray-600'}
        >
          ★
        </span>
      ))}
    </span>
  );
}
