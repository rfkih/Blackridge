import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- mock the axios client the api module calls ---
const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();
vi.mock('./client', () => ({
  apiClient: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: (...a: unknown[]) => patch(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));

import {
  listRegistry,
  createRegistryEntry,
  updateRegistryEntry,
  archiveRegistryEntry,
} from './researchRegistry';

const BASE = '/api/v1/research-orch/strategy-registry';

const EMPTY_PAGE = { data: { items: [], total: 0, tierCounts: {}, statusCounts: {} } };

describe('researchRegistry api', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    del.mockReset();
  });

  it('listRegistry sends only the set filters (snake_case include_archived)', async () => {
    get.mockResolvedValue(EMPTY_PAGE);
    await listRegistry({ tier: 'TIER_A', search: 'vrp', includeArchived: true });
    expect(get).toHaveBeenCalledWith(BASE, {
      params: { tier: 'TIER_A', search: 'vrp', include_archived: true },
    });
  });

  it('listRegistry omits undefined filters and drops include_archived when false', async () => {
    get.mockResolvedValue(EMPTY_PAGE);
    await listRegistry({});
    expect(get).toHaveBeenCalledWith(BASE, { params: {} });
  });

  it('listRegistry returns the unwrapped response body', async () => {
    get.mockResolvedValue({ data: { items: [{ slug: 'x' }], total: 1, tierCounts: {}, statusCounts: {} } });
    const res = await listRegistry();
    expect(res.total).toBe(1);
    expect(res.items[0].slug).toBe('x');
  });

  it('createRegistryEntry POSTs the snake_case body to BASE', async () => {
    post.mockResolvedValue({ data: { registryId: 'r1', slug: 's' } });
    const body = {
      slug: 's', promise_tier: 'TIER_A', display_name: 'D',
      verdict_tag: 'REAL_LEAD', lifecycle_status: 'LEAD', thesis: 't',
    };
    const res = await createRegistryEntry(body);
    expect(post).toHaveBeenCalledWith(BASE, body);
    expect(res.slug).toBe('s');
  });

  it('updateRegistryEntry PATCHes by id', async () => {
    patch.mockResolvedValue({ data: { registryId: 'r1', rank: 9 } });
    await updateRegistryEntry('r1', { rank: 9 });
    expect(patch).toHaveBeenCalledWith(`${BASE}/r1`, { rank: 9 });
  });

  it('archiveRegistryEntry DELETEs by id', async () => {
    del.mockResolvedValue({});
    await archiveRegistryEntry('r1');
    expect(del).toHaveBeenCalledWith(`${BASE}/r1`);
  });
});
