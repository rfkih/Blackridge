'use client';

import Link from 'next/link';
import { ArrowLeft, Calendar, ChevronRight, Hash } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import { StrategyStatusBadge } from '@/components/strategy/StrategyStatusBadge';
import { LsrParamsForm } from '@/components/strategy/LsrParamsForm';
import { VcbParamsForm } from '@/components/strategy/VcbParamsForm';
import {
  useAccountStrategy,
  useLsrDefaults,
  useLsrParams,
  useRearmKillSwitch,
  useVcbDefaults,
  useVcbParams,
} from '@/hooks/useStrategies';
import { toast } from '@/hooks/useToast';
import { normalizeError } from '@/lib/api/client';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAccounts } from '@/hooks/useAccounts';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { AccountStrategy } from '@/types/strategy';

interface PageProps {
  params: { accountStrategyId: string };
}

const VCB_CODES = new Set(['VCB']);

function isVcbStrategy(code: string): boolean {
  return VCB_CODES.has(code);
}

function formatIso(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso ?? '—';
  return format(new Date(ms), 'yyyy-MM-dd HH:mm:ss');
}

export default function StrategyDetailPage({ params }: PageProps) {
  const { accountStrategyId } = params;
  const { data: strategy, isLoading, isError } = useAccountStrategy(accountStrategyId);
  const { data: accounts = [] } = useAccounts();
  const account = strategy ? accounts.find((a) => a.id === strategy.accountId) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
        <Link
          href="/strategies"
          className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={12} />
          Strategies
        </Link>
        {strategy && (
          <>
            <ChevronRight size={11} className="opacity-60" />
            <span className="font-mono text-[var(--text-secondary)]">
              {account?.label ?? strategy.accountId.slice(0, 8)}
            </span>
            {account && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                {account.exchange}
              </span>
            )}
            <ChevronRight size={11} className="opacity-60" />
            <span className="text-[var(--text-primary)]">
              {strategy.strategyCode} · {strategy.symbol}
            </span>
          </>
        )}
      </div>

      {isError ? (
        <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center">
          <p className="text-sm text-[var(--color-loss)]">Could not load strategy.</p>
        </div>
      ) : isLoading || !strategy ? (
        <StrategyDetailSkeleton />
      ) : (
        <StrategyDetail strategy={strategy} />
      )}
    </div>
  );
}

function StrategyDetail({ strategy }: { strategy: AccountStrategy }) {
  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-panel">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <StrategyBadge code={strategy.strategyCode} />
            <StrategyStatusBadge status={strategy.status} size="md" />
          </div>
          <h1 className="font-display text-2xl text-[var(--text-primary)]">
            {strategy.symbol}
            <span className="ml-2 rounded bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-sm font-normal text-[var(--text-muted)]">
              {strategy.interval}
            </span>
          </h1>
        </div>
        <div className="grid grid-cols-2 gap-4 text-right sm:grid-cols-3">
          <MetaStat label="Allocation" value={`${strategy.capitalAllocationPct.toFixed(1)}%`} />
          <MetaStat label="Priority" value={`#${strategy.priorityOrder}`} />
          <MetaStat
            label="Direction"
            value={
              <span className="font-mono text-sm">
                <span
                  className={cn(
                    strategy.allowLong ? 'text-[var(--color-profit)]' : 'text-[var(--text-muted)]',
                  )}
                >
                  L
                </span>
                <span className="mx-0.5 text-[var(--text-muted)]">/</span>
                <span
                  className={cn(
                    strategy.allowShort ? 'text-[var(--color-loss)]' : 'text-[var(--text-muted)]',
                  )}
                >
                  S
                </span>
              </span>
            }
          />
        </div>
      </header>

      <RiskGuardPanel strategy={strategy} />

      <Tabs defaultValue="parameters" className="space-y-4">
        <TabsList className="bg-[var(--bg-surface)]">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="parameters">Parameters</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab strategy={strategy} />
        </TabsContent>

        <TabsContent value="parameters">
          <ParametersTab strategy={strategy} />
        </TabsContent>
      </Tabs>
    </>
  );
}

/**
 * Drawdown kill-switch state. Two visual states:
 *  - Tripped: prominent loss-tinted banner with reason + re-arm button.
 *  - Armed: muted strip showing the threshold so the user knows the line.
 *
 * Re-arm is a single click — the trip state itself is the safety; clearing
 * it is a deliberate "I've looked at the reason and accept it" action.
 */
function RiskGuardPanel({ strategy }: { strategy: AccountStrategy }) {
  const rearmMut = useRearmKillSwitch();

  const onRearm = async () => {
    try {
      await rearmMut.mutateAsync(strategy.id);
      toast.success({ title: 'Kill-switch re-armed' });
    } catch (err) {
      toast.error({ title: 'Could not re-arm', description: normalizeError(err) });
    }
  };

  if (strategy.isKillSwitchTripped) {
    return (
      <div className="flex flex-wrap items-start gap-3 rounded-lg border border-[var(--color-loss)]/40 bg-[var(--bg-surface)] p-4 shadow-panel">
        <ShieldAlert
          size={18}
          className="mt-0.5 shrink-0 text-[var(--color-loss)]"
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[12px] text-[var(--text-primary)]">
            <span className="font-semibold text-[var(--color-loss)]">
              Kill-switch tripped.
            </span>{' '}
            New entries are blocked for this strategy until re-armed.
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {strategy.killSwitchReason ?? 'Drawdown threshold breached.'}
            {strategy.killSwitchTrippedAt && (
              <>
                {' · tripped '}
                {formatIso(strategy.killSwitchTrippedAt)}
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onRearm}
          disabled={rearmMut.isPending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-bd-subtle bg-bg-elevated px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors duration-fast hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheck size={11} strokeWidth={1.75} />
          {rearmMut.isPending ? 'Re-arming…' : 'Re-arm kill-switch'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-bd-subtle bg-bg-surface px-4 py-2.5">
      <ShieldCheck
        size={14}
        className="shrink-0 text-[var(--text-muted)]"
        aria-hidden="true"
      />
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
        Risk guard armed
      </span>
      <span className="font-mono text-[11px] text-text-secondary">
        DD threshold {strategy.ddKillThresholdPct.toFixed(0)}% · 30d window
      </span>
    </div>
  );
}

function MetaStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      <span className="mt-0.5 font-mono text-sm tabular-nums text-[var(--text-primary)]">
        {value}
      </span>
    </div>
  );
}

function OverviewTab({ strategy }: { strategy: AccountStrategy }) {
  const rows: Array<{ label: string; value: React.ReactNode; icon?: React.ElementType }> = [
    { label: 'Account Strategy ID', value: strategy.id, icon: Hash },
    { label: 'Account ID', value: strategy.accountId, icon: Hash },
    { label: 'Strategy Code', value: strategy.strategyCode },
    { label: 'Symbol', value: strategy.symbol },
    { label: 'Interval', value: strategy.interval },
    { label: 'Status', value: <StrategyStatusBadge status={strategy.status} /> },
    {
      label: 'Capital Allocation',
      value: `${strategy.capitalAllocationPct.toFixed(2)}%`,
    },
    {
      label: 'Max Open Positions',
      value: strategy.maxOpenPositions || '—',
    },
    { label: 'Allow Long', value: strategy.allowLong ? 'Yes' : 'No' },
    { label: 'Allow Short', value: strategy.allowShort ? 'Yes' : 'No' },
    { label: 'Priority Order', value: `#${strategy.priorityOrder}` },
    { label: 'Created', value: formatIso(strategy.createdAt), icon: Calendar },
    { label: 'Updated', value: formatIso(strategy.updatedAt), icon: Calendar },
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-panel">
      <table className="w-full">
        <tbody className="divide-y divide-[var(--border-subtle)]">
          {rows.map(({ label, value, icon: Icon }) => (
            <tr key={label}>
              <td className="w-1/3 px-4 py-2.5 align-top">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[var(--text-muted)]">
                  {Icon && <Icon size={12} />}
                  {label}
                </div>
              </td>
              <td className="px-4 py-2.5 font-mono text-sm text-[var(--text-primary)]">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ParametersTab({ strategy }: { strategy: AccountStrategy }) {
  const isVcb = isVcbStrategy(strategy.strategyCode);
  return isVcb ? (
    <VcbParametersEditor strategyId={strategy.id} strategyCode={strategy.strategyCode} />
  ) : (
    <LsrParametersEditor strategy={strategy} />
  );
}

function LsrParametersEditor({ strategy }: { strategy: AccountStrategy }) {
  const { data: defaults, isLoading: loadingDefaults, isError: defaultsError } = useLsrDefaults();
  const { data: current, isLoading: loadingParams } = useLsrParams(strategy.id);

  if (defaultsError) {
    return (
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--color-loss)]">
        Could not load LSR parameter defaults.
      </div>
    );
  }
  if (loadingDefaults || !defaults || loadingParams) {
    return <ParametersSkeleton />;
  }

  return (
    <LsrParamsForm
      mode="live"
      accountStrategyId={strategy.id}
      strategyCode={strategy.strategyCode}
      initialValues={current ?? {}}
      defaultValues={defaults}
    />
  );
}

function VcbParametersEditor({
  strategyId,
  strategyCode,
}: {
  strategyId: string;
  strategyCode: string;
}) {
  const { data: defaults, isLoading: loadingDefaults, isError: defaultsError } = useVcbDefaults();
  const { data: current, isLoading: loadingParams } = useVcbParams(strategyId);

  if (defaultsError) {
    return (
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-sm text-[var(--color-loss)]">
        Could not load VCB parameter defaults.
      </div>
    );
  }
  if (loadingDefaults || !defaults || loadingParams) {
    return <ParametersSkeleton />;
  }

  return (
    <VcbParamsForm
      mode="live"
      accountStrategyId={strategyId}
      strategyCode={strategyCode}
      initialValues={current ?? {}}
      defaultValues={defaults}
    />
  );
}

function ParametersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

function StrategyDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-9 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
