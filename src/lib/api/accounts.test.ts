import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BackendAccountSummary } from '@/types/account';

import { getMyAccounts, createAccount } from './accounts';

// --- mock the axios client the api module calls ---
const get = vi.fn();
const post = vi.fn();
vi.mock('./client', () => ({
  apiClient: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
  },
}));

function mkBackend(p: Partial<BackendAccountSummary>): BackendAccountSummary {
  return {
    accountId: 'acc-1',
    userId: 'user-1',
    username: 'Main',
    exchange: 'BIN',
    isActive: '1',
    createdTime: '2026-05-01T00:00:00Z',
    ...p,
  };
}

describe('accounts mapper', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it('defaults a missing accountType to TRADING (legacy rows)', async () => {
    get.mockResolvedValue({ data: [mkBackend({})] });
    const [acc] = await getMyAccounts();
    expect(acc.accountType).toBe('TRADING');
  });

  it('defaults an unknown accountType to TRADING', async () => {
    get.mockResolvedValue({ data: [mkBackend({ accountType: 'BOGUS' })] });
    const [acc] = await getMyAccounts();
    expect(acc.accountType).toBe('TRADING');
  });

  it('passes through a HEDGING accountType', async () => {
    get.mockResolvedValue({ data: [mkBackend({ accountType: 'HEDGING' })] });
    const [acc] = await getMyAccounts();
    expect(acc.accountType).toBe('HEDGING');
  });

  it('passes through a TRADING accountType', async () => {
    get.mockResolvedValue({ data: [mkBackend({ accountType: 'TRADING' })] });
    const [acc] = await getMyAccounts();
    expect(acc.accountType).toBe('TRADING');
  });
});

describe('createAccount payload', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    post.mockResolvedValue({ data: mkBackend({ accountType: 'HEDGING' }) });
  });

  it('includes accountType in the payload when present', async () => {
    await createAccount({
      username: 'Hedge',
      exchange: 'BIN',
      apiKey: 'k',
      apiSecret: 's',
      acknowledgedSafety: true,
      accountType: 'HEDGING',
    });
    expect(post).toHaveBeenCalledWith(
      '/api/v1/accounts',
      expect.objectContaining({ accountType: 'HEDGING' }),
    );
  });

  it('omits accountType when not provided', async () => {
    await createAccount({
      username: 'Trade',
      exchange: 'BIN',
      apiKey: 'k',
      apiSecret: 's',
      acknowledgedSafety: true,
    });
    const payload = post.mock.calls[0][1] as Record<string, unknown>;
    expect('accountType' in payload).toBe(false);
  });

  it('maps the returned accountType on the created account', async () => {
    const acc = await createAccount({
      username: 'Hedge',
      exchange: 'BIN',
      apiKey: 'k',
      apiSecret: 's',
      acknowledgedSafety: true,
      accountType: 'HEDGING',
    });
    expect(acc.accountType).toBe('HEDGING');
  });
});
