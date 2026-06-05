import { test, expect, type Page, type Route, type BrowserContext } from '@playwright/test';

/**
 * E2E happy path for the account-type (HEDGING) feature.
 *
 * Scope: a user creates a HEDGING account, the strategy picker then offers ONLY
 * hedging strategies, binds one (`ensemble_trend`), edits the metadata-driven
 * params, and the HEDGING surfaces (dashboard allocation widget + "Rebalances"
 * monitor) render.
 *
 * The whole backend is mocked with `page.route('**\/api/v1/**', ...)` — this
 * spec needs NO real backend, only the Next dev server (`webServer` in
 * playwright.config.ts boots `pnpm dev` on :3000). Mocked responses mirror the
 * backend envelope `{ responseCode, data }` that `src/lib/api/client.ts`
 * unwraps, and the snake/camel wire field names the API mappers expect.
 *
 * Auth: the app gates non-public routes in `src/middleware.ts` on the
 * `blackheart-session` signal cookie, and enables the data queries once the
 * persisted zustand auth store (`localStorage['blackheart:auth']`) hydrates a
 * `user` (queries are `enabled: Boolean(user.id)`). We seed BOTH before the
 * first navigation, mirroring how a real login leaves the tab.
 */

// ---- Fixtures (wire shapes match the backend DTOs the mappers consume) ------

const USER = {
  userId: 'user-e2e-0001',
  email: 'hedger@example.com',
  fullName: 'Hedge Tester',
  role: 'USER',
  createdTime: '2026-01-01T00:00:00Z',
  emailVerified: true,
};

const HEDGING_ACCOUNT_ID = 'acct-hedging-0001';

/** Backend `accounts` row (BackendAccountSummary). `accountType: 'HEDGING'` is
 *  the field under test; `isActive: '1'` so the account is usable. */
const HEDGING_ACCOUNT = {
  accountId: HEDGING_ACCOUNT_ID,
  userId: USER.userId,
  username: 'Hedge Book',
  exchange: 'BNC',
  isActive: '1',
  createdTime: '2026-02-01T00:00:00Z',
  accountType: 'HEDGING',
  maxConcurrentLongs: 2,
  maxConcurrentShorts: 2,
  maxConcurrentTrades: null,
  volTargetingEnabled: false,
  bookVolTargetPct: 15,
};

/** The hedging definition the picker must offer. `specJsonb.params` drives the
 *  metadata param form (erThreshold / deadband / maxWeight / priceBand). */
const ENSEMBLE_TREND_DEF = {
  strategyDefinitionId: 'def-ensemble-trend',
  strategyCode: 'ensemble_trend',
  strategyName: 'Ensemble Trend',
  strategyType: 'TREND',
  strategyKind: 'HEDGING',
  description: 'Spot BTC/USDT trend allocation',
  status: 'ACTIVE',
  archetype: 'ensemble_trend',
  archetypeVersion: 1,
  specJsonb: { params: { erThreshold: 0.2, deadband: 0.1, maxWeight: 1, priceBand: 0.03 } },
  enabled: true,
  simulated: true,
  createdTime: '2026-01-10T00:00:00Z',
  updatedTime: '2026-01-10T00:00:00Z',
};

/** A TRADING definition that must NOT appear in a HEDGING account's picker. */
const TRADING_DEF = {
  strategyDefinitionId: 'def-lsr',
  strategyCode: 'LSR',
  strategyName: 'Liquidity Sweep Reversal',
  strategyType: 'REVERSAL',
  strategyKind: 'TRADING',
  description: 'Directional reversal',
  status: 'ACTIVE',
  archetype: 'LEGACY_JAVA',
  archetypeVersion: 1,
  specJsonb: null,
  enabled: true,
  simulated: true,
  createdTime: '2026-01-10T00:00:00Z',
  updatedTime: '2026-01-10T00:00:00Z',
};

const BOUND_STRATEGY_ID = 'as-ensemble-0001';

/** The hedging binding (BackendAccountStrategy) returned after POST + on list +
 *  on detail. `strategyKind: 'HEDGING'` + non-LEGACY archetype routes the detail
 *  page's Parameters tab to the metadata-driven HedgingParamForm. */
const BOUND_STRATEGY = {
  id: BOUND_STRATEGY_ID,
  accountStrategyId: BOUND_STRATEGY_ID,
  accountId: HEDGING_ACCOUNT_ID,
  strategyDefinitionId: ENSEMBLE_TREND_DEF.strategyDefinitionId,
  strategyCode: 'ensemble_trend',
  strategyKind: 'HEDGING',
  archetype: 'ensemble_trend',
  presetName: 'Hedge default',
  symbol: 'BTCUSDT',
  interval: '1h',
  enabled: false,
  simulated: true,
  capitalAllocationPct: 75,
  maxOpenPositions: 1,
  allowLong: true,
  allowShort: false,
  priorityOrder: 1,
  createdTime: '2026-02-02T00:00:00Z',
  updatedTime: '2026-02-02T00:00:00Z',
  visibility: 'PRIVATE',
  ownedByCurrentUser: true,
  ownerLabel: 'You',
};

/** Minimal portfolio so the allocation widget has equity to read. */
const PORTFOLIO = {
  accountId: HEDGING_ACCOUNT_ID,
  totalUsdt: 100000,
  availableUsdt: 25000,
  lockedUsdt: 75000,
  assets: [
    { asset: 'BTC', free: 1.1, locked: 0, usdtValue: 75000 },
    { asset: 'USDT', free: 25000, locked: 0, usdtValue: 25000 },
  ],
};

// ---- Helpers ----------------------------------------------------------------

/** Backend envelope the axios response interceptor unwraps to `data`. */
function envelope(data: unknown) {
  return { responseCode: '0', responseDesc: 'SUCCESS', data };
}

function fulfill(route: Route, data: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(envelope(data)),
  });
}

/**
 * Seed auth the way a successful login leaves the browser: the signal cookie
 * (read by middleware) + the persisted zustand store (rehydrated to a `user`,
 * which enables the data queries and re-writes the cookie on rehydration).
 */
async function seedAuth(context: BrowserContext, page: Page, baseURL: string) {
  const { hostname } = new URL(baseURL);
  await context.addCookies([
    {
      name: 'blackheart-session',
      value: '1',
      domain: hostname,
      path: '/',
      sameSite: 'Lax',
    },
  ]);
  const persisted = JSON.stringify({
    state: {
      user: {
        id: USER.userId,
        email: USER.email,
        name: USER.fullName,
        role: USER.role,
        createdAt: USER.createdTime,
        emailVerified: true,
      },
    },
    version: 0,
  });
  // Runs before any app script on every document in this page.
  await page.addInitScript((value) => {
    window.localStorage.setItem('blackheart:auth', value);
  }, persisted);
}

/**
 * Install one router for every `/api/v1/**` call. `accountsCreated` is the only
 * piece of mutable state — it flips from an empty accounts list to the
 * one-HEDGING-account list once POST /accounts has run, so the create flow is
 * observable end-to-end.
 */
async function mockApi(page: Page) {
  const state = { accountsCreated: false };

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const method = request.method();
    // Strip query + origin so matching is on the pathname only.
    const path = new URL(request.url()).pathname;

    // --- auth ---
    if (path.endsWith('/api/v1/users/me')) {
      return fulfill(route, USER);
    }
    if (path.endsWith('/api/v1/users/logout')) {
      return fulfill(route, {});
    }

    // --- accounts ---
    if (path.endsWith('/api/v1/accounts') && method === 'GET') {
      return fulfill(route, state.accountsCreated ? [HEDGING_ACCOUNT] : []);
    }
    if (path.endsWith('/api/v1/accounts') && method === 'POST') {
      state.accountsCreated = true;
      // Echo the created account (type taken from the request would be ideal,
      // but the dialog always submits HEDGING in this flow).
      return fulfill(route, HEDGING_ACCOUNT);
    }

    // --- strategy definitions (catalogue) ---
    if (path.endsWith('/api/v1/strategy-definitions') && method === 'GET') {
      return fulfill(route, [ENSEMBLE_TREND_DEF, TRADING_DEF]);
    }

    // --- account-strategies (bindings) ---
    if (path.endsWith('/api/v1/account-strategies') && method === 'POST') {
      return fulfill(route, BOUND_STRATEGY);
    }
    if (path.endsWith('/api/v1/account-strategies') && method === 'GET') {
      // Only show the binding once it has been created.
      return fulfill(route, state.accountsCreated ? [BOUND_STRATEGY] : []);
    }
    if (path.includes('/api/v1/account-strategies/') && method === 'GET') {
      // Detail read (and any sub-reads) → the bound strategy.
      return fulfill(route, BOUND_STRATEGY);
    }

    // --- strategy params (HedgingParamForm presets) ---
    if (path.endsWith('/api/v1/strategy-params') && method === 'GET') {
      return fulfill(route, []); // no override preset yet → edit from spec defaults
    }
    if (path.endsWith('/api/v1/strategy-params') && method === 'POST') {
      const body = request.postDataJSON() as { overrides?: Record<string, number> };
      return fulfill(route, {
        paramId: 'param-0001',
        accountStrategyId: BOUND_STRATEGY_ID,
        name: 'Hedging params',
        overrides: body?.overrides ?? {},
        active: true,
        deleted: false,
        deletedAt: null,
        sourceBacktestRunId: null,
        version: 1,
        createdAt: '2026-02-02T00:00:00Z',
        createdBy: USER.userId,
        updatedAt: '2026-02-02T00:00:00Z',
        updatedBy: USER.userId,
      });
    }

    // --- dashboard / monitor reads ---
    if (path.endsWith('/api/v1/portfolio')) {
      return fulfill(route, PORTFOLIO);
    }
    if (path.endsWith('/api/v1/trades/stats')) {
      return fulfill(route, {
        cumulativePnl: 0, winRate: 0, profitFactor: null, avgWin: null,
        avgLoss: null, tradeCount: 0, winCount: 0, lossCount: 0,
      });
    }
    if (path.includes('/api/v1/trades')) {
      // Trades list / open trades / rebalance source — empty page is fine.
      return fulfill(route, { content: [], page: 0, size: 20, total: 0 });
    }

    // Anything else the dashboard incidentally fetches → empty array (safe for
    // every list endpoint; extractList tolerates it).
    return fulfill(route, []);
  });
}

// ---- The happy path ---------------------------------------------------------

test.describe('Account type — HEDGING happy path', () => {
  // The New Account dialog is tall (safety banner + IP card + 5 fields + ack +
  // footer). Radix centers it with a transform and the shell is overflow-hidden,
  // so a short viewport pushes the footer/submit button off-screen and out of
  // reach of scrolling. A tall viewport keeps the whole dialog actionable.
  test.use({ viewport: { width: 1280, height: 1600 } });

  test('create HEDGING account → bind hedging strategy → edit params → monitor', async ({
    page,
    context,
    baseURL,
  }) => {
    const base = baseURL ?? 'http://localhost:3000';
    await mockApi(page);
    await seedAuth(context, page, base);

    // --- 1. Create a HEDGING account from the New Account dialog ------------
    await page.goto('/strategies');

    // The account switcher offers a "Connect account" affordance when the user
    // has none (its accessible name is the aria-label "Connect your first
    // exchange account").
    await page.getByRole('button', { name: /connect.*exchange account/i }).click();

    const accountDialog = page.getByRole('dialog');
    await expect(accountDialog.getByText(/connect exchange account/i)).toBeVisible();

    // Select the HEDGING account type (segmented toggle: Trading | Hedging).
    await accountDialog.getByRole('button', { name: 'Hedging' }).click();
    await expect(accountDialog.getByRole('button', { name: 'Hedging' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Required fields: label + API key + secret + the withdrawal-disabled ack.
    await accountDialog.getByPlaceholder('Main').fill('Hedge Book');
    await page.locator('#account-api-key').fill('mockapikey1234567890');
    await page.locator('#account-api-secret').fill('mockapisecret1234567890');
    // The checkbox is wrapped by a clickable <label> (its styled span overlaps
    // the input and intercepts pointer events). Click the label's text to
    // toggle the underlying controlled checkbox, then assert it is checked.
    const safetyCheckbox = accountDialog.getByRole('checkbox', {
      name: /withdrawal permissions/i,
    });
    // The dialog's stacking context confuses pointer hit-testing (an ancestor
    // div is reported as intercepting), so a normal click never lands. Drive the
    // checkbox through React's controlled-input contract: use the native
    // `checked` setter (so React's value-tracker sees the change) then dispatch a
    // bubbling click — React maps checkbox onChange to the click event. This
    // updates `form.acknowledgedSafety` and enables the submit button.
    await safetyCheckbox.evaluate((el) => {
      // A native click on an unchecked checkbox toggles it to checked AND fires
      // React's synthetic onChange — no manual `.checked` poke needed (that would
      // double-toggle). Dispatching in JS sidesteps the pointer interception.
      (el as HTMLInputElement).click();
    });
    await expect(safetyCheckbox).toBeChecked();

    await accountDialog.getByRole('button', { name: /connect account/i }).click();

    // After create, useCreateAccount auto-selects the first account → the
    // switcher reflects the new HEDGING account with its type badge.
    await expect(page.getByRole('button', { name: /switch account/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /switch account/i }).getByText('Hedging'),
    ).toBeVisible();

    // --- 2. New Strategy dialog offers ONLY hedging strategies --------------
    await page.getByRole('button', { name: /new preset/i }).click();

    const strategyDialog = page.getByRole('dialog');
    await expect(strategyDialog.getByText('New Strategy')).toBeVisible();

    // The Strategy field is a shadcn <Select> (combobox). For a HEDGING account
    // the catalogue is kind-filtered, so the trigger auto-selects the first
    // valid hedging definition (ensemble_trend). Open it to inspect the options.
    const strategyTrigger = strategyDialog
      .getByRole('combobox')
      .filter({ hasText: /ensemble_trend|Select a strategy|Loading|No strategies/i })
      .last();
    await strategyTrigger.click();

    // The hedging option is present in the picker...
    await expect(page.getByRole('option', { name: /ensemble_trend/i })).toBeVisible();
    // ...and the TRADING definition (LSR) is absent — the kind filter at work.
    await expect(page.getByRole('option', { name: /Liquidity Sweep Reversal/i })).toHaveCount(0);
    await expect(page.getByRole('option', { name: /^LSR\b/ })).toHaveCount(0);

    // Choose the hedging strategy + bind it.
    await page.getByRole('option', { name: /ensemble_trend/i }).click();
    await strategyDialog.getByRole('button', { name: /create strategy/i }).click();

    // --- 3. Binding config renders the metadata-driven hedging params ------
    await page.goto(`/strategies/${BOUND_STRATEGY_ID}`);
    await page.getByRole('tab', { name: 'Parameters' }).click();

    // The hedging param inputs (id="hedging-param-<key>") render from
    // specJsonb.params: erThreshold / deadband / maxWeight / priceBand.
    await expect(page.locator('#hedging-param-erThreshold')).toBeVisible();
    await expect(page.locator('#hedging-param-erThreshold')).toHaveValue('0.2');
    await expect(page.locator('#hedging-param-deadband')).toBeVisible();
    await expect(page.locator('#hedging-param-maxWeight')).toBeVisible();
    await expect(page.locator('#hedging-param-priceBand')).toBeVisible();

    // --- 4. HEDGING dashboard shows the allocation widget ------------------
    await page.goto('/');
    // AllocationStatCards / AllocationPanel surface the BTC vs cash split.
    await expect(page.getByText(/allocation/i).first()).toBeVisible();
    // BTC weight is 75% of equity (75k / 100k) — the widget renders a %.
    await expect(page.getByText(/75/).first()).toBeVisible();

    // --- 5. The monitor reads "Rebalances" --------------------------------
    await page.goto('/trades');
    // The HEDGING monitor retitles the page via the account view's
    // monitorLabel → an <h1> reading "Rebalances".
    await expect(
      page.getByRole('heading', { level: 1, name: 'Rebalances' }),
    ).toBeVisible();
  });
});
