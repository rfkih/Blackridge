'use client';

import Link from 'next/link';
import { Check, ChevronRight, Cog, KeyRound, Plus, Wallet, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAccounts } from '@/hooks/useAccounts';
import { useStrategies } from '@/hooks/useStrategies';
import { useOpenTrades } from '@/hooks/useTrades';
import { NewAccountDialog } from '@/components/account/NewAccountDialog';

/**
 * First-run guidance shown above the dashboard hero. We ladder through the
 * "make this account actually trade" steps and surface only the next one
 * the user needs:
 *
 *   1. Add an exchange account (with API keys).
 *   2. Activate the account (set is_active = Y).
 *   3. Create a strategy preset for that account.
 *   4. Enable the strategy (so the orchestrator runs it).
 *   5. Wait for the first trade — informational only.
 *
 * Auto-hides when all five are satisfied. Users can also dismiss it
 * manually via the close button — that preference persists in
 * localStorage so the panel stays gone across reloads (until the user
 * clicks the "show again" link in Settings, when that lands).
 */

const DISMISSED_KEY = 'blackheart:onboarding:dismissed';

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed(v: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (v) window.localStorage.setItem(DISMISSED_KEY, '1');
    else window.localStorage.removeItem(DISMISSED_KEY);
  } catch {
  }
}

export function OnboardingPanel() {
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts();
  const { data: strategies = [], isLoading: loadingStrategies } = useStrategies();
  const { data: openTrades = [] } = useOpenTrades();

  const [dismissed, setDismissed] = useState(false);
  const [newAccountOpen, setNewAccountOpen] = useState(false);
  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  if (loadingAccounts || loadingStrategies) return null;
  if (dismissed) return null;

  const hasAccount = accounts.length > 0;
  const hasActiveAccount = accounts.some((a) => a.active);
  const liveStrategies = strategies.filter((s) => s.status === 'LIVE');
  const hasStrategy = strategies.length > 0;
  const hasLiveStrategy = liveStrategies.length > 0;
  const hasTrade = openTrades.length > 0;

  const allComplete = hasAccount && hasActiveAccount && hasStrategy && hasLiveStrategy && hasTrade;
  if (allComplete) return null;

  const steps: Step[] = [
    {
      key: 'account',
      title: 'Connect an exchange account',
      blurb: 'Add your Binance API key + secret. We encrypt both at rest before storing.',
      icon: KeyRound,
      done: hasAccount,
      cta: { onClick: () => setNewAccountOpen(true), label: 'Add account' },
    },
    {
      key: 'activate-account',
      title: 'Activate the account',
      blurb: 'Mark the connected account live so the orchestrator can route to it.',
      icon: Wallet,
      done: hasAccount && hasActiveAccount,
      cta: { href: '/settings', label: 'Open settings' },

      gated: !hasAccount,
    },
    {
      key: 'strategy',
      title: 'Create your first strategy',
      blurb: 'Pick a preset (LSR, VCB, VBO, …), bind it to the account, and tune params.',
      icon: Cog,
      done: hasStrategy,
      cta: { href: '/strategies', label: 'New strategy' },
      gated: !hasActiveAccount,
    },
    {
      key: 'activate-strategy',
      title: 'Take the strategy live',
      blurb:
        'Toggle the strategy ON so the orchestrator evaluates it on every interval bar close.',
      icon: Zap,
      done: hasLiveStrategy,
      cta: { href: '/strategies', label: 'Open strategies' },
      gated: !hasStrategy,
    },
    {
      key: 'first-trade',
      title: 'First trade is on its way',
      blurb:
        "Sit tight — once an entry signal fires, you'll see it on the dashboard and in the trades log.",
      icon: Plus,
      done: hasTrade,

      cta: null,
      gated: !hasLiveStrategy,
    },
  ];

  const focusIdx = steps.findIndex((s) => !s.done && !s.gated);
  const completed = steps.filter((s) => s.done).length;

  return (
    <>
    <NewAccountDialog open={newAccountOpen} onOpenChange={setNewAccountOpen} />
    <section
      className="rounded-xl border border-bd-subtle bg-bg-surface p-4"
      aria-labelledby="onboarding-heading"
    >
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 items-center justify-center rounded-sm"
            style={{
              background: 'rgba(59,130,246,0.12)',
              color: 'var(--color-info)',
            }}
          >
            <Zap size={14} strokeWidth={1.75} />
          </span>
          <h2 id="onboarding-heading" className="font-display text-sm font-semibold text-text-primary">
            Get set up
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[12px] uppercase tracking-widest text-text-muted">
            {completed}/{steps.length} complete
          </span>
          <button
            type="button"
            onClick={() => {
              writeDismissed(true);
              setDismissed(true);
            }}
            className="rounded p-1 text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
            aria-label="Hide onboarding panel"
            title="Hide — clear the dismissed flag from localStorage to bring it back"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </div>
      </header>

      <ol className="space-y-2">
        {steps.map((step, idx) => (
          <OnboardingStep key={step.key} step={step} isFocus={idx === focusIdx} />
        ))}
      </ol>
    </section>
    </>
  );
}

interface Step {
  key: string;
  title: string;
  blurb: string;
  icon: React.ElementType;
  done: boolean;
  cta: { href: string; label: string } | { onClick: () => void; label: string } | null;
  /** True when an earlier step blocks this one — render dimmed, no CTA. */
  gated?: boolean;
}

function OnboardingStep({ step, isFocus }: { step: Step; isFocus: boolean }) {
  const Icon = step.icon;
  const dim = step.gated && !step.done;

  return (
    <li
      className={`flex items-start gap-3 rounded-sm border px-3 py-2.5 transition-colors ${
        step.done
          ? 'border-[var(--color-profit)]/30 bg-[var(--tint-profit)]'
          : isFocus
            ? 'border-[var(--accent-primary)] bg-[var(--bg-elevated)]'
            : 'border-bd-subtle bg-bg-surface'
      }`}
      style={dim ? { opacity: 0.45 } : undefined}
    >
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm"
        style={{
          background: step.done
            ? 'var(--tint-profit)'
            : isFocus
              ? 'var(--accent-glow)'
              : 'var(--bg-elevated)',
          color: step.done
            ? 'var(--color-profit)'
            : isFocus
              ? 'var(--accent-primary)'
              : 'var(--text-muted)',
        }}
      >
        {step.done ? <Check size={14} strokeWidth={2.25} /> : <Icon size={13} strokeWidth={1.75} />}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={`text-[14px] font-semibold ${
            step.done ? 'text-text-secondary line-through' : 'text-text-primary'
          }`}
        >
          {step.title}
        </p>
        <p className="text-[13px] text-text-muted">{step.blurb}</p>
      </div>

      {!step.done && step.cta && !dim && (
        'href' in step.cta ? (
          <Link
            href={step.cta.href}
            className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.14em] transition-colors ${
              isFocus
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-inverse)] hover:opacity-90'
                : 'border-bd-subtle bg-bg-base text-text-primary hover:bg-bg-hover'
            }`}
          >
            {step.cta.label}
            <ChevronRight size={11} strokeWidth={2} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={step.cta.onClick}
            className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-2.5 py-1 font-mono text-[12px] uppercase tracking-[0.14em] transition-colors ${
              isFocus
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-inverse)] hover:opacity-90'
                : 'border-bd-subtle bg-bg-base text-text-primary hover:bg-bg-hover'
            }`}
          >
            {step.cta.label}
            <ChevronRight size={11} strokeWidth={2} />
          </button>
        )
      )}
    </li>
  );
}
