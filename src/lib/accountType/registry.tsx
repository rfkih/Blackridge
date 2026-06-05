'use client';

import type React from 'react';
import { Scale, TrendingUp, type LucideIcon } from 'lucide-react';
import { useActiveAccount } from '@/hooks/useAccounts';
import { DEFAULT_ACCOUNT_TYPE, type AccountType } from '@/types/accountType';

/**
 * A type-keyed *view*: the declarative bundle that makes a surface
 * account-type-aware without scattering `if (hedging)` conditionals.
 *
 * Per the design spec §4 this is the heart of the feature — pages and
 * components read the active account's view instead of branching. This phase
 * (P1) only populates the parts consumed now: type resolution, the catalog
 * filter, terminology, the metric set and the label. The widget/section arrays
 * are deliberately empty until the extraction phases (P3/P4) wire them up —
 * see the TODO below. Keeping them in the interface fixes the contract those
 * later phases fill in.
 */
export interface AccountTypeView {
  /** Stable machine key for the type. Branch on THIS, never on {@link #label}
   *  (the label is human copy and may change). */
  type: AccountType;
  /** Human label for the type — "Trading" / "Hedging". */
  label: string;
  /** Lucide icon representing the type (badge / switcher / headers). */
  icon: LucideIcon;
  /** Surface-agnostic vocabulary so copy reads naturally per type. */
  terminology: { position: string; event: string; size: string };
  /** Header stat-card metric keys, in display order. */
  metrics: string[];
  /** Label for the monitor list tab — "Trades" vs "Rebalances". */
  monitorLabel: string;
  /** Catalog/picker predicate: keep only strategies whose kind matches. */
  catalogFilter: (kind: AccountType) => boolean;
  /** Dashboard widgets for this type. Empty until P3 extracts them. */
  dashboardWidgets: React.ComponentType[];
  /** Settings/risk sections for this type. Empty until P4 extracts them. */
  settingsSections: React.ComponentType[];
}

export const ACCOUNT_TYPE_VIEW: Record<AccountType, AccountTypeView> = {
  TRADING: {
    type: 'TRADING',
    label: 'Trading',
    icon: TrendingUp,
    terminology: { position: 'Position', event: 'Trade', size: 'Trade size' },
    metrics: ['winRate', 'profitFactor', 'openPositions', 'todayPnl'],
    monitorLabel: 'Trades',
    catalogFilter: (kind) => kind === 'TRADING',
    // TODO(P3): populate from extracted widget components
    dashboardWidgets: [],
    // TODO(P3): populate from extracted widget components
    settingsSections: [],
  },
  HEDGING: {
    type: 'HEDGING',
    label: 'Hedging',
    icon: Scale,
    terminology: { position: 'Allocation', event: 'Rebalance', size: 'Target weight' },
    metrics: ['btcWeightPct', 'cashWeightPct', 'maxDrawdown', 'btcStack', 'sharpe'],
    monitorLabel: 'Rebalances',
    catalogFilter: (kind) => kind === 'HEDGING',
    // TODO(P3): populate from extracted widget components
    dashboardWidgets: [],
    // TODO(P3): populate from extracted widget components
    settingsSections: [],
  },
};

/**
 * Resolves the view for the currently active account. In "All" mode (no
 * single active account) or for legacy rows it falls back to the TRADING view,
 * so existing users see zero change.
 */
export const useAccountView = (): AccountTypeView =>
  ACCOUNT_TYPE_VIEW[useActiveAccount().activeAccount?.accountType ?? DEFAULT_ACCOUNT_TYPE];
