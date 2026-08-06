/**
 * Velocímetro tipo auto (semicírculo + aguja) para métricas de rendimiento.
 * value: 0-100 (porcentaje relativo al mejor del período).
 */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = startAngle - endAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const HUES = {
  indigo: { track: "#dfe3ea", fill: "#4338ca", needle: "#312e81" },
  emerald: { track: "#dfe3ea", fill: "#059669", needle: "#065f46" },
} as const;

export function Velocimetro({
  value, label, displayValue, hue = "indigo", size = 128,
}: {
  value: number;           // 0-100
  label: string;
  displayValue: string;
  hue?: keyof typeof HUES;
  size?: number;
}) {
  const v = Math.max(0, Math.min(100, value));
  const c = HUES[hue];
  const cx = 100, cy = 96, r = 76;
  const needleAngle = 180 - (v / 100) * 180;
  const tip = polarToCartesian(cx, cy, r - 14, needleAngle);

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <svg viewBox="0 0 200 120" width={size} height={size * 0.6} role="img" aria-label={`${label}: ${displayValue}`}>
        {/* Track de fondo */}
        <path d={describeArc(cx, cy, r, 180, 0)} fill="none" stroke={c.track} strokeWidth={14} strokeLinecap="round" className="dark:opacity-30" />
        {/* Marcas de graduación cada 25% */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const a = 180 - (tick / 100) * 180;
          const p1 = polarToCartesian(cx, cy, r + 10, a);
          const p2 = polarToCartesian(cx, cy, r + 16, a);
          return <line key={tick} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="currentColor" strokeWidth={2} className="text-slate-300 dark:text-slate-600" />;
        })}
        {/* Arco de valor */}
        {v > 0 && (
          <path d={describeArc(cx, cy, r, 180, needleAngle)} fill="none" stroke={c.fill} strokeWidth={14} strokeLinecap="round" />
        )}
        {/* Aguja */}
        <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke={c.needle} strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={7} fill={c.needle} />
      </svg>
      <p className="text-lg font-extrabold text-slate-800 dark:text-slate-100 -mt-1 tabular-nums">{displayValue}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
