'use client';

import { useMemo } from 'react';
import type { BacktestEquityPoint } from '@/types/backtest';

interface BacktestMonthlyReturnsProps {
  points: BacktestEquityPoint[];
  isLoading?: boolean;
}

interface MonthlyCell {
  year: number;
  month: number; // 0-11
  pct: number | null;
}

const MONTH_HEAD = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/**
 * Monthly-returns heatmap. Mirrors the design pack's `backtest.html` →
 * `.heatmap` panel — 12-column × N-year grid with cells tinted by month
 * return magnitude, mono numerals, year label on the left.
 *
 * Source: takes the last equity point of each month and computes the
 * percent change from the prior month's last equity. Months with no data
 * render as empty (·) cells.
 */
export function BacktestMonthlyReturns({ points, isLoading }: BacktestMonthlyReturnsProps) {
  const { rows, summary } = useMemo(() => buildHeatmap(points), [points]);

  return (
    <div
      className="mm-card"
      style={{
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h3
        className="font-display"
        style={{
          fontSize: 14,
          fontWeight: 700,
          margin: 0,
          marginBottom: 16,
          color: 'var(--mm-ink-0)',
        }}
      >
        Monthly returns
      </h3>

      {isLoading ? (
        <HeatmapSkeleton />
      ) : rows.length === 0 ? (
        <div
          style={{
            padding: '24px 0',
            fontSize: 12,
            color: 'var(--mm-ink-2)',
            textAlign: 'center',
          }}
        >
          Not enough equity data to compute monthly returns.
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '32px repeat(12, minmax(0, 1fr))',
              gap: 3,
            }}
          >
            <div />
            {MONTH_HEAD.map((m, i) => (
              <div
                key={i}
                className="font-mono"
                style={{
                  fontSize: 10,
                  color: 'var(--mm-ink-2)',
                  textAlign: 'center',
                  paddingBottom: 4,
                }}
              >
                {m}
              </div>
            ))}

            {rows.map((row) => (
              <YearRow key={row.year} year={row.year} cells={row.cells} />
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 14,
              paddingTop: 12,
              borderTop: '1px solid var(--mm-hair)',
              fontSize: 11,
              color: 'var(--mm-ink-2)',
              flexWrap: 'wrap',
            }}
          >
            <span>
              Best:{' '}
              <strong
                className="font-mono"
                style={{ color: 'var(--mm-mint)', fontWeight: 700 }}
              >
                {summary.best ?? '—'}
              </strong>
            </span>
            <span>
              Worst:{' '}
              <strong
                className="font-mono"
                style={{ color: 'var(--mm-dn)', fontWeight: 700 }}
              >
                {summary.worst ?? '—'}
              </strong>
            </span>
            <span>
              Profitable months:{' '}
              <strong style={{ color: 'var(--mm-ink-0)' }}>
                {summary.profitableMonths}/{summary.totalMonths} ({summary.profitablePct}%)
              </strong>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function YearRow({
  year,
  cells,
}: {
  year: number;
  cells: Array<MonthlyCell>;
}) {
  return (
    <>
      <div
        className="font-mono"
        style={{
          fontSize: 11,
          color: 'var(--mm-ink-2)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        &apos;{String(year).slice(2)}
      </div>
      {cells.map((c, i) => (
        <Cell key={`${year}-${i}`} value={c.pct} />
      ))}
    </>
  );
}

function Cell({ value }: { value: number | null }) {
  const { bg, fg, text } = cellStyle(value);
  return (
    <div
      className="font-mono"
      style={{
        aspectRatio: '1',
        borderRadius: 4,
        background: bg,
        color: fg,
        display: 'grid',
        placeItems: 'center',
        fontSize: 9,
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '32px repeat(12, minmax(0, 1fr))',
        gap: 3,
      }}
    >
      {Array.from({ length: 13 * 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            aspectRatio: i % 13 === 0 ? undefined : '1',
            borderRadius: 4,
            background: 'var(--mm-hair)',
            opacity: 0.5,
          }}
        />
      ))}
    </div>
  );
}

// ─── data + colour helpers ───────────────────────────────────────────────

function buildHeatmap(points: BacktestEquityPoint[]): {
  rows: Array<{ year: number; cells: MonthlyCell[] }>;
  summary: {
    best: string | null;
    worst: string | null;
    profitableMonths: number;
    totalMonths: number;
    profitablePct: number;
  };
} {
  if (points.length < 2) {
    return {
      rows: [],
      summary: { best: null, worst: null, profitableMonths: 0, totalMonths: 0, profitablePct: 0 },
    };
  }

  // Take the last equity reading of each calendar month. Indexed by `YYYY-MM`.
  const lastByMonth = new Map<string, { ts: number; equity: number }>();
  for (const p of points) {
    const d = new Date(p.ts);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const prev = lastByMonth.get(key);
    if (!prev || p.ts > prev.ts) {
      lastByMonth.set(key, { ts: p.ts, equity: p.equity });
    }
  }

  // Use the *first* equity value as the seed for the first month's return,
  // so the opening month isn't blank when the run starts mid-month.
  const firstPoint = points[0];

  const sortedKeys = Array.from(lastByMonth.keys()).sort((a, b) => {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return ay !== by ? ay - by : am - bm;
  });

  const monthly: Array<{ year: number; month: number; pct: number }> = [];
  let prevEquity = firstPoint.equity;
  for (const key of sortedKeys) {
    const [year, month] = key.split('-').map(Number);
    const cur = lastByMonth.get(key)!.equity;
    const pct = prevEquity === 0 ? 0 : ((cur - prevEquity) / prevEquity) * 100;
    monthly.push({ year, month, pct });
    prevEquity = cur;
  }

  if (monthly.length === 0) {
    return {
      rows: [],
      summary: { best: null, worst: null, profitableMonths: 0, totalMonths: 0, profitablePct: 0 },
    };
  }

  const minYear = monthly[0].year;
  const maxYear = monthly[monthly.length - 1].year;
  const byYearMonth = new Map<string, number>();
  for (const m of monthly) byYearMonth.set(`${m.year}-${m.month}`, m.pct);

  const rows: Array<{ year: number; cells: MonthlyCell[] }> = [];
  for (let y = minYear; y <= maxYear; y++) {
    const cells: MonthlyCell[] = [];
    for (let m = 0; m < 12; m++) {
      const v = byYearMonth.get(`${y}-${m}`);
      cells.push({ year: y, month: m, pct: v ?? null });
    }
    rows.push({ year: y, cells });
  }

  const profitableMonths = monthly.filter((m) => m.pct > 0).length;
  const totalMonths = monthly.length;
  const best = monthly.reduce((a, b) => (b.pct > a.pct ? b : a));
  const worst = monthly.reduce((a, b) => (b.pct < a.pct ? b : a));
  const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  const fmtMonth = (m: { year: number; month: number; pct: number }) =>
    `${fmtPct(m.pct)} ${monthName(m.month)} '${String(m.year).slice(2)}`;

  return {
    rows,
    summary: {
      best: fmtMonth(best),
      worst: fmtMonth(worst),
      profitableMonths,
      totalMonths,
      profitablePct: totalMonths === 0 ? 0 : Math.round((profitableMonths / totalMonths) * 100),
    },
  };
}

function monthName(m: number): string {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m];
}

function cellStyle(pct: number | null): { bg: string; fg: string; text: string } {
  if (pct == null) {
    return { bg: 'var(--mm-surface-3)', fg: 'var(--mm-ink-3)', text: '·' };
  }
  // Buckets keyed off the design pack's color ramp. Same band edges
  // (~3 / 8) so traders reading the dashboard see the same intensities.
  const a = Math.abs(pct);
  let bg: string;
  let fg = 'rgba(0,0,0,0.78)';
  if (pct >= 8) bg = '#5FCB8B';
  else if (pct >= 3) bg = '#86E0AA';
  else if (pct > 0) bg = '#C8EED5';
  else if (pct === 0) bg = 'var(--mm-surface-3)';
  else if (pct >= -3) bg = '#FCEAEB';
  else if (pct >= -6) bg = '#F8B5B7';
  else bg = '#F08688';
  // Negative bands deeper than -6 read better with a slightly lighter foreground.
  if (a > 6) fg = 'rgba(0,0,0,0.85)';
  return { bg, fg, text: `${pct > 0 ? '+' : ''}${pct.toFixed(0)}` };
}
