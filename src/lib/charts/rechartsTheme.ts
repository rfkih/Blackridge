/**
 * Shared Recharts theme constants. Values mirror the CSS variables in
 * globals.css — Recharts draws to SVG not canvas, but its tick/axis props
 * still expect raw strings rather than `var(--…)`, so we keep a resolved copy
 * here.
 */
export const CHART_COLORS = {
  profit: '#00C896',
  profitBright: '#00E5B0',
  loss: '#FF4D6A',
  neutral: '#8892A4',
  neutralDim: '#4A5160',
  info: '#4E9EFF',
  warning: '#F5A623',
  grid: '#1E2230',
  axis: '#2A2F3A',
  surface: '#1A1D24',
  elevated: '#22262F',
  textPrimary: '#E8EBF0',
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
