'use client';

import { useEffect, useState } from 'react';
import { TV as TV_FALLBACK } from './chartTheme';
import {
  CHART_COLORS as CC_FALLBACK,
  type ChartTooltipItem,
} from './rechartsTheme';

/**
 * Runtime, theme-aware chart colors.
 *
 * Charts paint to canvas (lightweight-charts) or to SVG presentation attributes
 * (recharts tick/stroke/fill) — neither resolves CSS `var(--…)`. The static
 * `TV` / `CHART_COLORS` constants are frozen to the DARK theme, so any chart
 * consuming them renders a near-black plate with dark grid + light-grey text on
 * the white page in light mode.
 *
 * This hook resolves the same shapes from the live CSS variables via
 * `getComputedStyle`, and re-reads whenever `data-theme` flips, so charts track
 * the theme. The static constants remain the SSR / first-paint fallback. Mirror
 * of the pattern in components/ml/SignalTimelineChart.tsx.
 *
 * Note: lightweight-charts consumers build the chart imperatively and must
 * re-apply on theme change — add a `useEffect(() => chart.applyOptions(...),
 * [TV])` alongside the build effect (see CandlestickChart / BacktestAnnotatedChart).
 */
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export type { ChartTooltipItem };

export interface ChartTheme {
  // Widened to string records: the static fallbacks are `as const` (frozen
  // literal hex types), but build() resolves runtime strings from getComputedStyle.
  TV: Record<keyof typeof TV_FALLBACK, string>;
  CHART_COLORS: Record<keyof typeof CC_FALLBACK, string>;
  AXIS_TICK: { fill: string; fontSize: number; fontFamily: string };
  TOOLTIP_CONTENT_STYLE: {
    background: string;
    border: string;
    color: string;
    fontSize: number;
    borderRadius: number;
    padding: string;
  };
}

function build(read: (cssVar: string, fallback: string) => string): ChartTheme {
  const TV = {
    BG: read('--bg-base', TV_FALLBACK.BG),
    SURFACE: read('--bg-surface', TV_FALLBACK.SURFACE),
    TEXT: read('--text-secondary', TV_FALLBACK.TEXT),
    TEXT_MUTED: read('--text-muted', TV_FALLBACK.TEXT_MUTED),
    GRID: read('--border-subtle', TV_FALLBACK.GRID),
    BORDER: read('--border-default', TV_FALLBACK.BORDER),
    CROSSHAIR: read('--text-muted', TV_FALLBACK.CROSSHAIR),
    LABEL_BG: read('--bg-elevated', TV_FALLBACK.LABEL_BG),
    PROFIT: read('--color-profit', TV_FALLBACK.PROFIT),
    LOSS: read('--color-loss', TV_FALLBACK.LOSS),
    INFO: read('--color-info', TV_FALLBACK.INFO),
    WARNING: read('--color-warning', TV_FALLBACK.WARNING),
    NEUTRAL: read('--color-neutral', TV_FALLBACK.NEUTRAL),
  };
  const CHART_COLORS = {
    profit: read('--color-profit', CC_FALLBACK.profit),
    // Categorical brighter green — theme-neutral, kept literal.
    profitBright: CC_FALLBACK.profitBright,
    loss: read('--color-loss', CC_FALLBACK.loss),
    neutral: read('--color-neutral', CC_FALLBACK.neutral),
    neutralDim: read('--text-muted', CC_FALLBACK.neutralDim),
    info: read('--color-info', CC_FALLBACK.info),
    warning: read('--color-warning', CC_FALLBACK.warning),
    grid: read('--border-subtle', CC_FALLBACK.grid),
    axis: read('--border-default', CC_FALLBACK.axis),
    surface: read('--bg-surface', CC_FALLBACK.surface),
    elevated: read('--bg-elevated', CC_FALLBACK.elevated),
    textPrimary: read('--text-primary', CC_FALLBACK.textPrimary),
  };
  const AXIS_TICK = { fill: CHART_COLORS.neutral, fontSize: 11, fontFamily: MONO };
  const TOOLTIP_CONTENT_STYLE = {
    background: CHART_COLORS.surface,
    border: `1px solid ${CHART_COLORS.axis}`,
    color: CHART_COLORS.textPrimary,
    fontSize: 12,
    borderRadius: 6,
    padding: '8px 12px',
  };
  return { TV, CHART_COLORS, AXIS_TICK, TOOLTIP_CONTENT_STYLE };
}

/** Dark fallback — exactly mirrors the static constants. Used for SSR / first paint. */
const FALLBACK: ChartTheme = build((_cssVar, fallback) => fallback);

function resolve(): ChartTheme {
  if (typeof window === 'undefined') return FALLBACK;
  const styles = getComputedStyle(document.documentElement);
  return build((cssVar, fallback) => styles.getPropertyValue(cssVar).trim() || fallback);
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(FALLBACK);
  useEffect(() => {
    const apply = () => setTheme(resolve());
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => obs.disconnect();
  }, []);
  return theme;
}
