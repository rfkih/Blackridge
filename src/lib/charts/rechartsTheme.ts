/**
 * Shared Recharts theme constants. Values mirror the CSS variables in
 * globals.css — Recharts draws to SVG not canvas, but its tick/axis props
 * still expect raw strings rather than `var(--…)`, so we keep a resolved copy
 * here.
 */
export const CHART_COLORS = {
  profit: '#34E8B5',
  profitBright: '#5BF0C5',
  loss: '#FF7A7A',
  neutral: '#898D8C',
  neutralDim: '#5A5E5D',
  info: '#5A9EFF',
  warning: '#F3C95E',
  grid: '#222729',
  axis: '#2C3134',
  surface: '#191E20',
  elevated: '#222729',
  textPrimary: '#F1F3F2',
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
