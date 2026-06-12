/**
 * Real backtest equity curves — EMA-band BTC hedge (EMA100, 3% band) vs
 * buy-and-hold, computed on BTC daily closes Jan 2022 – Jun 2026 (includes
 * the 2022 bear). $10k start. Reproducible from the public daily series;
 * NOT live trading results. Shared by the welcome and product factsheets.
 */
export const HEDGE_CURVE = [
  10000, 10000, 10000, 8806, 7910, 7907, 7907, 7907, 7907, 7907, 7907, 7907, 7907, 7907, 7907, 7907,
  9617, 9840, 10521, 10575, 10486, 10023, 10495, 10074, 9156, 9156, 9156, 11368, 12668, 13946,
  13352, 16660, 23146, 21779, 19483, 22251, 20865, 19354, 18375, 17035, 17791, 18239, 24504, 27355,
  26608, 28328, 24766, 23979, 23979, 26885, 26856, 27795, 30356, 29814, 29763, 31124, 27742, 27742,
  27742, 27742, 27742, 27742, 27742, 27535, 27509, 26398,
];

export const BUYHOLD_CURVE = [
  10000, 7713, 8044, 8574, 8283, 7547, 6664, 4503, 4866, 5093, 4048, 4113, 4315, 3400, 3515, 3760,
  4806, 4917, 5684, 5713, 5665, 5415, 6392, 6136, 5486, 5608, 5629, 7418, 8267, 9100, 8713, 10871,
  15104, 14211, 12714, 14519, 13615, 12740, 12926, 12391, 13782, 14129, 18982, 21190, 20612, 21944,
  19184, 17620, 17527, 21962, 21939, 22706, 24798, 24355, 24313, 25425, 23070, 18960, 18578, 20033,
  14697, 14273, 14309, 16266, 16251, 13292,
];

/** Honest, computed figures for the EMA-band BTC hedge over the window above. */
export const HEDGE_STATS = {
  cagr: '+24.5%',
  maxDd: '−30%',
  sharpe: '0.83',
  total: '+164%',
  bhCagr: '+6.6%',
  bhMaxDd: '−67%',
  bhTotal: '+33%',
} as const;
