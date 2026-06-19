'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';

/**
 * Help / FAQ surface. Quick-explain entries for the concepts that come up
 * most often when reading the dashboards: statistical metrics, the multi-
 * strategy orchestration model, and the backtest engine's constraints.
 *
 * <p>Each entry has a short headline and a 1–3 paragraph body. Searchable —
 * the filter is a substring match against the title + body so a user
 * looking for "sharpe" lands on PSR / DSR even though the headline differs.
 */

interface HelpEntry {
  id: string;
  category: string;
  title: string;
  /** Plain text — formatted via simple paragraph-on-blank-line rules. */
  body: string;
}

const ENTRIES: HelpEntry[] = [
  {
    id: 'psr',
    category: 'Metrics',
    title: 'What is PSR (Probabilistic Sharpe Ratio)?',
    body: `Sharpe ratio measures risk-adjusted return — but a single Sharpe number from a small sample can be a coincidence. PSR (Bailey & López de Prado) is the probability that the TRUE Sharpe is above zero, given the sample size, skew, and kurtosis of the actual returns.

A PSR of 0.95 means: "given my 200 trades and how the returns are distributed, there's a 95% chance the strategy actually has positive expected Sharpe — not just luck on this sample." A PSR of 0.55 with the same trades means it's basically a coin flip.

We compute PSR per backtest run. Aim for PSR ≥ 0.95 over a meaningful sample before trusting a strategy live.`,
  },
  {
    id: 'dsr',
    category: 'Metrics',
    title: 'What is DSR (Deflated Sharpe Ratio)?',
    body: `DSR is PSR's cohort-aware sibling. When you run a sweep — say 100 parameter combos — by chance some will look great even if the underlying signal is noise. DSR penalises the cohort-wide Sharpe by how many trials you ran and how their Sharpes were distributed.

A high DSR after a 100-run sweep is much stronger evidence than a high single-run PSR. A high single-run PSR after 100 sweeps is selection bias dressed up as discovery.

Use DSR to gate "should I take this combo to a locked holdout?" — it's the most honest single metric we expose.`,
  },
  {
    id: 'walk-forward',
    category: 'Methodology',
    title: 'How does walk-forward validation work?',
    body: `Walk-forward simulates the realistic "I keep retraining as time passes" workflow. Concretely: the engine slices the history into K folds, then for each fold trains/optimises on prior data and tests on the next out-of-sample slice.

The OOS results are stitched into one continuous equity curve — that's the curve to trust, not the in-sample one. PSR computed on the stitched OOS curve is roughly what you should expect live.

We expose the windowing parameters in the sweep wizard. Defaults are sensible; tune the OOS fraction first when you want to trade off "how stable is this estimate" vs "how recent is the test."`,
  },
  {
    id: 'calibrated-slippage',
    category: 'Backtest engine',
    title: 'What does "calibrated slippage" mean?',
    body: `Default backtests apply a flat percentage slippage on every fill. That's a useful first approximation but not how real markets behave — small orders barely slip, big orders sweep multiple levels.

When you toggle "Use calibrated slippage" on the backtest wizard, the engine reads the actual difference between intent (the price you decided to enter at) and realised (the actual fill price the exchange returned) from your live trade history, computes a per-symbol distribution, and applies that distribution to backtest fills.

If you have no live trades on the symbol yet, the engine falls back to a configured default rate. The wizard tooltips warn when there isn't enough live history to calibrate honestly.`,
  },
  {
    id: 'kill-switch',
    category: 'Risk',
    title: 'What is the drawdown kill-switch?',
    body: `Each AccountStrategy carries a drawdown threshold (default 25%). When the strategy's realised drawdown breaches it, RiskGuardService trips the kill-switch: enabled is forced to false, the trip reason and timestamp are stamped on the row, and no new entries fire until you explicitly re-arm.

Re-arming is a deliberate human action — it's the "you looked at this, you understand why it tripped, you accept the risk" handshake. A trip auto-clearing on the next winning trade defeats the point.

The Recent activity log records every rearm so you have a forensic record of which trips you acknowledged and when.`,
  },
  {
    id: 'multi-strategy',
    category: 'Live trading',
    title: 'How does multi-strategy orchestration work?',
    body: `When an account runs more than one strategy on the same interval, LiveOrchestratorCoordinatorService routes each WebSocket bar close through the priority-ordered list of strategies. The first one to emit an entry signal wins — subsequent strategies on that same interval are skipped until the trade closes.

Each interval group has its own implicit slot. With LSR on 15m and VCB on 1h, both can hold trades concurrently because they're in different groups; with LSR + VCB both on 15m, only one trades at a time.

Backtest mirrors this: per-interval-group cap, priority order from accountStrategy.priorityOrder, per-strategy bias data. The two paths are now bit-for-bit consistent on routing.`,
  },
  {
    id: 'cap',
    category: 'Risk',
    title: 'What does "max concurrent trades" actually cap?',
    body: `It caps total active trades on the account across every strategy and direction. Set on the Strategies page header per account.

Note this is in addition to the per-direction caps (max longs / max shorts) on each account's risk config. The most restrictive cap wins.

Leave the field blank to have no total cap — useful when you're using only the per-direction caps. The wizard tooltip says "no cap" when blank to make this explicit.`,
  },
  {
    id: 'backtest-intervals',
    category: 'Backtest engine',
    title: 'Which backtest intervals are supported (5m / 15m / 1h / 4h / 1d)?',
    body: `The backtest engine ticks on a 5m monitor candle, so 5m is the floor — strategy intervals finer than 5m would silently miss bar closes because the strategy bar's end-time wouldn't align with monitor ticks. Coarser intervals are fully supported: 1d runs end-to-end on daily market data (back to 2022) and is the timeframe the spot-hedging / trend strategies trade on.

One caveat for 1d: the run still ticks the 5m monitor underneath, so a multi-year 1d window iterates hundreds of thousands of monitor bars and can take a long time. Prefer a focused window, or expect a slow run.

Live trading isn't restricted; the live WebSocket processes whatever interval the strategy is registered on. The 5m floor is a backtest-engine invariant, not a strategy-engine one. If you need a finer-resolution backtest, the right answer is to refactor the monitor candle granularity (1m would work) — the per-strategy interval routing is already in place.`,
  },
  {
    id: 'forward-projections',
    category: 'Methodology',
    title: 'What are Forward Projections (the Monte Carlo page)?',
    body: `Given a backtest's actual trade sequence, Forward Projections asks "what could the next N trades plausibly look like, statistically?" It bootstraps trades (with replacement) from the historical distribution to simulate thousands of equally-plausible forward paths.

You see fan-chart percentile bands (5/25/50/75/95) and statistics like P(ruin) and median terminal equity. This is NOT a forecast — it's a "if the strategy keeps performing as it has, here's the distribution of outcomes you should expect." If you change the strategy, the projection becomes invalid.

Useful for sizing decisions ("what's the worst-case 1-in-20 drawdown over 100 trades?") and stress-testing assumptions.`,
  },
  {
    id: 'point-in-time',
    category: 'Backtest engine',
    title: 'Why does the backtest skip the "currently forming" candle?',
    body: `Strategies must only ever read CLOSED bars. A bar that hasn't closed yet has data that will change before the bar finalises — using it on the entry path leaks future information, and any backtest result built from such reads is unreliable.

We enforce this two ways: live execution gates on Binance's k.x = true closed-candle flag; the backtest engine looks up candles by their end-time and ignores anything beyond it. Bias-timeframe reads use findLatestCompletedBySymbolAndInterval, never the latest-including-forming variant.

If you write a new strategy or feature read on the live path, the rule is: anything that influences an entry/exit price level OR a sizing decision must read completed-only data. UI / informational reads can use the latest variant.`,
  },
  {
    id: 'audit',
    category: 'Account',
    title: 'Where do I see the history of changes I made?',
    body: `Settings → Recent activity. The audit log captures every strategy creation, activation, deactivation, parameter update, kill-switch rearm, and account risk-config change you've made. Newest first, paginated.

Audit writes are transaction-bound: a rolled-back mutation rolls back its audit row too, so you never see "we logged this change" for a change that didn't actually happen. The log doesn't include credentials by design.`,
  },
];

const ALL_CATEGORIES = Array.from(new Set(ENTRIES.map((e) => e.category)));

export default function HelpPage() {
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const filtered = ENTRIES.filter((e) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
    );
  });

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="font-mono text-[12px] uppercase tracking-widest text-text-muted">Help</p>
        <h1 className="mt-1 font-display text-2xl text-text-primary">What is this thing?</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-secondary">
          Quick-explain entries for the metrics, methodology, and engine constraints surfaced across
          the app. If something here is unclear or missing, mention it via{' '}
          <a
            href="/settings"
            className="font-semibold text-[var(--accent-primary)] hover:underline"
          >
            Settings → Help &amp; support
          </a>
          .
        </p>
      </header>

      {}
      <div className="flex items-center gap-2 rounded-xl border border-bd-subtle bg-bg-surface px-3 py-2">
        <Search size={14} strokeWidth={1.75} className="shrink-0 text-text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help — try “sharpe”, “kill switch”, “interval”…"
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="font-mono text-[12px] uppercase tracking-widest text-text-muted hover:text-text-primary"
          >
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border border-dashed border-bd-subtle px-6 py-12 text-center text-sm text-text-muted">
          No entries match <span className="font-mono text-text-primary">&quot;{query}&quot;</span>.
          Try a shorter query or browse the categories.
        </div>
      ) : (
        ALL_CATEGORIES.map((cat) => {
          const inCat = filtered.filter((e) => e.category === cat);
          if (inCat.length === 0) return null;
          return (
            <section key={cat} className="space-y-2">
              <h2 className="font-mono text-[12px] uppercase tracking-widest text-text-muted">
                {cat}
              </h2>
              <ul className="divide-y divide-bd-subtle overflow-hidden rounded-xl border border-bd-subtle bg-bg-surface">
                {inCat.map((e) => {
                  const open = openIds.has(e.id);
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => toggle(e.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-bg-hover"
                        aria-expanded={open}
                      >
                        <span className="text-[14px] font-semibold text-text-primary">
                          {e.title}
                        </span>
                        {open ? (
                          <ChevronDown size={14} className="shrink-0 text-text-muted" />
                        ) : (
                          <ChevronRight size={14} className="shrink-0 text-text-muted" />
                        )}
                      </button>
                      {open && (
                        <div className="space-y-2.5 px-4 pb-4 pt-1 text-[14px] leading-relaxed text-text-secondary">
                          {e.body.split(/\n{2,}/).map((para, i) => (
                            <p key={i}>{para}</p>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
