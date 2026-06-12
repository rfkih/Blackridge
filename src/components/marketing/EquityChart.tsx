/**
 * Pure-SVG equity-curve chart for the marketing factsheet cards — solid
 * line for the strategy, dashed for the buy-and-hold benchmark, mono
 * axis labels. Server-renderable (no client JS).
 */
export function EquityChart({
  hedge,
  bh,
  height = 180,
}: {
  hedge: number[];
  bh: number[];
  height?: number;
}) {
  if (!hedge.length) return null;
  const w = 600;
  const h = height;
  const pl = 40;
  const pr = 16;
  const pt = 14;
  const pb = 24;
  const all = [...hedge, ...bh];
  const min = Math.min(...all) * 0.97;
  const max = Math.max(...all) * 1.03;
  const toPath = (data: number[]) => {
    const pts = data.map((v, i) => ({
      x: pl + (i / (data.length - 1)) * (w - pl - pr),
      y: pt + (1 - (v - min) / (max - min)) * (h - pt - pb),
    }));
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
  };
  const hedgePath = toPath(hedge);
  const bhPath = toPath(bh);
  const lastX = pl + (w - pl - pr);
  const area = `${hedgePath} L ${lastX.toFixed(2)} ${(h - pb).toFixed(2)} L ${pl} ${(h - pb).toFixed(2)} Z`;
  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const v = min + (max - min) * (i / (yTicks - 1));
    const y = pt + (1 - i / (yTicks - 1)) * (h - pt - pb);
    return { v, y };
  });
  const xMarks = [
    { idx: 0, label: "'22" },
    { idx: Math.floor(hedge.length * 0.5), label: "'24" },
    { idx: hedge.length - 1, label: "'26" },
  ];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      preserveAspectRatio="xMidYMid meet"
      className="qp-fact-svg"
      aria-hidden="true"
    >
      {yLabels.map(({ v, y }, i) => (
        <g key={i}>
          <line x1={pl} y1={y} x2={w - pr} y2={y} className="qp-chart-grid" />
          <text x={pl - 6} y={y + 3} textAnchor="end" className="qp-chart-axis">
            ${(v / 1000).toFixed(0)}k
          </text>
        </g>
      ))}
      <path d={area} className="qp-chart-area" />
      <path
        d={bhPath}
        fill="none"
        stroke="var(--qp-ink-muted)"
        strokeWidth={1.25}
        strokeDasharray="3 3"
        opacity={0.7}
      />
      <path d={hedgePath} className="qp-chart-line" />
      {xMarks.map((m, i) => (
        <text
          key={i}
          x={pl + (m.idx / (hedge.length - 1)) * (w - pl - pr)}
          y={h - 8}
          textAnchor="middle"
          className="qp-chart-axis"
        >
          {m.label}
        </text>
      ))}
    </svg>
  );
}
