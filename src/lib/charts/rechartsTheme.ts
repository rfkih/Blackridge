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
  fontSize: 13,
  fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
} as const;

export const TOOLTIP_CONTENT_STYLE = {
  background: CHART_COLORS.surface,
  border: `1px solid ${CHART_COLORS.axis}`,
  color: CHART_COLORS.textPrimary,
  fontSize: 14,
  borderRadius: 6,
  padding: '8px 12px',
} as const;

/**
 * Custom-tooltip payload entry as Recharts hands it to a `content={...}`
 * renderer. Recharts wraps each series' datum in `{ payload, name, color, … }`;
 * we only type the fields our tooltips actually read. Multi-series tooltips
 * (e.g. MonteCarloChart) use `name` and `color` to render the swatch row.
 */
export interface ChartTooltipItem<T> {
  payload: T;
  name?: string;
  color?: string;
}
