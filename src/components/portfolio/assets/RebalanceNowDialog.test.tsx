import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithClient } from '../../../../tests/unit/test-utils';
import { RebalanceNowDialog } from './RebalanceNowDialog';
import type { AssetRebalancePolicy } from '@/types/assetAllocation';

const ACC = 'acc-1';

const h = vi.hoisted(() => ({
  compute: vi.fn(),
  execute: vi.fn(),
  policy: vi.fn(),
  isAdmin: { value: true },
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/hooks/useAssetAllocation', () => ({
  useComputeAssetRebalancePlan: () => ({
    mutateAsync: h.compute,
    isPending: false,
    reset: vi.fn(),
  }),
  useExecuteRebalance: () => ({ mutateAsync: h.execute, isPending: false, reset: vi.fn() }),
  useUpdateAssetPolicy: () => ({ mutateAsync: h.policy, isPending: false, reset: vi.fn() }),
}));
vi.mock('@/hooks/useIsAdmin', () => ({ useIsAdmin: () => h.isAdmin.value }));
vi.mock('@/hooks/useCurrency', () => ({
  useCurrencyFormatter: () => (n: number) => `$${n.toFixed(2)}`,
}));
vi.mock('@/hooks/useToast', () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));

const PLAN_PROPOSED = {
  rebalanceId: 'rb-1',
  accountId: ACC,
  method: 'STATIC_TARGET',
  status: 'PROPOSED',
  portfolioValueUsdt: 140,
  estimatedCostUsdt: 0.08,
  estimatedBenefitUsdt: 57,
  skipReason: null,
  driftItems: [],
  tradePlan: [
    {
      action: 'SELL',
      asset: 'ETH',
      quoteAsset: 'USDT',
      estQuoteQtyUsdt: 36,
      estBaseQty: 0.02,
      referencePrice: 1779,
      reason: 'r',
    },
    {
      action: 'SELL',
      asset: 'BTC',
      quoteAsset: 'USDT',
      estQuoteQtyUsdt: 21,
      estBaseQty: 0.0003,
      referencePrice: 66000,
      reason: 'r',
    },
  ],
  generatedAt: '2026-06-16T03:00:00',
  lastRebalanceAt: null,
};

const PLAN_COOLDOWN = {
  ...PLAN_PROPOSED,
  status: 'SKIP_CALENDAR_FLOOR',
  rebalanceId: null,
  tradePlan: [],
  skipReason: 'Last rebalance was 0 days ago; policy requires 7 days.',
  lastRebalanceAt: '2026-06-15T03:00:00',
};

const COMPLETED = {
  id: 'rb-1',
  accountId: ACC,
  method: 'STATIC_TARGET',
  status: 'COMPLETED',
  triggeredBy: 'u',
  estimatedCostUsdt: 0.08,
  estimatedBenefitUsdt: 57,
  proposedAt: 'x',
  executedAt: 'y',
  completedAt: 'z',
  failedReason: null,
  driftSnapshot: [],
  tradePlan: [],
  executionSummary: { totalLegs: 2, succeeded: 2, failed: 0, actualNotionalUsdt: 57, legs: [] },
};

function policy(cap: number): AssetRebalancePolicy {
  return {
    id: 'p',
    accountId: ACC,
    calendarMinDays: 7,
    slippageBpsAssumed: 10,
    feeBpsAssumed: 4,
    usdtReserveFloorPct: 20,
    maxPerExecuteUsdt: cap,
    requireManualApproval: true,
    enabled: true,
    persisted: true,
    updatedTime: null,
  };
}

const noop = () => {};

describe('RebalanceNowDialog', () => {
  beforeEach(() => {
    h.compute.mockReset();
    h.execute.mockReset();
    h.policy.mockReset();
    h.toastSuccess.mockReset();
    h.toastError.mockReset();
    h.isAdmin.value = true;
    h.compute.mockResolvedValue(PLAN_PROPOSED);
    h.execute.mockResolvedValue(COMPLETED);
    h.policy.mockResolvedValue(policy(62));
  });

  it('gates Submit on typing EXECUTE, then runs persist-plan THEN execute', async () => {
    renderWithClient(
      <RebalanceNowDialog open onOpenChange={noop} accountId={ACC} policy={policy(1000)} />,
    );

    // Auto-preview renders the legs.
    expect(await screen.findByText('ETH')).toBeTruthy();
    const submit = screen.getByRole('button', { name: /submit trades/i }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('confirm-execute'), { target: { value: 'EXECUTE' } });
    expect(
      (screen.getByRole('button', { name: /submit trades/i }) as HTMLButtonElement).disabled,
    ).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /submit trades/i }));

    await waitFor(() => expect(h.execute).toHaveBeenCalledWith({ rebalanceId: 'rb-1' }));
    expect(h.compute).toHaveBeenCalledWith({ accountId: ACC, persist: true, force: false });
    // persist-plan resolves before execute fires.
    expect(h.compute.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      h.execute.mock.invocationCallOrder[0],
    );
  });

  it('blocks on cap exceeded and offers a raise-cap action', async () => {
    renderWithClient(
      <RebalanceNowDialog open onOpenChange={noop} accountId={ACC} policy={policy(50)} />,
    );

    // notional 57 > cap 50 → confirm input disabled, raise-cap button shown.
    const raise = await screen.findByRole('button', {
      name: /raise cap to \$62\.00 and continue/i,
    });
    expect((screen.getByLabelText('confirm-execute') as HTMLInputElement).disabled).toBe(true);

    fireEvent.click(raise);
    await waitFor(() =>
      expect(h.policy).toHaveBeenCalledWith({ accountId: ACC, maxPerExecuteUsdt: 62 }),
    );
  });

  it('shows the cooldown override for admins and re-previews with force', async () => {
    h.compute.mockReset();
    h.compute.mockResolvedValueOnce(PLAN_COOLDOWN).mockResolvedValueOnce(PLAN_PROPOSED);

    renderWithClient(
      <RebalanceNowDialog open onOpenChange={noop} accountId={ACC} policy={policy(1000)} />,
    );

    const override = await screen.findByRole('button', {
      name: /override cooldown and rebalance now/i,
    });
    fireEvent.click(override);
    await waitFor(() =>
      expect(h.compute).toHaveBeenCalledWith({ accountId: ACC, persist: false, force: true }),
    );
  });

  it('hides the cooldown override for non-admins', async () => {
    h.isAdmin.value = false;
    h.compute.mockReset();
    h.compute.mockResolvedValue(PLAN_COOLDOWN);

    renderWithClient(
      <RebalanceNowDialog open onOpenChange={noop} accountId={ACC} policy={policy(1000)} />,
    );

    expect(await screen.findByText(/cooldown is active/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /override cooldown/i })).toBeNull();
  });
});
