export function KpiCard({ label, value, sub, icon, accent = 'brand', children }) {
  const accentMap = {
    brand: 'from-brand-300 to-brand-100',
    green: 'from-green-400 to-emerald-300',
    red: 'from-red-500 to-orange-400',
    yellow: 'from-yellow-400 to-amber-300',
  };

  return (
    <div className="card relative overflow-hidden transition-all hover:-translate-y-0.5 hover:border-brand-300/30">
      {/* Top accent line */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accentMap[accent]}`} />

      <div className="text-[11px] uppercase tracking-widest text-gray-400 font-medium mb-3 flex items-center gap-1.5">
        {icon && <span>{icon}</span>}
        {label}
      </div>

      <div
        className={`text-4xl font-extrabold bg-gradient-to-br ${accentMap[accent]} bg-clip-text text-transparent leading-none`}
      >
        {value ?? '—'}
      </div>

      {sub && <div className="text-xs text-gray-500 mt-2">{sub}</div>}
      {children}
    </div>
  );
}
