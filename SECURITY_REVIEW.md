# Blackheart Security Review

**Scope**: `C:\MyFiles\blackheart\blackheart` (Spring Boot backend) + `C:\MyFiles\blackheart\front-end` (Next.js 14)
**Type**: Authorized internal pentest / code audit (read-only — no code was modified).
**Date**: 2026-04-23
**Reviewer**: External security engineer

---

## 1. Executive Summary

The platform's trust model is fundamentally broken: any authenticated user can read or modify data belonging to any other user. Combined with plaintext storage of Binance API keys/secrets in Postgres and a trade-execution endpoint that accepts attacker-supplied API credentials, a single compromised or malicious `USER`-role account can exfiltrate every other tenant's API keys and trade on their behalf.

High-impact findings, worst first:

1. **Critical — Binance API keys + secrets stored plaintext in Postgres** (`Account.apiKey`, `Account.apiSecret`). Anyone with DB read access (including any backup or ops engineer) holds live withdraw-less keys; rotation story is zero. [Finding 2.1]
2. **Critical — Broad horizontal IDOR across most read/write endpoints**: `/api/v1/lsr-params/{id}`, `/api/v1/vcb-params/{id}`, `/api/v1/backtest/**`, `/api/v1/trades/account/{accountId}/**`, `/api/v1/scheduler/**`. A `USER` token lets you read/modify another tenant's strategy parameters, cancel their backtests, and read their live PnL. [Findings 2.2, 2.3, 2.5]
3. **Critical — STOMP topic hijack**: SUBSCRIBE frames are not authorized. `WebSocketAuthInterceptor` only checks the CONNECT frame; any authenticated session can `SUBSCRIBE /topic/pnl/<other-users-account-id>` and receive that account's live PnL. The `/pnl.subscribe` ownership check in `LivePnlWebSocketController` is bypassable by subscribing to the broadcast topic directly. [Finding 2.4]
4. **Critical — Trade-execution endpoint accepts client-supplied API credentials without ownership checks**: `POST /api/v1/trade/place-market-order-binance` takes `apiKey` + `apiSecret` in the request body and forwards them to Binance. Combined with Finding 2.1 (plaintext keys in DB), anyone who exfiltrates or inherits keys can drive real trades through the platform as a laundering conduit. [Finding 2.5]
5. **High — JWT in `localStorage` + non-httpOnly cookie**: XSS anywhere on `app.*` lifts the token; the cookie mirror is also JS-readable. No refresh / rotation / revocation strategy, 24-hour lifetime. [Finding 2.6]
6. **High — No rate limiting or brute-force protection on `/api/v1/users/login` or `/register`**: 8-char minimum passwords, no complexity rules, no lockout. [Finding 2.9]
7. **High — Outdated & vulnerable dependencies**: Spring Boot 3.2.3, `org.json:20210307` (CVE-2022-45688 stack overflow), `bcprov-jdk15on:1.70` (multiple CVEs, wrong artefact for JDK 17+). [Finding 2.11]
8. **Medium — No security headers on Next.js responses**: `next.config.mjs` is empty — no CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy. Amplifies the XSS impact in Finding 2.6. [Finding 2.10]

---

## 2. Findings

### 2.1 Critical — Binance `apiKey` / `apiSecret` stored in plaintext

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\model\Account.java:54-58`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\service\user\AccountQueryService.java:84-85`
- Every call site that reads them, e.g. `TradeOpenService.java:92-93`, `TradeCloseService.java:184-185`, `PortfolioService.java:78-79, 99, 112-113, 130-131`.

**Description**: The `Account` JPA entity persists Binance credentials as plain `String` columns:

```java
// Account.java:54-58
@Column(name = "api_key", nullable = false)
private String apiKey;

@Column(name = "api_secret", nullable = false)
private String apiSecret;
```

`AccountQueryService.createAccount` stores them verbatim with no encryption:

```java
// AccountQueryService.java:79-93
Account account = new Account();
...
account.setApiKey(request.getApiKey());
account.setApiSecret(request.getApiSecret());
...
Account saved = accountRepository.save(account);
```

The Javadoc on `createAccount` even flags this: *"API key + secret arrive as plaintext over HTTPS and are stored verbatim — adding at-rest encryption is a follow-up (requires a key-management story)."* So the team knows, but it's still shipping.

**Impact**: Any path that reaches the `accounts` table (DB backup, read-replica, logical replication subscriber, SQL-injection on an unrelated table via the same DB user, disgruntled DBA, laptop snapshot of a dev DB with imported prod data, `pg_dump` in a bug report) yields live Binance credentials. Even though the keys are (hopefully) "withdraw-disabled" per the UI checkbox in `NewAccountDialog.tsx:244-246`, an attacker with trading scope can still:
- Issue adverse trades to cause losses.
- Sell assets at a bad price to drain value into a pre-positioned attacker account via order-matching.
- Read account balances / trade history (privacy breach).

**Recommended fix**:
- Encrypt at rest: use a symmetric envelope (e.g. AES-256-GCM) with the data-encryption key wrapped by a KMS-managed CMK (AWS KMS / GCP KMS / HashiCorp Vault). The application decrypts only when about to sign a Binance request; the DB never sees plaintext.
- If KMS is off the table short-term, at minimum derive a key from a separate env var (`DB_ENCRYPTION_KEY`) and wrap the columns with Hibernate `@Convert`:

```java
@Column(name = "api_key", nullable = false)
@Convert(converter = EncryptedStringConverter.class)
private String apiKey;
```

- Never store keys that have withdrawal permission — enforce IP allow-lists on the Binance side so the key is useless off the trading server even if exfiltrated.
- Add per-user KEK + per-row IV if you want defence against offline DB dumps.

---

### 2.2 Critical — IDOR on LSR / VCB strategy parameter endpoints

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\LsrStrategyParamController.java:71-125`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\VcbStrategyParamController.java` (same shape as LSR)
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\service\strategy\LsrStrategyParamService.java:94-208`

**Description**: These endpoints take an `accountStrategyId` path variable and call straight through to the repository with zero ownership check against the JWT's `userId`:

```java
// LsrStrategyParamController.java:71-81
@GetMapping("/{accountStrategyId}")
public ResponseEntity<ResponseDto> getParams(@PathVariable UUID accountStrategyId) {
    LsrParamResponse response = paramService.getParamResponse(accountStrategyId);
    ...
}

// LsrStrategyParamController.java:83-96
@PutMapping("/{accountStrategyId}")
public ResponseEntity<ResponseDto> putParams(
        @PathVariable UUID accountStrategyId,
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody LsrParamUpdateRequest request) {
    String callerEmail = extractEmail(authHeader);
    LsrParamResponse response = paramService.putParams(accountStrategyId, request, callerEmail);
    ...
}
```

```java
// LsrStrategyParamService.java:94-106 (getParamResponse)
public LsrParamResponse getParamResponse(UUID accountStrategyId) {
    Optional<LsrStrategyParam> entity = paramRepository.findByAccountStrategyId(accountStrategyId);
    return entity.map(e -> ...).orElseGet(...);
}

// LsrStrategyParamService.java:123-135 (putParams)
public LsrParamResponse putParams(UUID accountStrategyId, LsrParamUpdateRequest request, String updatedBy) {
    ...
    LsrStrategyParam entity = paramRepository.findByAccountStrategyId(accountStrategyId)
            .orElseGet(() -> LsrStrategyParam.builder().accountStrategyId(accountStrategyId).build());
    entity.setParamOverrides(newOverrides);
    ...
}
```

There is no `AccountStrategyService`-style user check anywhere in the service. The controller captures the caller's email for the `updatedBy` audit field but never verifies they own the `accountStrategy`.

**Impact**: Given any valid JWT (even a throwaway `USER` account created via the open registration endpoint), an attacker can:
- Enumerate `accountStrategyId` UUIDs (via brute force against `/api/v1/account-strategies` which honestly returns 404 for unknown, or by leaking IDs from shared screenshots / URL history).
- **GET** another tenant's strategy parameters — leaks the secret sauce the trader has tuned (ADX threshold, BB width, risk %, etc.).
- **PUT / PATCH** parameters on another tenant's strategy — set `allowLong=false`, `stopLossAtr=0.01`, `riskPercentage=99` → immediately bankrupt the victim's next live trade.
- **DELETE** — reset everything to defaults, silently destroying the trader's tuning work.

This is the highest-leverage finding — no DB access required, and it's a pure auth-Z bug on one of the most financially sensitive endpoints.

**Reproduction**:
```
# as attacker
TOKEN=$(curl -s POST /api/v1/users/register -d '{"email":"attacker@x.com","password":"password123","fullName":"A"}' | jq -r .data.accessToken)

# read victim's LSR params (victim's accountStrategyId known or brute-forced)
curl -H "Authorization: Bearer $TOKEN" /api/v1/lsr-params/${VICTIM_ACCOUNT_STRATEGY_ID}

# write malicious params that will bankrupt victim's next LSR trade
curl -XPUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"riskPercentage": 95, "stopLossAtr": 0.01}' \
  /api/v1/lsr-params/${VICTIM_ACCOUNT_STRATEGY_ID}
```

**Recommended fix**: Mirror `AccountStrategyService.getStrategyById` — resolve the `accountStrategy`, look up its `accountId`, then `accountId → userId`, reject if it doesn't match the JWT user. Do it in the service so the controller can't forget:

```java
public LsrParamResponse getParamResponse(UUID userId, UUID accountStrategyId) {
    AccountStrategy as = accountStrategyRepository.findById(accountStrategyId)
        .orElseThrow(() -> new EntityNotFoundException("Not found"));
    Account acc = accountRepository.findByAccountId(as.getAccountId())
        .orElseThrow(() -> new EntityNotFoundException("Not found"));
    if (!userId.equals(acc.getUserId())) {
        throw new EntityNotFoundException("Not found"); // don't leak existence
    }
    // ... proceed
}
```

Then extract `userId` in the controller via `extractUserId(authHeader)` like `AccountStrategyController` already does. Same fix applies to the VCB controller.

---

### 2.3 Critical — IDOR across backtest endpoints

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\BacktestV1Controller.java:36-117`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\model\BacktestRun.java` — no `user_id` / `account_id` column at all.
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\service\backtest\BacktestQueryService.java`

**Description**: `BacktestV1Controller` never extracts the caller's user id. `getRun`, `getTrades`, `getEquityPoints`, `getCandles`, `listRuns` all pass straight to the query service which queries by UUID with no user filter:

```java
// BacktestV1Controller.java:87-93
@GetMapping("/{id}")
public ResponseEntity<ResponseDto> getRun(@PathVariable UUID id) {
    return ResponseEntity.ok(ResponseDto.builder()
            .responseCode(HttpStatus.OK.value() + ResponseCode.SUCCESS.getCode())
            .data(backtestQueryService.getRun(id))
            .build());
}
```

The root cause is structural: `BacktestRun` has no owner column:

```java
// BacktestRun.java — zero user_id / account_id fields
@Entity
@Table(name = "backtest_run")
public class BacktestRun extends BaseEntity { ... }
```

`listRuns` is worse — it returns every backtest ever run by every user:

```java
// BacktestV1Controller.java:65-85 → BacktestQueryService.listRuns → BacktestRunRepository.findFiltered
// Where clause has no userId filter.
```

**Impact**: Any authenticated user can:
- Enumerate every backtest run, seeing strategy codes, symbols, date ranges, win rates, Sharpe ratios, net profit, etc. → reverse-engineer competitors' strategies.
- Fetch candles used for a run (minor but more surface).
- The submit endpoint is also unauthenticated-for-ownership: anyone can submit runs attributing them to any `accountStrategyId` they don't own. Since `BacktestRunRequest` validation doesn't verify ownership of `accountStrategyId` or the per-strategy `strategyAccountStrategyIds` map, an attacker can use another tenant's tuned params for their own backtest research.

**Recommended fix**:
- Add `account_id UUID NOT NULL` (or `user_id`) to `backtest_run`; populate at submit time from the authenticated user.
- Add a JWT-scoped filter to every query path: `findByIdAndUserId`, `findFiltered` gets a `userId` predicate.
- `BacktestV1Controller.runBacktest` should derive `accountStrategyId`'s owner and assert it matches `jwt.userId`.

---

### 2.4 Critical — STOMP SUBSCRIBE frames are not authorized (PnL cross-tenant leak)

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\config\WebSocketAuthInterceptor.java:42-71`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\service\websocket\LivePnlPublisherService.java:55`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\LivePnlWebSocketController.java`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\config\SecurityConfig.java:55-64` (`/ws/**` is `permitAll`)

**Description**: The `WebSocketAuthInterceptor` validates the JWT only on the `StompCommand.CONNECT` frame:

```java
// WebSocketAuthInterceptor.java:42-71
if (StompCommand.CONNECT.equals(accessor.getCommand())) {
    String token = extractToken(accessor);
    if (token == null) { throw new IllegalArgumentException(...); }
    ...
    accessor.setUser(principal);
    ...
}
return message;
```

SUBSCRIBE frames simply fall through. PnL is broadcast to a wildcard-style topic:

```java
// LivePnlPublisherService.java:52-58
private void publishOne(UUID accountId) {
    ActiveTradePnlResponse response = tradePnlQueryService.getCurrentActiveTradePnl(accountId);
    messagingTemplate.convertAndSend("/topic/pnl/" + accountId, response);
}
```

`LivePnlWebSocketController.subscribe` verifies ownership of `accountId` before *adding* the account to the publisher registry — but that gate only affects whether the publisher fan-out pulls PnL for that account each second. **Any STOMP session already subscribed to `/topic/pnl/<victimAccountId>` receives the broadcast** regardless of what the registry thinks about them. Worse, if the victim *or any other user in the same account* triggers the publisher to pull that account, every subscriber on that topic hears it.

Concretely, an attacker:
1. Gets a valid JWT via `/register` (open).
2. Opens STOMP over `/ws` and CONNECTs with the JWT.
3. Sends `SUBSCRIBE destination:/topic/pnl/<victim-account-uuid>` — no server-side check rejects this.
4. Waits for the victim to log in and have their own client call `/app/pnl.subscribe` (or any other session; the registry is shared), at which point the publisher broadcasts PnL frames on the topic and the attacker gets a copy.

Even without step 4, if `SUBSCRIBE` happens to arrive right before the scheduler tick and the registry already contains the victim's accountId, the attacker receives everything.

The CLAUDE.md in the backend even flags this exact pattern — the interceptor was added to close the CONNECT hole but the SUBSCRIBE hole remains.

**Impact**: Real-time leak of every open position, unrealized PnL, trade sizes, and by inference strategies of any user whose `accountId` the attacker can guess or enumerate.

**Recommended fix**:
- Extend `WebSocketAuthInterceptor.preSend` to also handle `StompCommand.SUBSCRIBE`:

```java
if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
    String destination = accessor.getDestination();
    StompPrincipal principal = (StompPrincipal) accessor.getUser();
    if (principal == null) throw new AccessDeniedException("Unauthenticated");
    if (destination != null && destination.startsWith("/topic/pnl/")) {
        UUID accountId = UUID.fromString(destination.substring("/topic/pnl/".length()));
        if (!accountRepository.existsByAccountIdAndUserId(accountId, principal.getUserId())) {
            throw new AccessDeniedException("Not your account");
        }
    }
    // same for /topic/sentiment — validate symbol allow-list or just allow (public data)
}
```

- Preferred: use Spring's user-destination prefix `/user/queue/pnl` with `convertAndSendToUser(principal, ...)` so messages go to the authenticated session, not a public topic. The project already declares `setUserDestinationPrefix("/user")` in `WebSocketConfig.java:42` — just switch the publisher to use it.
- Consider putting the STOMP endpoint behind the auth filter chain anyway — the current `permitAll` on `/ws/**` in `SecurityConfig` is defence-in-poverty; the interceptor is the only gate.

---

### 2.5 Critical — `TradeController` + `TradeQueryController` + `TradePnlQueryController` — no ownership checks

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\TradeController.java:29-46`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\TradeQueryController.java:20-27`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\TradePnlQueryController.java:21-27`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\SchedulerController.java` (same pattern, less impact)
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\HistoricalBackfillController.java`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\MonteCarloController.java`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\PortofolioController.java`

**Description**:

`TradeController` takes `BinanceOrderRequest` whose `apiKey`/`apiSecret` fields are supplied by the client:

```java
// TradeController.java:29-36
@PostMapping("/place-market-order-binance")
public ResponseEntity<ResponseDto> binanceMarketOrder(@RequestBody BinanceOrderRequest binanceOrderRequest) {
    BinanceOrderResponse response = tradeExecutionService.binanceMarketOrder(binanceOrderRequest);
    ...
}
```

```java
// BinanceOrderRequest.java:21-31
public class BinanceOrderRequest {
    private String symbol;
    private String side;
    private BigDecimal amount;
    @ToString.Exclude private String apiKey;
    @ToString.Exclude private String apiSecret;
}
```

There is no authorization at all — any authenticated user can submit a trade if they possess a Binance key+secret (either their own, or another's that has leaked). The server blindly forwards to the Node.js proxy. This lets the platform be weaponised as a high-trust market-order proxy for credentials obtained elsewhere; logs on this machine will show the legitimate user's JWT submitted the call.

`TradeQueryController.getActiveTradesByAccountId` and `TradePnlQueryController.getCurrentActiveTradePnl` both let any authenticated user fetch another user's active trades / live PnL by simply knowing the target `accountId` UUID (IDOR):

```java
// TradePnlQueryController.java:21-27
@GetMapping("/account/{accountId}/active-pnl")
public ResponseEntity<ResponseDto> getCurrentActiveTradePnl(@PathVariable UUID accountId) {
    return ResponseEntity.ok().body(ResponseDto.builder()
            ...
            .data(tradePnlQueryService.getCurrentActiveTradePnl(accountId))
            .build());
}
```

`SchedulerController` — unauthenticated start/stop of scheduler jobs per `schedulerId`/`jobName`:

```java
// SchedulerController.java:24-33
@PostMapping("/start")
public ResponseEntity<ResponseDto> startScheduler(@RequestBody SchedulerRequest request) {
    SchedulerJob schedulerJob = new SchedulerJob();
    schedulerJob.setJobName(request.getJobName());
    schedulerService.startScheduler(schedulerJob);
    ...
}
```

`HistoricalBackfillController`, `MonteCarloController`, `PortofolioController.reloadAsset` are also unscoped — any authenticated user can trigger cross-tenant jobs and cause disk/CPU exhaustion (DoS vector).

**Impact**:
- **TradeController**: full trade-execution endpoint open to any auth user; combined with Finding 2.1 (keys in DB → DBA can extract a key → use this endpoint from any user token) it's a straight line to unauthorized trades.
- **TradeQueryController / TradePnlQueryController**: live position + PnL leak by `accountId` enumeration.
- **SchedulerController**: unauthorized stop of the signal scheduler halts a victim's trading entirely.
- **MonteCarlo / Backfill / Reload**: CPU/IO DoS.

**Recommended fix**:
- Remove `apiKey`/`apiSecret` from `BinanceOrderRequest` entirely. The platform must derive the Binance creds from the authenticated user's `Account` row (after encryption per 2.1), never accept them from the client.
- Add `@PreAuthorize("hasRole('ADMIN')")` on manual trade/scheduler/backfill controllers, or remove these endpoints from the public surface entirely — they look like dev conveniences that shipped.
- Gate `TradeQueryController` + `TradePnlQueryController` on ownership of the `accountId`.

---

### 2.6 High — JWT stored in `localStorage` + JS-readable cookie

**Affected**:
- `C:\MyFiles\blackheart\front-end\src\store\authStore.ts:8-63`
- `C:\MyFiles\blackheart\front-end\src\middleware.ts:4-30`
- `C:\MyFiles\blackheart\front-end\src\lib\api\client.ts:16-22`

**Description**:

```ts
// authStore.ts:11-19
function writeTokenCookie(token: string | null) {
  if (typeof document === 'undefined') return;
  const secure = process.env.NODE_ENV === 'production' ? '; secure' : '';
  if (token) {
    document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; samesite=lax; max-age=${TOKEN_COOKIE_MAX_AGE}${secure}`;
  }
  ...
}

// authStore.ts:49-52
{
  name: 'blackheart:token',
  storage: createJSONStorage(() => localStorage),
  ...
}
```

The JWT is written both to `localStorage` (for Axios) and to a `samesite=lax` cookie that is **not** `HttpOnly` (it's written via `document.cookie`, so by construction JS can read it) — used by Next middleware to gate routes. Either storage is fully readable by any JS that runs on the origin, so any XSS (including a future supply-chain compromise of one of the 60+ npm dependencies) lifts the session.

Secondary issues:
- Token lifetime is 24 h with no refresh token and no server-side revocation (JWT stays valid if stolen until expiry).
- Middleware only checks *presence* of the cookie, not signature/expiry (`middleware.ts:20-23`) — a malformed cookie slips past middleware; the eventual API call 401s, but that's the bug the mini-SPA handles by redirecting. Mostly cosmetic; not a direct vuln.
- `apiClient.interceptors.request.use` does not scope the Authorization header to the API origin (`client.ts:16-22`). If a future code path calls `apiClient.get('https://evil.example.com/...')` with a full URL, the Bearer token is sent to a third party. It's a foot-gun; mitigate by asserting the URL starts with `env.apiUrl`.

**Impact**: XSS anywhere in the app (stored strategy name with HTML, rogue chart tooltip, future 3P widget, npm supply-chain compromise) → full session theft → full account takeover.

**Recommended fix**:
- Move the JWT to an `HttpOnly; Secure; SameSite=Strict` cookie set by the backend on login. Browser JS never touches it; Axios sends it via `withCredentials: true`; Next middleware reads it on the edge. CORS already permits credentials.
- Add a short access-token lifetime (e.g. 15 min) + refresh-token rotation with a server-side denylist for revocation.
- Add origin-allow-list guard to the Axios request interceptor so Authorization is only attached for `baseURL`:
```ts
apiClient.interceptors.request.use((config) => {
  const urlIsAbsolute = /^https?:/i.test(config.url ?? '');
  const sameOrigin = !urlIsAbsolute || (config.url ?? '').startsWith(env.apiUrl);
  if (token && sameOrigin) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

---

### 2.7 Medium — `UserController` relies on `authHeader.substring(7)` instead of `SecurityContextHolder`

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\UserController.java:96-98`
- Same pattern in `AccountController.java:77-79`, `AccountStrategyController.java:96-98`, `PnlController.java:92-94`, `LsrStrategyParamController.java:129-131`, `VcbStrategyParamController.java`, `PortfolioController.java:32-34`, `UnifiedTradeController.java:48-50`, `StrategyDefinitionController.java:68`.

**Description**: Controllers re-parse the JWT to extract `userId`/`email`, bypassing Spring Security's populated `Authentication`:

```java
// UserController.java:96-98
private UUID extractUserId(String authHeader) {
    return jwtService.extractUserId(authHeader.substring(7));
}
```

This is fragile (the filter already validated the JWT; redoing it re-validates signature + expiry per call, and is a subtle place to introduce inconsistency) and miss-ably error-prone — if an endpoint forgets to call `extractUserId`, it silently operates on whatever the service default is. The `JwtAuthenticationFilter` already populates `SecurityContextHolder` with the `UserDetails`, but the project doesn't use it.

**Impact**: No immediate vulnerability, but this idiom is what makes IDOR bugs like 2.2, 2.3, 2.5 easy to write. A controller that forgets `extractUserId` compiles and runs; the standard Spring idiom would have been caught.

**Recommended fix**:
- Create a custom `AuthenticatedUser` holder and inject it via a Spring `HandlerMethodArgumentResolver` or use `@AuthenticationPrincipal` against a custom principal:

```java
@GetMapping("/me")
public ResponseEntity<ResponseDto> getMyProfile(@AuthenticationPrincipal AuthUser user) {
    return ResponseEntity.ok(...);
}
```

- Make controllers that operate on per-user resources take the principal as an argument, so "forgot to auth-scope" becomes a compile error.

---

### 2.8 Medium — Unbounded `BacktestRunRequest` (no max range / capital / sanity)

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\dto\request\BacktestRunRequest.java:20-80`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\service\backtest\BacktestService.java:134-166`

**Description**: `BacktestRunRequest` has no `@NotNull`/`@Size`/`@Min`/`@Max` anywhere; it's not `@Valid`-annotated at the controller either:

```java
// BacktestV1Controller.java:37
public ResponseEntity<ResponseDto> runBacktest(@RequestBody BacktestRunRequest request) {
```

Service-level validation (`BacktestService.validateRequest`) checks presence, but not bounds — no upper limit on `(endTime - startTime)`, no cap on `initialCapital`, and the `strategyParamOverrides` map is fully client-controlled `Map<String, Map<String, Object>>`.

**Impact**:
- DoS: submit a request with `startTime = 2000-01-01` and `interval=1m` → backtest iterates ~12M candles, pegs a CPU + blasts the DB.
- Unbounded `strategyParamOverrides` map is dead-lettered today (the TODO in `BacktestRunRequest.java:76-78` flags it's not plumbed yet), but the moment it's wired into `LsrParams.merge()` / `VcbParams.merge()`, an attacker who can inject arbitrary map keys gets whatever mass-assignment the merger allows. At a minimum this should be limited to the known param keys.

**Recommended fix**:
- Add `@Valid` + field-level constraints:
```java
public class BacktestRunRequest {
    @NotNull @Size(min = 1, max = 5) private List<@NotBlank String> strategyCodes;
    @NotBlank @Size(max = 12) private String asset;
    @NotBlank @Pattern(regexp = "1m|5m|15m|1h|4h|1d") private String interval;
    @NotNull @DecimalMin("0.01") @DecimalMax("10000000") private BigDecimal initialCapital;
    ...
}
```
- Enforce `Duration.between(startTime, endTime)` ≤ your longest sensible range per interval.
- When plumbing `strategyParamOverrides`, explicitly allow-list the merger's accepted keys and reject extras.

---

### 2.9 Medium — No rate limiting / brute-force protection; weak password policy

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\controller\UserController.java:49-65`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\dto\request\RegisterUserRequest.java:22-24`
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\service\user\UserService.java:82-103`

**Description**: No `Bucket4j`, `Resilience4j`, or any other rate limiter anywhere in the codebase (`rg "RateLimit|Bucket4j|Resilience4j"` returns zero hits). `/login` increments no counter, has no lockout, does not throttle by IP or email.

Password minimum is 8 chars, max 100, no complexity rules:

```java
// RegisterUserRequest.java:22-24
@NotBlank(message = "Password is required")
@Size(min = 8, max = 100, message = "Password must be between 8 and 100 characters")
private String password;
```

Registration is open (no invite code; not admin-gated). 8-character passwords with no dictionary check + no rate limit = online brute force trivially succeeds.

**Impact**: Credential-stuffing, online brute force, and account enumeration (login error for non-existent email vs wrong password both return `"Invalid email or password"` — good — but `register` returns `409` specifically for "email already exists", which is a direct enumeration oracle).

**Recommended fix**:
- Add Bucket4j per-IP and per-email throttle on `/login` + `/register`:
  - 5 login failures per 15 min per (IP+email), lock the account for 30 min after 10 failures.
  - 10 registrations per hour per IP.
- Enforce password strength: Zxcvbn score ≥ 3, or minimum 12 chars with at least one of each class.
- Consider passkey / WebAuthn MFA on login for a trading platform; at minimum TOTP for ADMIN.
- Keep `/register` behind a signup code or CAPTCHA if this isn't a public SaaS.

---

### 2.10 Medium — Next.js has no security headers (empty `next.config.mjs`)

**Affected**:
- `C:\MyFiles\blackheart\front-end\next.config.mjs` (just `const nextConfig = {}; export default nextConfig;`)

**Description**: `next.config.mjs` defines no `headers()` block, no CSP, no `X-Frame-Options`, no `Permissions-Policy`, no `Referrer-Policy`, no HSTS. `poweredByHeader` is left on. No `images.remotePatterns` restrictions either.

**Impact**: Amplifies XSS (Finding 2.6) — no CSP means a single reflected payload can call out to attacker-controlled domains. `X-Frame-Options: DENY` is missing so the app is clickjackable. `Referrer-Policy` not set → outbound requests leak the full URL including `?next=` and query-string auth artifacts.

**Recommended fix**:
```js
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",     // tighten once you move ThemeScript
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' " + (process.env.NEXT_PUBLIC_API_URL ?? '') + ' ' + (process.env.NEXT_PUBLIC_WS_URL ?? ''),
  "img-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'Content-Security-Policy', value: cspDirectives },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      ],
    }];
  },
};
```

---

### 2.11 Medium — Outdated dependencies with known CVEs

**Affected**:
- `C:\MyFiles\blackheart\blackheart\build.gradle`

**Specific flags**:
- **`org.springframework.boot 3.2.3`** (lines 3, 37). Spring Boot 3.2.x was EOL-tracked; 3.2.3 predates a number of spring-framework CVEs (e.g. CVE-2024-22259, CVE-2024-38820, CVE-2024-38819 path-traversal on static). Upgrade to latest 3.3.x or 3.4.x LTS.
- **`org.json:json:20210307`** (line 55). This is the old Douglas Crockford JSON lib; it has CVE-2022-45688 (stack overflow via nested JSON DoS). Also CVE-2023-5072 on newer versions. If the code even uses it, replace with Jackson which is already on the classpath.
- **`org.bouncycastle:bcprov-jdk15on:1.70`** (line 58). `bcprov-jdk15on` is the old pre-Java-15 coordinate; this project is on Java 21 (line 12). The maintained artefact for JDK 17+ is `bcprov-jdk18on`, with 1.78+ fixing several CVEs (CVE-2023-33201 LDAP injection, CVE-2024-30171 timing side-channel in TLS).
- **`org.postgresql:postgresql:42.6.0`** (line 54). 42.7.x is current; 42.6.0 has CVE-2024-1597 (SQL injection via `PreferQueryMode=SIMPLE` — not exploitable by default but worth upgrading).
- **`commons-codec:commons-codec:1.16.1`** — fine.
- **`io.jsonwebtoken:jjwt 0.12.6`** — current at time of writing, fine.
- **`@stomp/stompjs ^7.3.0`** — no known CVEs.
- **Next.js 14.2.35** — after CVE-2025-29927 middleware-bypass patch (patched in 14.2.25). OK.
- **Axios 1.15.0** — recent enough to cover CVE-2025-27152 SSRF (patched 1.8.2). OK.

**Recommended fix**:
- Add OWASP Dependency-Check or Snyk to CI — fail the build on High/Critical CVEs.
- Pin via `dependabot` / Renovate; Spring Boot major.minor should update at least quarterly.
- Replace `bcprov-jdk15on` with `bcprov-jdk18on:1.78.1`.
- Drop `org.json` if unused; otherwise bump to 20231013+.

---

### 2.12 Low — Dev-default JWT secret sentinel is good, but the `production-like` allow-list is incomplete

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\service\user\JwtService.java:66-95`
- `C:\MyFiles\blackheart\blackheart\src\main\resources\application.properties:74`

**Description**: The project correctly refuses to boot with the dev-default JWT secret when `spring.profiles.active ∈ {prod, production, staging, stg}`:

```java
// JwtService.java:66-67
private static final java.util.Set<String> PRODUCTION_LIKE_PROFILES =
        java.util.Set.of("prod", "production", "staging", "stg");
```

But: **if the process is started with no active profile at all** (the default), `activeProfiles` is empty, the check passes, and the insecure key is used with only a warning log. A rushed deployment where someone forgot to set `SPRING_PROFILES_ACTIVE=prod` ships the known-insecure key. Also missing: `preprod`, `uat`, `canary`.

**Impact**: If an ops mistake omits the profile env var, production silently runs with a JWT secret that is committed to the repo and known to everyone. Every JWT on that instance can be forged, bypassing all auth.

**Recommended fix**:
- Invert the check: refuse to boot with the sentinel unless the profile is *explicitly* `dev` or `test`.

```java
boolean isDevOrTest = Arrays.stream(environment.getActiveProfiles())
        .map(String::toLowerCase)
        .anyMatch(p -> p.equals("dev") || p.equals("test") || p.equals("local"));
if (DEV_ONLY_SECRET_SENTINEL.equals(jwtSecret) && !isDevOrTest) {
    throw new IllegalStateException("Refusing to start with dev-only JWT secret outside dev/test profiles");
}
```

- Remove the sentinel from `application.properties` entirely; make it a hard fail if `JWT_SECRET` is unset. The `@PostConstruct` already blocks blanks (line 71-75) — that's fine, but the defaulting in the properties file should require every deployment to supply it.

---

### 2.13 Low — `SecurityException` → HTTP 403 is a gift to enumeration; `GlobalExceptionHandler` echoes raw messages

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\exception\GlobalExceptionHandler.java:50-54, 140-160`

**Description**: `IllegalArgumentException` and `EntityNotFoundException` echo the raw exception message back to the client. Examples of messages reaching the client:
- `"Account not found: <uuid>"` (AccountQueryService.java:56, 67)
- `"Account strategy not found: <uuid>"` (AccountStrategyService.java:59-62)
- `"Backtest run not found: <uuid>"` (BacktestQueryService.java:115)

For ownership-check paths (the ones that *do* work), both "doesn't exist" and "not yours" collapse to the same message — good. For the IDOR paths (Findings 2.2/2.3/2.5) they don't even check ownership. But the same handler also bubbles `"Parameter 'x' has invalid value: <raw>"` which can echo attacker input into a DB-column-backed error path — minor XSS-via-error-message vector if the frontend renders the string as HTML (currently it doesn't, per `normalizeError` in `errorMap.ts`).

**Recommended fix**:
- Strip row-specific detail from 404 messages ("Not found" is enough).
- Keep the "safe generic" 500 fallback (`"An unexpected error occurred"` — good, line 194) for unhandled exceptions.

---

### 2.14 Low — Committed `.java~` editor backup file

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\client\BinanceClientService.java~`

**Description**: An editor backup of `BinanceClientService.java` is tracked by git (commit `7e92762 "add to 15m interval"`). Contents are near-duplicates of the current file. Risk is it drifts and someone uses it by accident; also surfaces a stale code path to anyone auditing the repo.

**Recommended fix**: `git rm` the `.java~` file and add `*.java~` to `.gitignore`.

---

### 2.15 Info — CORS allow-list is env-driven + credentialed, but missing `OPTIONS` cache

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\config\SecurityConfig.java:91-102`

**Description**: CORS is correctly restricted to `http://localhost:3000` (dev) with credentials enabled, not wildcard. Good. Minor: no `setMaxAge` — preflight repeats on every mutation. Also note `setAllowedHeaders("*")` is permissive; no real exploit, but `Authorization, Content-Type, X-Request-ID, X-Correlation-ID` would be tighter.

**Recommended fix**:
- `config.setMaxAge(3600L);`
- Allow-list specific headers once you know what the frontend actually sends.
- Ensure `WS_ALLOWED_ORIGINS` env var is set to exact prod origin — right now dev default `http://localhost:3000` in `application.properties:45` is the same pattern as the JWT sentinel: forget to override and you ship the default.

---

### 2.16 Info — WebSocket `/ws` path allowed unauthenticated in `SecurityConfig`, relies solely on STOMP interceptor

**Affected**:
- `C:\MyFiles\blackheart\blackheart\src\main\java\id\co\blackheart\config\SecurityConfig.java:59-60`

**Description**: `/ws` and `/ws/**` are `permitAll`. The only auth gate is `WebSocketAuthInterceptor` which fires after SockJS handshake. This is the Spring-recommended pattern when using STOMP-level auth, but it means any HTTP probe of `/ws` gets a 101 Upgrade and a CONNECT timeout rather than a 401 — fine, but worth knowing for logs.

Not a vuln on its own; becomes exploitable only combined with Finding 2.4.

---

## 3. Positive findings

Things the team got right — keep doing these:

- **`LoggingServiceImpl`** has a recursive Jackson-tree walk that redacts any field containing `password`, `secret`, `apikey`, `accesstoken`, `refreshtoken`, `privatekey` (case-insensitive, substring). That's a much more robust approach than a field allow-list. Covers nested DTOs too. (`LoggingServiceImpl.java:35-135`)
- **Passwords hashed with BCrypt via Spring's `BCryptPasswordEncoder`**. No home-rolled hashing. Password hash is never returned in any response DTO — `UserResponse` deliberately has no `passwordHash` field. (`UserService.java:113-121`, `UserResponse.java:14-27`)
- **`AccountSummaryResponse` explicitly excludes `apiKey`/`apiSecret`**, matching the "never leak creds" contract. (`AccountSummaryResponse.java:9-24`)
- **`BinanceOrderRequest` uses `@ToString.Exclude` on `apiKey`/`apiSecret`** so stray `log.info("{}", req)` can't leak them via Lombok's toString. (`BinanceOrderRequest.java:26-30`)
- **JPQL / Hibernate queries use `@Param` bindings**, not string concatenation. The sort-column-as-param trick in `BacktestRunRepository.findFiltered` is clever and safe (values are compared via `CASE WHEN :sortColumn = 'x'` not concatenated). (`BacktestRunRepository.java:53-82`)
- **STOMP CONNECT frame now requires a valid JWT** — closes the original blanket-WS hole. (`WebSocketAuthInterceptor.java:42-71`)
- **`LivePnlWebSocketController.subscribe` verifies account ownership** before adding to the subscription registry. (Still bypassable per Finding 2.4, but the intent is correct.)
- **CSRF disabled globally** — correct because auth is Bearer-token, not cookie-based. (`SecurityConfig.java:49`)
- **CORS is an explicit allow-list with credentials, not `"*"`**. (`SecurityConfig.java:91-102`)
- **`JwtService` fails fast on the dev-default secret in prod profiles** (albeit incompletely — see Finding 2.12). (`JwtService.java:69-95`)
- **Spring Security `@EnableMethodSecurity(prePostEnabled = true)`** is on, so `@PreAuthorize` works (used correctly in `StrategyDefinitionController`). (`SecurityConfig.java:38`)
- **Frontend `normalizeError`** never uses `dangerouslySetInnerHTML` on backend messages — they pass through as text. Good. The one `dangerouslySetInnerHTML` usage is a literal hard-coded string. (`errorMap.ts`, `ThemeScript.tsx:3-11`)
- **No raw `fetch` with stray `Authorization`**; Axios interceptor is the only place that attaches the token.
- **`.env.local` is properly gitignored** in frontend (`.env*.local` pattern) and backend (`.env`, `.env.*` etc.) so actual secrets aren't checked in. Only `.env.local` present has non-secret public vars.
- **No committed Binance / JWT / DB credentials** anywhere in source we audited. `API_CONTRACT.md` has only placeholder examples (`password123`, `eyJhbGci...`).

---

## 4. Recommended hardening roadmap

Prioritized by impact-per-effort. Suggest tackling these in order.

### P0 — Do now (24-72h)
1. **Fix the strategy-param IDOR (Finding 2.2)**. Smallest change, largest impact — add a user-ownership check in `LsrStrategyParamService` and `VcbStrategyParamService` before any read/write. *1 day.*
2. **Remove client-supplied `apiKey`/`apiSecret` from `BinanceOrderRequest` / `TradeController` (Finding 2.5)**. The trade-execution surface must pull creds from the authenticated user's `Account`, never trust the client. *1 day.*
3. **Encrypt Binance `api_key` / `api_secret` at rest** (Finding 2.1). Start with a symmetric envelope + `DB_ENCRYPTION_KEY` env var; migrate to KMS later. Data migration for existing rows. *2-3 days.*
4. **Add SUBSCRIBE-level authorization in `WebSocketAuthInterceptor`** (Finding 2.4). Gate `/topic/pnl/{accountId}` on ownership. Or switch publisher to `/user/queue/pnl`. *0.5 day.*
5. **Scope all backtest endpoints + `TradePnlQueryController` + `TradeQueryController` by user** (Findings 2.3, 2.5). Add `user_id` column to `backtest_run`, populate at submit, filter on read. *1-2 days.*

### P1 — This sprint (1-2 weeks)
6. **JWT to `HttpOnly` cookie** (Finding 2.6). Migrate frontend to `withCredentials: true`. *1-2 days.*
7. **Rate limiting on `/login` + `/register`** (Finding 2.9) — Bucket4j by IP+email, 5/15min with exponential backoff. *1 day.*
8. **Next.js security headers** (Finding 2.10) — CSP/XFO/HSTS/Referrer-Policy. *0.5 day, tune CSP over a few days.*
9. **`@Valid` + bounds on `BacktestRunRequest`** (Finding 2.8). Min/max on capital, max duration, whitelist for `strategyCodes` / `interval`. *0.5 day.*
10. **Strengthen password policy + zxcvbn check server-side**. *0.5 day.*
11. **Fix JWT sentinel refuse-to-boot logic** to require explicit `dev`/`test` profile (Finding 2.12). *30 minutes.*

### P2 — Next month
12. **Upgrade dependencies** (Finding 2.11) — Spring Boot to latest 3.3/3.4, BouncyCastle to `jdk18on`, drop `org.json`, Postgres JDBC to 42.7.x. Add OWASP Dependency-Check to CI. *2-3 days incl. regression testing.*
13. **Refresh-token rotation + server-side revocation list** (Finding 2.6). Access-token TTL 15min; refresh-token TTL 7d with rotation-on-use. *3-4 days.*
14. **Move controllers to `@AuthenticationPrincipal`** instead of `jwtService.extractUserId(substring(7))` (Finding 2.7). Makes future IDORs compile-time harder. *1-2 days.*
15. **Admin-gate `/api/v1/scheduler/**`, `/api/v1/historical/**`, `/api/v1/montecarlo/**`, `/v1/portofolio/reload` or remove from public surface** (part of Finding 2.5). *0.5 day.*
16. **WebAuthn / TOTP MFA** for ADMIN roles. *1 week.*
17. **Security logging / detection**: log every 401/403, every failed JWT parse, every SUBSCRIBE-denied. Pipe to SIEM / alert on anomalous rate. *2-3 days.*

### P3 — Housekeeping
18. Delete committed `BinanceClientService.java~` (Finding 2.14).
19. Tighten CORS: explicit `allowedHeaders`, `maxAge`. (Finding 2.15).
20. Remove dev `SPRING_PROFILES_ACTIVE=dev` SQL bind-parameter trace from any non-dev env (`application-dev.properties` — the file itself flags this).
21. Mask API key input in `NewAccountDialog` the same way the secret is masked (it's already in `font-mono tracking-wider` placeholder but the actual value is visible; consider a `type="password"` with a reveal toggle like the secret).

---

## 5. What I could not verify

- **Git history for leaked secrets**: I did not run `git log --all -p | grep -iE 'secret|apikey|password'` exhaustively because it wasn't feasible in the time budget. If the team has ever rotated a secret by committing and removing, the history likely still has it. Recommend running `trufflehog filesystem --repo_path .` on both repos.
- **Node.js proxy at `nodejs.api.base-url` (port 8088)** is outside the reviewed scope — that service receives `apiKey`/`apiSecret` from the Java backend over (presumably) `http://`. If it's not on the same host, those creds traverse an unencrypted channel. Worth a separate audit.
- **Binance key permissions in production**: UI has a checkbox "I confirm this API key has withdrawal disabled" but this is client-side self-attestation only. The backend does not call Binance `GET /api/v3/account` to verify permissions before accepting the key. Recommend probing `canWithdraw`/`canTrade` on add and rejecting keys with withdraw scope.
- **Python / FastAPI service at `fastapi.base-url`** — out of scope.
- **Frontend XSS surface**: I did not exhaustively walk every component for `innerHTML`-like injections beyond `dangerouslySetInnerHTML`. Chart label rendering via Recharts and lightweight-charts is not inspected in detail — verify any custom tooltip formatter that might inject user-controlled strings.

---

*End of report.*
