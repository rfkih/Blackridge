'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TopStrategiesSection } from '@/components/leaderboard/TopStrategiesSection';
import { BacktestLeaderboardSection } from '@/components/leaderboard/BacktestLeaderboardSection';
import { PaperLeaderboardSection } from '@/components/leaderboard/PaperLeaderboardSection';
import { DeployStrategyDialog } from '@/components/leaderboard/DeployStrategyDialog';
import {
  useBacktestLeaderboard,
  useDeployStrategy,
  usePapersLeaderboard,
  useTopStrategies,
} from '@/hooks/useLeaderboard';
import { useActiveAccount } from '@/hooks/useAccounts';
import { useLeaderboardStream } from '@/hooks/useLeaderboardStream';
import { isHedging } from '@/lib/strategyKind';
import type { LeaderboardEntry } from '@/types/leaderboard';

const LIMIT_OPTIONS = [5, 10, 25] as const;
const BACKTEST_LIMIT = 20;
const PAPERS_LIMIT = 25;

export default function LeaderboardPage() {
  const [limit, setLimit] = useState<number>(10);
  const { accounts, scopedAccountId, activeAccount } = useActiveAccount();
  const {
    data: entries = [],
    isLoading,
    isError,
    refetch,
  } = useTopStrategies(limit, scopedAccountId ?? undefined);
  const deployMutation = useDeployStrategy();
  const [deployTarget, setDeployTarget] = useState<LeaderboardEntry | null>(null);

  const backtest = useBacktestLeaderboard(BACKTEST_LIMIT);
  const papers = usePapersLeaderboard(PAPERS_LIMIT);

  // Live-refresh the ranked list when an approval is created / revoked.
  useLeaderboardStream();

  // When a single account is active, scope every tab to that account's TYPE:
  // a HEDGING account sees only hedging strategies, a TRADING account only
  // trading ones. In "All" mode (activeAccount == null) show everything.
  // A strategy is "hedging" iff its kind is HEDGING; TRADING/null counts as trading.
  const acctType = activeAccount?.accountType;
  const matchesAcctType = (kind?: string | null): boolean =>
    acctType === undefined
      ? true
      : acctType === 'HEDGING'
        ? isHedging(kind)
        : !isHedging(kind);

  // Conviction tab — filter the ranked rows by the active account's type.
  const convictionEntries =
    acctType === undefined ? entries : entries.filter((e) => matchesAcctType(e.strategyKind));

  // Backtest tab — the payload already splits trading vs hedging. Zero out the
  // non-matching set (and its counts) so the shown/qualifying labels stay honest.
  const backtestTrading = backtest.data?.entries ?? [];
  const backtestHedging = backtest.data?.hedgingEntries ?? [];
  const showBacktestTrading = acctType !== 'HEDGING';
  const showBacktestHedging = acctType !== 'TRADING';

  // Research papers — classify by the paper's own strategy_kind.
  const paperItems = papers.data?.items ?? [];
  const filteredPapers =
    acctType === undefined ? paperItems : paperItems.filter((p) => matchesAcctType(p.strategy_kind));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Top strategies"
        title="Leaderboard"
        description="The best approved strategies ranked by risk-adjusted backtest performance. One-click deploy any of them onto your account — the winning parameters come along for the ride."
        actions={
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] uppercase tracking-wider text-[var(--text-muted)]">
              Show
            </span>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="w-20 font-mono tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)} className="font-mono tabular-nums">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <p className="-mt-2 text-[14px] text-[var(--text-muted)]">
        The funnel: <span className="text-[var(--text-secondary)]">Conviction</span> = deployable ·{' '}
        <span className="text-[var(--text-secondary)]">Backtest &amp; Papers</span> = candidates you
        can submit for approval.
      </p>

      <Tabs defaultValue="conviction">
        <TabsList className="bg-[var(--bg-elevated)]">
          <TabsTrigger value="conviction">Conviction</TabsTrigger>
          <TabsTrigger value="backtest">Backtest</TabsTrigger>
          <TabsTrigger value="papers">Research papers</TabsTrigger>
        </TabsList>

        <TabsContent value="conviction" className="mt-4">
          <TopStrategiesSection
            entries={convictionEntries}
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
            onDeploy={setDeployTarget}
            deployDisabled={deployMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="backtest" className="mt-4">
          <BacktestLeaderboardSection
            entries={showBacktestTrading ? backtestTrading : []}
            qualifyingCells={showBacktestTrading ? (backtest.data?.qualifyingCells ?? 0) : 0}
            shown={showBacktestTrading ? (backtest.data?.shown ?? 0) : 0}
            hedgingEntries={showBacktestHedging ? backtestHedging : []}
            hedgingQualifyingCells={
              showBacktestHedging ? (backtest.data?.hedgingQualifyingCells ?? 0) : 0
            }
            hedgingShown={showBacktestHedging ? (backtest.data?.hedgingShown ?? 0) : 0}
            isLoading={backtest.isLoading}
            isError={backtest.isError}
            onRetry={backtest.refetch}
          />
        </TabsContent>

        <TabsContent value="papers" className="mt-4">
          <PaperLeaderboardSection
            papers={filteredPapers}
            isLoading={papers.isLoading}
            isError={papers.isError}
            onRetry={papers.refetch}
          />
        </TabsContent>
      </Tabs>

      <DeployStrategyDialog
        open={deployTarget != null}
        onOpenChange={(open) => {
          if (!open && !deployMutation.isPending) setDeployTarget(null);
        }}
        entry={deployTarget}
        accounts={accounts}
        defaultAccountId={scopedAccountId}
      />
    </div>
  );
}
