'use client';

import type { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeployBestCarry, usePlanBestCarry } from '@/hooks/useCarryPairs';
import { useCurrencyFormatter } from '@/hooks/useCurrency';

/**
 * One-click "Activate best carry": previews the single highest-funding pair the account can open
 * (sized to free capital) and, on confirm, opens it LIVE. The preview re-fetches every time the
 * dialog opens (funding moves), so the operator always confirms against a fresh rate. The open is
 * atomic server-side — a leg failure rolls back, so nothing is ever left half-hedged.
 */
export function CarryBestDialog({
  accountId,
  open,
  onOpenChange,
}: {
  accountId: string | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const formatCurrency = useCurrencyFormatter();
  const { data: plan, isLoading, isError } = usePlanBestCarry(accountId, open);
  const deploy = useDeployBestCarry();

  const hasCandidate = Boolean(plan?.hasCandidate);
  const noCandidate = plan != null && !plan.hasCandidate;
  const deployFailed = deploy.data?.opened != null && deploy.data.opened.status !== 'OPEN';
  const base = (plan?.symbol ?? '').replace('USDT', '');

  function onActivate() {
    if (!accountId) return;
    deploy.mutate(accountId, {
      onSuccess: (res) => {
        if (res.opened?.status === 'OPEN') onOpenChange(false); // opened — close; book refetches
      },
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) deploy.reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>⚡ Activate best carry</DialogTitle>
          <DialogDescription>
            Opens the single highest-funding delta-neutral pair available, sized to your free USDT.
          </DialogDescription>
        </DialogHeader>

        {!accountId ? (
          <Msg>Select an account to find its best carry.</Msg>
        ) : isLoading ? (
          <Msg>Scanning funding rates…</Msg>
        ) : isError ? (
          <Msg tone="loss">Couldn’t read funding right now — try again in a moment.</Msg>
        ) : noCandidate ? (
          <Msg tone="warning">{plan?.reason ?? 'No deployable carry right now.'}</Msg>
        ) : hasCandidate ? (
          <div className="flex flex-col gap-3">
            <div
              className="rounded-lg border p-4"
              style={{ borderColor: 'color-mix(in oklab, var(--mm-up) 32%, var(--mm-hair))' }}
            >
              <div className="flex items-baseline justify-between">
                <span style={{ fontSize: 18, fontWeight: 700 }}>{plan?.symbol}</span>
                <span
                  style={{ fontFamily: 'var(--font-num)', fontSize: 20, color: 'var(--mm-up)' }}
                >
                  ~{(plan?.fundingAprPct ?? 0).toFixed(1)}%/yr
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--mm-ink-3)' }}>
                annualized funding — the carry edge (highest available)
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Notional" value={formatCurrency(plan?.estNotionalUsd ?? 0)} />
                <Stat label="Leverage" value={`${plan?.leverage ?? 1}×`} />
                <Stat label="Free USDT" value={formatCurrency(plan?.freeUsdt ?? 0)} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--mm-ink-2)' }}>
              Opens a <strong>live</strong> pair — buys {base} spot and shorts the perp
              (delta-neutral), auto-funding the perp margin from your free USDT.
            </p>
            {deployFailed && (
              <Msg tone="loss">
                Open didn’t complete ({deploy.data?.opened?.status}) — funding may have flipped or
                the size fell below the exchange minimum. Nothing was left half-open.
              </Msg>
            )}
          </div>
        ) : null}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-md border border-[var(--border-default)] px-4 text-sm text-text-secondary"
          >
            {hasCandidate ? 'Cancel' : 'Close'}
          </button>
          {hasCandidate && (
            <button
              type="button"
              onClick={onActivate}
              disabled={deploy.isPending}
              className="h-9 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--accent-primary)' }}
            >
              {deploy.isPending ? 'Activating…' : '⚡ Activate live'}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Msg({ children, tone }: { children: ReactNode; tone?: 'loss' | 'warning' }) {
  const color =
    tone === 'loss'
      ? 'var(--mm-dn)'
      : tone === 'warning'
        ? 'var(--color-warning)'
        : 'var(--mm-ink-2)';
  return <div style={{ padding: '8px 2px', fontSize: 13, color }}>{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--mm-hair)] p-2">
      <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--mm-ink-3)' }}>
        {label}
      </div>
      <div style={{ marginTop: 2, fontFamily: 'var(--font-num)', fontSize: 14 }}>{value}</div>
    </div>
  );
}
