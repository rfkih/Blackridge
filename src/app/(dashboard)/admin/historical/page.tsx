'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  History,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuthHydrated } from '@/store/authStore';
import { useBackfillVcbIndicators, useWarmupHistorical } from '@/hooks/useHistoricalBackfill';
import { normalizeError } from '@/lib/api/client';
import { toast } from '@/hooks/useToast';
import { INTERVALS } from '@/lib/constants';

// Keep symbols a free-text input with a short dropdown of common pairs —
// the backend accepts any Binance symbol, not a hardcoded set.
const COMMON_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = subDays(now, 7);
  // datetime-local format: YYYY-MM-DDTHH:mm — Spring parses this fine as LocalDateTime.
  return {
    from: format(from, "yyyy-MM-dd'T'HH:mm"),
    to: format(now, "yyyy-MM-dd'T'HH:mm"),
  };
}

export default function AdminHistoricalPage() {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  // Wait for persist middleware to rehydrate — initial state is `user: null`,
  // which would flash a redirect for an admin on hard refresh otherwise.
  const hydrated = useAuthHydrated();

  useEffect(() => {
    if (hydrated && !isAdmin) router.replace('/');
  }, [hydrated, isAdmin, router]);

  if (!hydrated) return null;
  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <header>
        <p className="label-caps inline-flex items-center gap-1.5">
          <ShieldCheck size={10} strokeWidth={1.75} />
          Admin
        </p>
        <h1 className="mt-1 font-display text-[24px] font-semibold tracking-tighter text-text-primary">
          Historical data backfill
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-text-secondary">
          Warm up candles + derived features for a symbol, or recompute VCB indicator columns for a
          specific date range. Operations run synchronously on the backend and may take several
          seconds for large ranges.
        </p>
      </header>

      <AdminNotice />

      <div className="grid gap-5 lg:grid-cols-2">
        <WarmupCard />
        <VcbBackfillCard />
      </div>
    </div>
  );
}

// ─── Warmup candles + features ────────────────────────────────────────────────

function WarmupCard() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState<string>('1h');
  const mutation = useWarmupHistorical();

  const canSubmit = symbol.trim().length >= 3 && interval.length > 0 && !mutation.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    mutation.mutate(
      { symbol: symbol.trim().toUpperCase(), interval },
      {
        onSuccess: (data) => {
          toast.success({
            title: 'Warmup completed',
            description: `${data.symbol} · ${data.interval} — ${data.message}`,
          });
        },
        onError: (err) => {
          toast.error({ title: 'Warmup failed', description: normalizeError(err) });
        },
      },
    );
  };

  return (
    <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
      <header className="flex items-center gap-2.5 border-b border-bd-subtle px-4 py-3">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-sm"
          style={{ background: 'var(--accent-glow)', color: 'var(--accent-primary)' }}
        >
          <Database size={14} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-[14px] font-semibold text-text-primary">
            Warmup candles &amp; features
          </h2>
          <p className="text-[11px] text-text-secondary">
            Fetches the last N candles from Binance and recomputes technical features.
          </p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <SymbolField value={symbol} onChange={setSymbol} />
        <IntervalField value={interval} onChange={setInterval} />

        <div className="flex items-center justify-between pt-2">
          <ResultStatus
            isPending={mutation.isPending}
            isSuccess={mutation.isSuccess}
            errorText={mutation.isError ? normalizeError(mutation.error) : null}
            successText={
              mutation.data ? `${mutation.data.symbol} · ${mutation.data.interval}` : null
            }
          />
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
            {mutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Waves size={14} strokeWidth={1.75} />
            )}
            Run warmup
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── VCB indicator backfill (date-bounded) ────────────────────────────────────

function VcbBackfillCard() {
  const defaults = useMemo(defaultDateRange, []);
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setInterval] = useState<string>('1h');
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const mutation = useBackfillVcbIndicators();

  const rangeError = useMemo(() => {
    if (!from || !to) return 'Pick both start and end.';
    if (new Date(from).getTime() >= new Date(to).getTime()) return 'End must be after start.';
    return null;
  }, [from, to]);

  const canSubmit =
    symbol.trim().length >= 3 && interval.length > 0 && !rangeError && !mutation.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    // Spring @RequestParam LocalDateTime expects `YYYY-MM-DDTHH:mm(:ss)` — the
    // datetime-local value already matches; we append `:00` so the seconds slot
    // is never omitted.
    const toIso = (v: string) => (v.length === 16 ? `${v}:00` : v);
    mutation.mutate(
      {
        symbol: symbol.trim().toUpperCase(),
        interval,
        from: toIso(from),
        to: toIso(to),
      },
      {
        onSuccess: (data) => {
          toast.success({
            title: 'VCB indicators backfilled',
            description: `${data.recordsUpdated} records updated · ${data.symbol} ${data.interval}`,
          });
        },
        onError: (err) => {
          toast.error({ title: 'Backfill failed', description: normalizeError(err) });
        },
      },
    );
  };

  return (
    <section className="overflow-hidden rounded-md border border-bd-subtle bg-bg-surface">
      <header className="flex items-center gap-2.5 border-b border-bd-subtle px-4 py-3">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-sm"
          style={{
            background: 'rgba(245,166,35,0.12)',
            color: 'var(--color-warning)',
          }}
        >
          <History size={14} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="font-display text-[14px] font-semibold text-text-primary">
            Backfill VCB indicators
          </h2>
          <p className="text-[11px] text-text-secondary">
            Recomputes VCB compression/breakout columns across a date range.
          </p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <SymbolField value={symbol} onChange={setSymbol} />
        <IntervalField value={interval} onChange={setInterval} />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vcb-from" className="label-caps">
              From
            </Label>
            <Input
              id="vcb-from"
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vcb-to" className="label-caps">
              To
            </Label>
            <Input
              id="vcb-to"
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        {rangeError && (
          <p className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-loss)]">
            <AlertTriangle size={11} /> {rangeError}
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          <ResultStatus
            isPending={mutation.isPending}
            isSuccess={mutation.isSuccess}
            errorText={mutation.isError ? normalizeError(mutation.error) : null}
            successText={mutation.data ? `${mutation.data.recordsUpdated} rows updated` : null}
          />
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-1.5">
            {mutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <History size={14} strokeWidth={1.75} />
            )}
            Run backfill
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Shared field renderers ───────────────────────────────────────────────────

function SymbolField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="label-caps">
        Symbol
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder="BTCUSDT"
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <Select value={COMMON_SYMBOLS.includes(value) ? value : ''} onValueChange={onChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Common…" />
          </SelectTrigger>
          <SelectContent>
            {COMMON_SYMBOLS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function IntervalField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="label-caps">Interval</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="font-mono">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INTERVALS.map((i) => (
            <SelectItem key={i} value={i} className="font-mono">
              {i}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ResultStatus({
  isPending,
  isSuccess,
  errorText,
  successText,
}: {
  isPending: boolean;
  isSuccess: boolean;
  errorText: string | null;
  successText: string | null;
}) {
  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary">
        <Loader2 size={11} className="animate-spin" />
        Running…
      </span>
    );
  }
  if (errorText) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-loss)]">
        <AlertTriangle size={11} />
        {errorText}
      </span>
    );
  }
  if (isSuccess && successText) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--color-profit)]">
        <CheckCircle2 size={11} />
        {successText}
      </span>
    );
  }
  return <span aria-hidden="true" />;
}

function AdminNotice() {
  return (
    <div
      className="flex items-start gap-2.5 rounded-md border px-3 py-2.5"
      style={{
        borderColor: 'rgba(78,158,255,0.35)',
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <ShieldAlert
        size={14}
        strokeWidth={1.75}
        className="mt-0.5 shrink-0 text-[var(--color-info)]"
        aria-hidden="true"
      />
      <div className="text-[12px] leading-relaxed text-text-secondary">
        <span className="font-semibold text-text-primary">Admin action</span> — backfills overwrite
        derived data on the primary market-data store. Avoid running wide ranges during market hours
        if the feature pipeline is live.
      </div>
    </div>
  );
}
