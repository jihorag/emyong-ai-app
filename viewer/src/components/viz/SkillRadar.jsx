import { brand, ink, line } from '../../styles/tokens';

export default function SkillRadar({ axes, size = 260, radius = 88, showValues = true }) {
  const n = axes.length;
  if (!n) return null;
  const cx = size / 2;
  const cy = size / 2 + 6;
  const pt = (i, frac) => {
    const a = -90 + i * (360 / n);
    return [cx + radius * frac * Math.cos(a * Math.PI / 180), cy + radius * frac * Math.sin(a * Math.PI / 180)];
  };
  const poly = (key) => axes.map((ax, i) => pt(i, (ax[key] || 0) / 100).join(',')).join(' ');

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <svg width={size} height={size + 10} role="img" aria-label="과목별 진척 다각형">
        {[0.2, 0.4, 0.6, 0.8, 1].map((g, i) => (
          <polygon key={i} points={axes.map((_, j) => pt(j, g).join(',')).join(' ')}
            fill="none" stroke={line.base} strokeWidth={1} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={line.base} strokeWidth={1} />;
        })}
        <polygon points={poly('bench')} fill="none" stroke={ink.faint} strokeWidth={2} strokeDasharray="4 3" />
        <polygon points={poly('mine')} fill={brand.tint} fillOpacity={0.65}
          stroke={brand.primary} strokeWidth={2} strokeLinejoin="round" />
        {axes.map((ax, i) => {
          const [x, y] = pt(i, 1.17);
          return (
            <g key={ax.label}>
              <text x={x} y={showValues ? y - 3 : y + 4} textAnchor="middle"
                fontSize="11" fontWeight="700" fill={ink.body}>{ax.label}</text>
              {showValues && (
                <text x={x} y={y + 11} textAnchor="middle" fontSize="10.5" fontWeight="800" fill={brand.primary}>
                  {ax.mine}<tspan fill={ink.faint}>/{ax.bench}</tspan>
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
