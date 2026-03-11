import { Search, X } from 'lucide-react';

export function ReviewFilters({ filters, onChange }) {
  const starOptions = [1, 2, 3, 4, 5];

  function set(key, value) {
    onChange({ ...filters, [key]: value, page: 1 });
  }

  function reset() {
    onChange({ page: 1, limit: 20 });
  }

  const hasFilters = filters.rating || filters.onlyNew || filters.onlyNegative || filters.search;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar reseñas…"
          value={filters.search || ''}
          onChange={(e) => set('search', e.target.value)}
          className="pl-8 pr-3 py-1.5 text-xs bg-[#1a2235] border border-[rgba(89,178,176,0.15)]
            rounded-lg text-brand-50 placeholder:text-gray-600 focus:outline-none
            focus:border-brand-300/40 w-44"
        />
      </div>

      {/* Stars filter */}
      <div className="flex gap-1">
        {starOptions.map((s) => (
          <button
            key={s}
            onClick={() => set('rating', filters.rating === s ? undefined : s)}
            className={`w-7 h-7 rounded-lg text-xs font-semibold border transition-all ${
              filters.rating === s
                ? 'bg-yellow-400/20 border-yellow-400/40 text-yellow-300'
                : 'bg-[#1a2235] border-[rgba(89,178,176,0.15)] text-gray-400 hover:border-brand-300/30'
            }`}
          >
            {s}★
          </button>
        ))}
      </div>

      {/* Toggle: new only */}
      <button
        onClick={() => set('onlyNew', !filters.onlyNew)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          filters.onlyNew
            ? 'bg-brand-100/15 border-brand-100/30 text-brand-100'
            : 'bg-[#1a2235] border-[rgba(89,178,176,0.15)] text-gray-400 hover:border-brand-300/30'
        }`}
      >
        Solo nuevas
      </button>

      {/* Toggle: negative only */}
      <button
        onClick={() => set('onlyNegative', !filters.onlyNegative)}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          filters.onlyNegative
            ? 'bg-red-500/15 border-red-500/30 text-red-400'
            : 'bg-[#1a2235] border-[rgba(89,178,176,0.15)] text-gray-400 hover:border-brand-300/30'
        }`}
      >
        Solo negativas
      </button>

      {/* Reset */}
      {hasFilters && (
        <button
          onClick={reset}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-all"
        >
          <X size={12} /> Limpiar
        </button>
      )}
    </div>
  );
}
