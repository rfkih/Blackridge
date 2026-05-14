'use client';

import { useState } from 'react';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { SpecTraceViewer } from '@/components/research/SpecTraceViewer';

export default function SpecTracePage() {
  const isAdmin = useIsAdmin();
  const [scope, setScope] = useState<'backtest' | 'live'>('backtest');
  const [backtestRunId, setBacktestRunId] = useState('');
  const [accountStrategyId, setAccountStrategyId] = useState('');
  const [strategyCode, setStrategyCode] = useState('');
  const [appliedBacktest, setAppliedBacktest] = useState('');
  const [appliedAccount, setAppliedAccount] = useState('');
  const [appliedStrategy, setAppliedStrategy] = useState('');

  if (!isAdmin) {
    return <div className="px-6 py-12 text-center text-text-secondary">Admin access required.</div>;
  }

  const apply = () => {
    if (scope === 'backtest') {
      setAppliedBacktest(backtestRunId.trim());
      setAppliedAccount('');
    } else {
      setAppliedAccount(accountStrategyId.trim());
      setAppliedBacktest('');
    }
    setAppliedStrategy(strategyCode.trim());
  };

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-text-primary">Spec trace viewer</h1>
        <p className="text-sm text-text-secondary">
          Forensic replay of spec-driven engine decisions. Backtest writes dense traces (1 row per
          bar per active strategy); live samples at{' '}
          <code className="font-mono">engine.trace.sample-rate</code> (default 1%).
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-bd-subtle bg-bg-surface px-3 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-text-muted">Scope</span>
          <div className="flex items-center gap-1">
            {(['backtest', 'live'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className="rounded-sm px-2 py-1 text-[12px] transition-colors"
                style={{
                  background: scope === s ? 'var(--bg-hover)' : 'transparent',
                  color: scope === s ? 'var(--text-primary)' : 'var(--text-secondary)',
                  border: '1px solid',
                  borderColor: scope === s ? 'var(--border-default)' : 'transparent',
                }}
              >
                {s === 'backtest' ? 'Backtest run' : 'Live strategy'}
              </button>
            ))}
          </div>
        </div>

        {scope === 'backtest' ? (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-text-muted">
              backtest_run_id
            </span>
            <input
              type="text"
              value={backtestRunId}
              onChange={(e) => setBacktestRunId(e.target.value)}
              placeholder="UUID"
              className="w-[320px] rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[12px] text-text-primary"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-text-muted">
              account_strategy_id
            </span>
            <input
              type="text"
              value={accountStrategyId}
              onChange={(e) => setAccountStrategyId(e.target.value)}
              placeholder="UUID"
              className="w-[320px] rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[12px] text-text-primary"
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-text-muted">
            strategy_code (optional)
          </span>
          <input
            type="text"
            value={strategyCode}
            onChange={(e) => setStrategyCode(e.target.value)}
            placeholder="e.g. LSR"
            className="w-[160px] rounded-sm border border-bd-subtle bg-bg-base px-2 py-1 font-mono text-[12px] text-text-primary"
          />
        </label>

        <button
          type="button"
          onClick={apply}
          className="mm-pill"
          style={{ padding: '8px 14px', fontSize: 12 }}
        >
          Load
        </button>
      </div>

      <SpecTraceViewer
        backtestRunId={appliedBacktest || undefined}
        accountStrategyId={appliedAccount || undefined}
        strategyCode={appliedStrategy || undefined}
      />
    </div>
  );
}
