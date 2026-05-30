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
import { TopStrategiesSection } from '@/components/leaderboard/TopStrategiesSection';
import { DeployStrategyDialog } from '@/components/leaderboard/DeployStrategyDialog';
import { useTopStrategies, useDeployStrategy } from '@/hooks/useLeaderboard';
import { useActiveAccount } from '@/hooks/useAccounts';
import type { LeaderboardEntry } from '@/types/leaderboard';

const LIMIT_OPTIONS = [5, 10, 25] as const;

export default function LeaderboardPage() {
  const [limit, setLimit] = useState<number>(10);
  const { data: entries = [], isLoading, isError, refetch } = useTopStrategies(limit);
  const { accounts, scopedAccountId } = useActiveAccount();
  const deployMutation = useDeployStrategy();
  const [deployTarget, setDeployTarget] = useState<LeaderboardEntry | null>(null);

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

      <TopStrategiesSection
        entries={entries}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        onDeploy={setDeployTarget}
        deployDisabled={deployMutation.isPending}
      />

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
