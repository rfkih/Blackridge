'use client';

import { AlertTriangle, Pencil, Archive } from 'lucide-react';
import type { ResearchRegistryEntry, PromiseTier } from '@/types/research';
import {
  TIER_LABEL,
  TIER_ORDER,
  tierStyle,
  statusStyle,
  verdictStyle,
  shortWf,
  fmtDsr,
  fmtPct,
  fmtInt,
  type BadgeStyle,
} from './registryBadges';

function Badge({ style, title }: { style: BadgeStyle; title?: string }) {
  return (
    <span
      title={title}
      className="inline-block whitespace-nowrap rounded-sm px-1.5 py-px font-mono text-[12px] uppercase tracking-widest"
      style={{ background: style.bg, color: style.fg }}
    >
      {style.label}
    </span>
  );
}

interface RegistryTableProps {
  items: ResearchRegistryEntry[];
  isAdmin: boolean;
  onSelect: (entry: ResearchRegistryEntry) => void;
  onEdit: (entry: ResearchRegistryEntry) => void;
  onArchive: (entry: ResearchRegistryEntry) => void;
}

export function RegistryTable({ items, isAdmin, onSelect, onEdit, onArchive }: RegistryTableProps) {
  const byTier: Record<PromiseTier, ResearchRegistryEntry[]> = {
    TIER_A: [],
    TIER_B: [],
    TIER_C: [],
  };
  for (const it of items) byTier[it.promiseTier]?.push(it);
  for (const t of TIER_ORDER) {
    byTier[t].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.displayName.localeCompare(b.displayName));
  }

  return (
    <div className="flex flex-col gap-5">
      {TIER_ORDER.map((tier) =>
        byTier[tier].length === 0 ? null : (
          <section key={tier}>
            <div className="mb-1.5 flex items-center gap-2">
              <Badge style={tierStyle(tier)} />
              <h2 className="text-[14px] font-semibold uppercase tracking-widest text-text-secondary">
                {TIER_LABEL[tier]}
              </h2>
              <span className="font-mono text-[12px] text-text-muted">{byTier[tier].length}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-bd-subtle bg-bg-surface">
              <table className="w-full border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-bd-subtle text-left">
                    {['#', 'Strategy', 'Status', 'Verdict', 'DSR', 'Walk-forward', 'Ann %', 'Trades', '', isAdmin ? '' : null]
                      .filter((h) => h !== null)
                      .map((h, i) => (
                        <th
                          key={i}
                          className="px-3 py-2 text-[12px] font-medium uppercase tracking-widest text-text-muted"
                        >
                          {h}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {byTier[tier].map((e) => (
                    <tr
                      key={e.registryId}
                      onClick={() => onSelect(e)}
                      className="group cursor-pointer border-b border-bd-subtle last:border-0 hover:bg-bg-hover"
                    >
                      <td className="px-3 py-2.5 font-mono text-[13px] text-text-muted">
                        {e.rank ?? '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">{e.displayName}</span>
                          {e.signalFamily && (
                            <span className="rounded-sm bg-bg-base px-1.5 py-px font-mono text-[12px] uppercase tracking-wider text-text-muted">
                              {e.signalFamily}
                            </span>
                          )}
                          {e.isOfflineLead && (
                            <span
                              className="rounded-sm px-1.5 py-px font-mono text-[12px] uppercase tracking-wider"
                              style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                              title="No orchestrator run — offline/curated only"
                            >
                              offline
                            </span>
                          )}
                          {e.autoManaged && (
                            <span
                              className="rounded-sm px-1.5 py-px font-mono text-[12px] uppercase tracking-wider"
                              style={{ background: 'var(--tint-info)', color: 'var(--color-info)' }}
                              title="Auto-tracked from the research loop (not hand-curated). Edit it to take ownership."
                            >
                              auto
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 font-mono text-[12px] text-text-muted">
                          {e.strategyCode ?? '—'}
                          {e.symbol ? ` · ${e.symbol}` : ''}
                          {e.intervalName ? ` · ${e.intervalName}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge style={statusStyle(e.lifecycleStatus)} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge style={verdictStyle(e.verdictTag)} />
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums text-text-secondary">
                        {fmtDsr(e.live.dsr)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[13px] text-text-secondary">
                        {shortWf(e.live.walkForwardVerdict)}
                      </td>
                      <td
                        className="px-3 py-2.5 font-mono tabular-nums"
                        style={{
                          color:
                            e.live.annualizedReturnPct == null
                              ? 'var(--text-muted)'
                              : e.live.annualizedReturnPct >= 0
                                ? 'var(--color-profit)'
                                : 'var(--color-loss)',
                        }}
                      >
                        {fmtPct(e.live.annualizedReturnPct)}
                      </td>
                      <td className="px-3 py-2.5 font-mono tabular-nums text-text-secondary">
                        {fmtInt(e.live.nTrades)}
                      </td>
                      <td className="px-3 py-2.5">
                        {e.divergence.flag && (
                          <span title={e.divergence.reason ?? 'Curated narrative diverges from live data'}>
                            <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />
                          </span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              aria-label={`Edit ${e.displayName}`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onEdit(e);
                              }}
                              className="flex size-6 items-center justify-center rounded-sm text-text-muted hover:bg-bg-base hover:text-text-primary"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Archive ${e.displayName}`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                onArchive(e);
                              }}
                              className="flex size-6 items-center justify-center rounded-sm text-text-muted hover:bg-bg-base"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              <Archive size={12} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ),
      )}
    </div>
  );
}
