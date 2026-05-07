/**
 * Shared Recharts theme constants. Values mirror the CSS variables in
 * globals.css — Recharts draws to SVG not canvas, but its tick/axis props
 * still expect raw strings rather than `var(--…)`, so we keep a resolved copy
 * here.
 */
export const CHART_COLORS = {
  profit: '#16B364',
  profitBright: '#2EBC72',
  loss: '#E5484D',
  neutral: '#8C95A2',
  neutralDim: '#5A6371',
  info: '#3B82F6',
  warning: '#F5A623',
  grid: '#1E232C',
  axis: '#262D38',
  surface: '#171B22',
  elevated: '#1E232C',
  textPrimary: '#F2F5F8',
} as const;

export const AXIS_TICK = {
  fill: CHART_COLORS.neutral,
  fontSize: 11,
  fontFamily: 'JetBrains Mono, monospace',
} as const;

export const TOOLTIP_CONTENT_STYLE = {
  background: CHART_COLORS.surface,
  border: `1px solid ${CHART_COLORS.axis}`,
  color: CHART_COLORS.textPrimary,
  fontSize: 12,
  borderRadius: 6,
  padding: '8px 12px',
} as const;

export const TOOLTIP_ITEM_STYLE = {
  color: CHART_COLORS.textPrimary,
};

export const TOOLTIP_LABEL_STYLE = {
  color: CHART_COLORS.neutral,
  fontSize: 10,
  marginBottom: 4,
};
