'use client';

import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrencyRates, type CurrencyRates } from '@/lib/api/rates';
import { useAuthStore } from '@/store/authStore';
import { useCurrencyStore, type DisplayCurrency } from '@/store/currencyStore';

const RATES_QUERY_KEY = ['currency', 'rates'] as const;

/**
 * Backing query for the display-currency toggle. Refetches every 60s so
 * BTC/IDR conversions stay within a handful of seconds of the live rate
 * without hammering the upstream.
 *
 * <p>Gates on `user?.id` rather than `isAuthenticated` because the auth
 * store only persists `user` — on a hard refresh `isAuthenticated` reads
 * `false` until `/me` completes, which would leave the query disabled and
 * force IDR/BTC to render as "—" until the user clicked something.
 */
export function useCurrencyRates() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<CurrencyRates>({
    queryKey: RATES_QUERY_KEY,
    queryFn: getCurrencyRates,
    enabled: Boolean(userId),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

/** Format options for {@link useCurrencyFormatter} — mirrors Intl.NumberFormat's
 *  fractionDigits but picked at each call site so the caller keeps control. */
export interface CurrencyFormatOptions {
  /** Default is currency-aware (2 for USD/IDR, 8 for BTC). */
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  /** Prepend a "+" on positive values — useful for P&L cells. */
  withSign?: boolean;
  /** Omit the currency symbol/suffix. Numeric body only. */
  omitUnit?: boolean;
}

/**
 * Returns a formatter that converts a USDT value into the user's chosen
 * display currency. USDT is treated as 1:1 with USD — that's how the backend
 * records balances and P&L, so USD is the identity mode.
 *
 * Examples (amount = 1234.5):
 *   USD → "$1,234.50"
 *   IDR → "Rp 19.752.000"
 *   BTC → "₿ 0.01899" (with live BTC ≈ 65,000)
 */
export function useCurrencyFormatter() {
  const currency = useCurrencyStore((s) => s.displayCurrency);
  const { data: rates } = useCurrencyRates();

  return useCallback(
    (usdtAmount: number, opts?: CurrencyFormatOptions): string =>
      formatCurrency(usdtAmount, currency, rates, opts),
    [currency, rates],
  );
}

/**
 * Pure formatter — safe to call outside React. Used internally by the hook;
 * exported so one-off call sites (e.g. server-rendered emails, tests) can
 * reuse it without wiring a hook.
 */
export function formatCurrency(
  usdtAmount: number,
  currency: DisplayCurrency,
  rates: CurrencyRates | undefined,
  opts?: CurrencyFormatOptions,
): string {
  if (!Number.isFinite(usdtAmount)) return '—';

  const withSign = opts?.withSign ?? false;
  const omitUnit = opts?.omitUnit ?? false;
  const sign = withSign && usdtAmount > 0 ? '+' : '';

  if (currency === 'BTC') {
    const btcPrice = rates?.btcUsdt && rates.btcUsdt > 0 ? rates.btcUsdt : null;
    if (btcPrice == null) return omitUnit ? '—' : '— BTC';
    const btc = usdtAmount / btcPrice;
    const min = opts?.minimumFractionDigits ?? 6;
    const max = opts?.maximumFractionDigits ?? 8;
    const body = formatNumber(btc, min, max);
    return omitUnit ? `${sign}${body}` : `${sign}₿ ${body}`;
  }

  if (currency === 'IDR') {
    const idrRate = rates?.idrUsd && rates.idrUsd > 0 ? rates.idrUsd : null;
    if (idrRate == null) return omitUnit ? '—' : '— IDR';
    const idr = usdtAmount * idrRate;
    const min = opts?.minimumFractionDigits ?? 0;
    const max = opts?.maximumFractionDigits ?? 0;
    const body = formatNumber(idr, min, max, 'id-ID');
    return omitUnit ? `${sign}${body}` : `${sign}Rp ${body}`;
  }

  // USD = identity. We still need thousands separators + decimals.
  const min = opts?.minimumFractionDigits ?? 2;
  const max = opts?.maximumFractionDigits ?? 2;
  const body = formatNumber(Math.abs(usdtAmount), min, max);
  const core = usdtAmount < 0 ? `-$${body}` : `$${body}`;
  return omitUnit ? `${sign}${formatNumber(usdtAmount, min, max)}` : `${sign}${core}`;
}

function formatNumber(v: number, min: number, max: number, locale = 'en-US'): string {
  // Intl rejects min > max — clamp so callers can override one bound without
  // having to restate the other (e.g. the sidebar passes only
  // `maximumFractionDigits: 0`, which would otherwise clash with the
  // currency-default `min = 2`).
  const safeMax = Math.max(0, Math.min(20, max));
  const safeMin = Math.max(0, Math.min(safeMax, min));
  return v.toLocaleString(locale, {
    minimumFractionDigits: safeMin,
    maximumFractionDigits: safeMax,
  });
}
