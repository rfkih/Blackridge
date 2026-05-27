'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { fetchCandles } from '@/lib/api/market';
import type { CandleData } from '@/types/market';

const REGIME_SYMBOL = 'BTCUSDT';
const REGIME_INTERVAL = '4h' as const;
const REGIME_LOOKBACK = 60;

export function MarketContextBar() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <RegimeCard />
      <SentimentCard />
    </div>
  );
}

function RegimeCard() {
  const query = useQuery({
    queryKey: ['market-context', 'regime', REGIME_SYMBOL, REGIME_INTERVAL],
    queryFn: () => fetchCandles(REGIME_SYMBOL, REGIME_INTERVAL, REGIME_LOOKBACK),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
    retry: 1,
  });

  const verdict = useMemo(() => classifyRegime(query.data), [query.data]);

  return (
    <ContextCard
      eyebrow="Market regime"
      source="BTC · 4h · last 60 bars"
      loading={query.isLoading && !query.data}
      error={query.isError}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2">
          <RegimeIcon tone={verdict.tone} />
          <span
            className="font-display text-[22px] font-bold tracking-[-0.015em]"
            style={{ color: 'var(--text-primary)' }}
          >
            {verdict.label}
          </span>
        </div>
        <span
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: toneColor(verdict.tone) }}
        >
          {verdict.tag}
        </span>
      </div>

      {}
      <ScaleBar
        position={verdict.position}
        leftLabel="Downtrend"
        rightLabel="Uptrend"
        tone={verdict.tone}
      />

      <div
        className="font-mono text-[11px] tabular-nums"
        style={{ color: 'var(--text-muted)' }}
      >
        {verdict.detail}
      </div>
    </ContextCard>
  );
}

interface RegimeVerdict {
  label: string;
  tag: string;
  tone: Tone;
  position: number;
  detail: string;
}

function classifyRegime(candles: CandleData[] | undefined): RegimeVerdict {
  if (!candles || candles.length < 30) {
    return { label: '—', tag: 'No data', tone: 'neutral', position: 0, detail: 'Waiting on candles' };
  }
  const window = candles.slice(-30);
  const first = window[0]!.close;
  const last = window[window.length - 1]!.close;
  const pctChange = ((last - first) / first) * 100;

  const sampleVol = avgNormRange(window);
  const baselineVol = avgNormRange(candles);
  const volRatio = baselineVol > 0 ? sampleVol / baselineVol : 1;

  const position = Math.max(-1, Math.min(1, pctChange / 5));

  let label: string;
  let tag: string;
  let tone: Tone;

  if (pctChange >= 5) {
    label = 'Strong uptrend';
    tag = 'Risk on';
    tone = 'profit';
  } else if (pctChange >= 1.5) {
    label = 'Uptrend';
    tag = 'Bias long';
    tone = 'profit';
  } else if (pctChange <= -5) {
    label = 'Strong downtrend';
    tag = 'Risk off';
    tone = 'loss';
  } else if (pctChange <= -1.5) {
    label = 'Downtrend';
    tag = 'Bias short';
    tone = 'loss';
  } else if (volRatio > 1.25) {
    label = 'Chop';
    tag = 'High vol, no trend';
    tone = 'warning';
  } else {
    label = 'Range';
    tag = 'Mean-reverting';
    tone = 'neutral';
  }

  const detail = `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}% · 5d  ·  vol ${volRatio.toFixed(2)}× baseline`;
  return { label, tag, tone, position, detail };
}

function avgNormRange(candles: CandleData[]): number {
  if (!candles.length) return 0;
  const sum = candles.reduce((acc, c) => acc + (c.high - c.low) / Math.max(c.close, 1e-9), 0);
  return sum / candles.length;
}

function RegimeIcon({ tone }: { tone: Tone }) {
  const props = { size: 18, strokeWidth: 2 } as const;
  const color = toneColor(tone);
  if (tone === 'profit') return <ArrowUpRight {...props} style={{ color }} />;
  if (tone === 'loss') return <ArrowDownRight {...props} style={{ color }} />;
  if (tone === 'warning') return <Activity {...props} style={{ color }} />;
  return <Minus {...props} style={{ color }} />;
}

interface SentimentSnapshot {
  value: number;
  yesterday: number;
  asOf: string;
}

interface AlternativeMeEntry {
  value: string;
  value_classification: string;
  timestamp: string;
}

interface AlternativeMeResponse {
  data: AlternativeMeEntry[];
}

function useSentiment(): {
  snapshot: SentimentSnapshot | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: ['market-sentiment', 'fng'],
    queryFn: async (): Promise<SentimentSnapshot> => {
      const res = await fetch('https://api.alternative.me/fng/?limit=2');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AlternativeMeResponse;
      const [today, yesterday] = json.data;
      if (!today) throw new Error('No data from alternative.me');
      return {
        value: Number(today.value),
        yesterday: Number(yesterday?.value ?? today.value),
        asOf: new Date(Number(today.timestamp) * 1000).toISOString().slice(0, 10),
      };
    },
    staleTime: 60 * 60_000,
    retry: 1,
  });
  return { snapshot: query.data, isLoading: query.isLoading, isError: query.isError };
}

function SentimentCard() {
  const { snapshot, isLoading, isError } = useSentiment();
  const verdict = snapshot ? classifySentiment(snapshot.value) : null;
  const delta = snapshot ? snapshot.value - snapshot.yesterday : 0;

  return (
    <ContextCard
      eyebrow="Market sentiment"
      source="Fear & Greed · alternative.me · daily"
      loading={isLoading}
      error={isError}
    >
      {snapshot && verdict && (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span
                className="font-display text-[28px] font-bold tabular-nums leading-none"
                style={{ color: toneColor(verdict.tone), letterSpacing: '-0.02em' }}
              >
                {snapshot.value}
              </span>
              <span
                className="font-display text-[18px] font-semibold"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
              >
                {verdict.label}
              </span>
            </div>
            <span
              className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{
                color: verdict.tone === 'warning' ? toneColor('warning') : 'var(--text-muted)',
              }}
            >
              {verdict.tag}
            </span>
          </div>

          <ScaleBar
            position={(snapshot.value - 50) / 50}
            leftLabel="Fear"
            rightLabel="Greed"
            tone={verdict.tone}
          />

          <div
            className="font-mono text-[11px] tabular-nums"
            style={{ color: 'var(--text-muted)' }}
          >
            {delta >= 0 ? '+' : ''}
            {delta.toFixed(0)} vs yesterday · as of {snapshot.asOf}
          </div>
        </>
      )}
    </ContextCard>
  );
}

interface SentimentVerdict {
  label: string;
  tag: string;
  tone: Tone;
}

function classifySentiment(value: number): SentimentVerdict {
  if (value <= 24) return { label: 'Extreme fear', tag: 'Contrarian long', tone: 'loss' };
  if (value <= 49) return { label: 'Fear', tag: 'Cautious', tone: 'loss' };
  if (value <= 54) return { label: 'Neutral', tag: 'Mixed', tone: 'neutral' };
  if (value <= 74) return { label: 'Greed', tag: 'Crowded long', tone: 'profit' };
  return { label: 'Extreme greed', tag: 'Reduce exposure', tone: 'warning' };
}

type Tone = 'profit' | 'loss' | 'warning' | 'neutral';

function toneColor(tone: Tone): string {
  switch (tone) {
    case 'profit':
      return 'var(--color-profit)';
    case 'loss':
      return 'var(--color-loss)';
    case 'warning':
      return 'var(--color-warning)';
    default:
      return 'var(--text-muted)';
  }
}

interface ContextCardProps {
  eyebrow: string;
  source: string;
  loading: boolean;
  error: boolean;
  children: React.ReactNode;
}

function ContextCard({ eyebrow, source, loading, error, children }: ContextCardProps) {
  return (
    <div
      className="mm-card"
      style={{
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--text-muted)' }}
        >
          {eyebrow}
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.06em]"
          style={{ color: 'var(--text-muted)', opacity: 0.7 }}
        >
          {source}
        </span>
      </div>
      {loading ? (
        <div
          className="h-[60px] animate-pulse rounded-md"
          style={{ background: 'var(--bg-hover)' }}
          aria-hidden="true"
        />
      ) : error ? (
        <div
          className="text-[12px]"
          style={{ color: 'var(--text-muted)' }}
        >
          Unable to compute right now.
        </div>
      ) : (
        children
      )}
    </div>
  );
}

interface ScaleBarProps {
  position: number;
  leftLabel: string;
  rightLabel: string;
  tone: Tone;
}

function ScaleBar({ position, leftLabel, rightLabel, tone }: ScaleBarProps) {
  const pct = ((Math.max(-1, Math.min(1, position)) + 1) / 2) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--bg-hover)' }}
      >
        {}
        <div
          aria-hidden="true"
          className="absolute top-0 h-full w-px"
          style={{ left: '50%', background: 'var(--border-default)' }}
        />
        <div
          aria-hidden="true"
          className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${pct}%`,
            background: toneColor(tone),
            boxShadow: '0 0 0 2px var(--bg-elevated)',
          }}
        />
      </div>
      <div
        className="flex justify-between font-mono text-[9px] uppercase tracking-[0.08em]"
        style={{ color: 'var(--text-muted)', opacity: 0.7 }}
      >
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
