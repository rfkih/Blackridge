'use client';

import { ChevronDown, FlaskConical, Loader2, TrendingUp } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AccountStrategy } from '@/types/strategy';

interface StartStrategyMenuProps {
  strategy: AccountStrategy;
  onStartAsPaper: (s: AccountStrategy) => void;
  onStartAsLive: (s: AccountStrategy) => void;
  isPending: boolean;
}

/**
 * Split button for STOPPED rows. Primary click defaults to paper-start
 * (safe — divert to paper_trade_run, no Binance order). The chevron opens a
 * menu with both options spelled out so the operator knows the choice exists.
 */
export function StartStrategyMenu({
  strategy,
  onStartAsPaper,
  onStartAsLive,
  isPending,
}: StartStrategyMenuProps) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)]">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onStartAsPaper(strategy);
        }}
        disabled={isPending}
        title="Activate in paper mode — decisions land in paper_trade_run, no Binance order."
        className="inline-flex items-center gap-1.5 border-r border-[var(--border-subtle)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-warning)] transition-colors hover:bg-[rgba(245,166,35,0.10)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <FlaskConical size={11} strokeWidth={2} />
        )}
        {isPending ? 'Starting…' : 'Start paper'}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={isPending}
            aria-label="More start options"
            className="inline-flex items-center px-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <ChevronDown size={12} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
        >
          <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            Activation mode
          </DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => onStartAsPaper(strategy)}
            disabled={isPending}
            className="cursor-pointer"
          >
            <FlaskConical size={13} className="text-[var(--color-warning)]" />
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold">Start as paper</span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Simulated · no Binance orders
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => onStartAsLive(strategy)}
            disabled={isPending}
            className="cursor-pointer"
          >
            <TrendingUp size={13} className="text-[var(--color-profit)]" />
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-[var(--color-profit)]">
                Start as live
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Real Binance orders · confirms first
              </span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface SwitchModeButtonProps {
  strategy: AccountStrategy;
  onSwitchToPaper: (s: AccountStrategy) => void;
  onSwitchToLive: (s: AccountStrategy) => void;
  isPending: boolean;
}

/**
 * Inline button for running rows. Shows the OPPOSITE mode as the call to
 * action — current LIVE → "Switch to paper", current PAPER → "Switch to live".
 * Live-target clicks open the confirm dialog; paper-target is one click.
 */
export function SwitchModeButton({
  strategy,
  onSwitchToPaper,
  onSwitchToLive,
  isPending,
}: SwitchModeButtonProps) {
  const isPaper = strategy.status === 'PAPER';
  const isLive = strategy.status === 'LIVE';
  if (!isPaper && !isLive) return null;

  if (isPaper) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onSwitchToLive(strategy);
        }}
        disabled={isPending}
        title="Promote to live — places real Binance orders on the next closed candle."
        className="border-[var(--color-profit)]/60 inline-flex items-center gap-1.5 rounded-md border bg-[var(--bg-elevated)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-profit)] transition-colors hover:bg-[rgba(22,179,100,0.10)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 size={11} className="animate-spin" />
        ) : (
          <TrendingUp size={11} strokeWidth={2} />
        )}
        {isPending ? 'Switching…' : 'Switch to live'}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSwitchToPaper(strategy);
      }}
      disabled={isPending}
      title="Demote to paper — open positions still close real; new entries divert to paper_trade_run."
      className="border-[var(--color-warning)]/60 inline-flex items-center gap-1.5 rounded-md border bg-[var(--bg-elevated)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-warning)] transition-colors hover:bg-[rgba(245,166,35,0.10)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 size={11} className="animate-spin" />
      ) : (
        <FlaskConical size={11} strokeWidth={2} />
      )}
      {isPending ? 'Switching…' : 'Switch to paper'}
    </button>
  );
}
