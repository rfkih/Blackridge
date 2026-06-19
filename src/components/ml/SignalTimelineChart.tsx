'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format } from 'date-fns';
import { useSignalDailyCounts } from '@/lib/api/ml';
import { Skeleton } from '@/components/ui/skeleton';

interface TooltipPayloadItem {
  value: number;
}

// Recharts paints axis ticks/lines as SVG attributes, which do NOT resolve CSS
// var(). Read the resolved theme tokens at runtime and re-read whenever the
// active theme flips, so the chart tracks light/dark like the rest of the app
// instead of staying pinned to dark-tuned hex.
function useChartColors() {
  const [c, setC] = useState({
    tick: '#8c95a2',
    line: 'rgba(140,149,162,0.25)',
    bar: '#3b82f6',
    cursor: 'rgba(140,149,162,0.12)',
  });
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const muted = s.getPropertyValue('--text-muted').trim();
      const border = s.getPropertyValue('--border-default').trim();
      const info = s.getPropertyValue('--color-info').trim();
      setC({
        tick: muted || '#8c95a2',
        line: border || 'rgba(140,149,162,0.25)',
        bar: info || '#3b82f6',
        cursor: border || 'rgba(140,149,162,0.12)',
      });
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => obs.disconnect();
  }, []);
  return c;
}

function TooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-bd-subtle bg-bg-elevated px-3 py-2 text-xs shadow-float">
      <p className="font-medium text-text-primary">{label}</p>
      <p className="font-mono tabular-nums text-text-secondary">
        {payload[0].value} fire{payload[0].value === 1 ? '' : 's'}
      </p>
    </div>
  );
}

export function SignalTimelineChart({ signalId }: { signalId: string }) {
  const { data, isLoading } = useSignalDailyCounts(signalId, 30);
  const c = useChartColors();

  if (isLoading) {
    return <Skeleton className="h-44 w-full rounded-md" />;
  }

  const days = data?.days ?? [];
  if (days.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-md border border-dashed border-bd-subtle text-sm text-text-muted">
        No firings in the last 30 days.
      </div>
    );
  }

  const chartData = days.map((d) => ({
    date: format(new Date(d.date), 'MMM d'),
    count: d.fireCount,
  }));

  return (
    <div className="rounded-md border border-bd-subtle bg-bg-elevated p-4">
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-text-muted">
        Fires per day (last 30d)
      </h3>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: c.tick, fontSize: 13 }}
              tickLine={{ stroke: c.line }}
              axisLine={{ stroke: c.line }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: c.tick, fontSize: 13 }}
              tickLine={{ stroke: c.line }}
              axisLine={{ stroke: c.line }}
              allowDecimals={false}
            />
            <Tooltip cursor={{ fill: c.cursor }} content={<TooltipContent />} />
            <Bar dataKey="count" fill={c.bar} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
