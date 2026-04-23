# Security Fixes — Migration Notes

Companion to `SECURITY_REVIEW.md`. Every P0–P3 finding now has code in place.
This doc lists what operators need to do to deploy safely.

## Required environment variables (new / changed)

| Env var | Required for | Notes |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | Every environment | Must be set. `dev`, `test`, `local` are the only profiles that accept the dev-default JWT secret. Any other value (including empty) requires a real `JWT_SECRET`. |
| `JWT_SECRET` | Staging / prod / any non-dev | Base64-encoded 256-bit key — `openssl rand -base64 64`. |
| `DB_ENCRYPTION_KEY` | **Every environment** (dev included) | Base64-encoded 32 bytes — `openssl rand -base64 32`. Dev uses a public sentinel; staging/prod MUST override or boot fails. |
| `COOKIE_SECURE` | Staging / prod | Set to `true` to require HTTPS on the auth cookie. Leave `false` only for local HTTP dev. |
| `COOKIE_SAMESITE` | Staging / prod | `Lax` (default) unless you need cross-site fetches. `Strict` is tighter. |
| `WS_ALLOWED_ORIGINS` | Staging / prod | Already exists — set to the exact prod frontend origin, not the localhost default. |

## Database migration

`backtest_run` needs a `user_id UUID` column. Hibernate `ddl-auto=update` will
add it on boot in dev; for prod, run:

```sql
ALTER TABLE backtest_run ADD COLUMN user_id UUID;
CREATE INDEX IF NOT EXISTS idx_backtest_run_user_id ON backtest_run (user_id);
```

Existing rows will have `user_id = NULL` and are invisible to every user —
that is intentional. If historical runs need to remain queryable by their
original creator, backfill with an admin script that joins via
`account_strategy → account.user_id`.

`accounts.api_key` / `api_secret` columns are widened to 1024 chars to hold
the base64-encoded AES-256-GCM envelope:

```sql
ALTER TABLE accounts ALTER COLUMN api_key TYPE VARCHAR(1024);
ALTER TABLE accounts ALTER COLUMN api_secret TYPE VARCHAR(1024);
```

Existing plaintext rows keep working — `EncryptedStringConverter` detects the
missing `enc:v1:` prefix and returns them as-is. They get encrypted on the
next update. To force-encrypt all rows immediately, run a one-shot script
that loads every `Account`, calls `save()`, and commits — the converter
handles the rest.

## Password policy

New registrations must now use 12+ characters with at least one of each:
lowercase, uppercase, digit, symbol. Legacy accounts are unaffected until
the user rotates their password.

## Frontend build

`next.config.mjs` now emits security headers (CSP, HSTS, etc.). The CSP
`connect-src` includes `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` — make
sure those env vars are set at build time, not runtime.

The JWT no longer lives in `localStorage`. Users will be logged out once on
first deploy (their old localStorage token is abandoned). After login, auth
is carried by the `blackheart-token` HttpOnly cookie automatically.

## WebSocket flow change

The frontend now fetches `GET /api/v1/users/ws-ticket` (authenticated via the
HttpOnly cookie) and passes the short-lived (60 s) JWT in the STOMP CONNECT
`Authorization` header. Any custom STOMP client must do the same.

## New endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/users/logout` | Clears the auth cookie (public) |
| `GET`  | `/api/v1/users/ws-ticket` | Issues short-lived JWT for WS (auth required) |

## Findings → fixes map

| Finding | Status | Files touched |
|---|---|---|
| 2.1 Plaintext Binance keys | Encrypted AES-256-GCM at rest | `EncryptedStringConverter`, `EncryptionKeyInitializer`, `Account.java`, `application.properties` |
| 2.2 LSR/VCB param IDOR | Ownership check in both controllers | `AccountStrategyOwnershipGuard`, `LsrStrategyParamController`, `VcbStrategyParamController` |
| 2.3 Backtest IDOR | `user_id` column + filtered reads | `BacktestRun.java`, `BacktestRunRepository`, `BacktestService`, `BacktestQueryService`, `BacktestV1Controller` |
| 2.4 STOMP SUBSCRIBE hijack | Per-frame topic-ownership check | `WebSocketAuthInterceptor` |
| 2.5 Trade/PnL IDOR + client-supplied creds | JsonIgnore on keys, admin-only trade controller, ownership checks on query endpoints | `BinanceOrderRequest`, `BinanceOrderDetailRequest`, `TradeController`, `TradeQueryController`, `TradePnlQueryController`, `MonteCarloService`/`Controller`, `SchedulerController`, `HistoricalBackfillController`, `PortofolioController` |
| 2.6 JWT in localStorage | HttpOnly cookie + WS ticket flow | `JwtCookieService`, `UserController`, `JwtAuthenticationFilter`, frontend `authStore`, `client.ts`, `useAuth.ts`, `useWebSocket.ts` |
| 2.8 Unbounded backtest request | `@Valid` + bounds | `BacktestRunRequest`, `BacktestV1Controller`, `BacktestService` |
| 2.9 No rate limit / weak passwords | Bucket4j filter + regex policy | `AuthRateLimitFilter`, `RegisterUserRequest` |
| 2.10 No CSP / headers | Full header block | `next.config.mjs` |
| 2.11 Outdated deps | Spring Boot 3.3.5, bcprov-jdk18on 1.78.1, postgres 42.7.4, org.json 20240303 | `build.gradle` |
| 2.12 Dev-secret sentinel gap | Inverted check (require explicit dev profile) | `JwtService` |
| 2.13 Leaky 404 messages | Generic "Not found" | `GlobalExceptionHandler` |
| 2.14 Committed .java~ backup | Deleted + `.gitignore` entry | `.gitignore`, `BinanceClientService.java~` |
| 2.15 CORS tightening | Explicit headers + maxAge | `SecurityConfig` |

## Not fixed (out of scope for this pass)

- **Refresh token rotation / server-side revocation** — access-token TTL is
  now 15 min, which materially shrinks the theft window, but a long-lived
  refresh token with server-side denylist is still the right design for a
  production system. Deferred.
- **WebAuthn / TOTP MFA** — called out in the P2 roadmap; not implemented.
- **Git-history secret scan** — recommend running `trufflehog filesystem` on
  both repos before the next deploy.
- **Node.js trade-proxy (port 8088) audit** — out of scope for this review;
  any plaintext channel between Java and Node is still a weakness.
- **Binance permission probe** — the "I confirm withdraw-disabled" checkbox
  is still client-side attestation. Backend should call Binance
  `GET /api/v3/account` on key add and reject keys with `canWithdraw=true`.
