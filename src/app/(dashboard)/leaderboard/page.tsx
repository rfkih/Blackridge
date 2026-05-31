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
import type { LeaderboardEntry } from '@/types/leaderboard';

const LIMIT_OPTIONS = [5, 10, 25] as const;
const BACKTEST_LIMIT = 20;
const PAPERS_LIMIT = 25;

export default function LeaderboardPage() {
  const [limit, setLimit] = useState<number>(10);
  const { accounts, scopedAccountId } = useActiveAccount();
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Top strategies"
        title="Leaderboard"
        description="The best approved strategies ranked by risk-adjusted backtest performance. One-click deploy any of them onto your account — the winning parameters come along for the ride."
        actions={
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
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

      <p className="-mt-2 text-[12px] text-[var(--text-muted)]">
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
            entries={entries}
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
            onDeploy={setDeployTarget}
            deployDisabled={deployMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="backtest" className="mt-4">
          <BacktestLeaderboardSection
            entries={backtest.data ?? []}
            isLoading={backtest.isLoading}
            isError={backtest.isError}
            onRetry={backtest.refetch}
          />
        </TabsContent>

        <TabsContent value="papers" className="mt-4">
          <PaperLeaderboardSection
            papers={papers.data?.items ?? []}
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
