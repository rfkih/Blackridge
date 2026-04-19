# Blackheart Frontend — Backend API Contract

> This document is the single source of truth between the frontend and the Spring Boot backend.  
> Every endpoint listed here is either **already called** by the frontend or **required** for a feature
> that is built and waiting on the backend implementation.
>
> **Base URL** `http://localhost:8080` (configured via `NEXT_PUBLIC_API_URL`)  
> **WebSocket URL** `ws://localhost:8080/ws` (configured via `NEXT_PUBLIC_WS_URL`)  
> **Auth** Bearer token in `Authorization` header on every protected request.

---

## 0. Response Envelope

Every REST response **must** be wrapped in the following envelope.
The frontend's Axios interceptor unwraps it automatically.

```json
{
  "responseCode": "20000",
  "responseDesc": "Success",
  "data": { /* actual payload */ },
  "errorMessage": null
}
```

| Field | Type | Description |
|---|---|---|
| `responseCode` | `string` | `"20000"` = success. `"4xxxx"` = client error. `"5xxxx"` = server error. |
| `responseDesc` | `string` | Human-readable status |
| `data` | `T \| null` | The payload. `null` for void responses. |
| `errorMessage` | `string \| null` | Non-null only on error responses |

**Error envelope example**
```json
{
  "responseCode": "40100",
  "responseDesc": "Unauthorized",
  "data": null,
  "errorMessage": "Invalid credentials"
}
```

**Pagination** — when a list endpoint is paginated, `data` is:
```json
{
  "content": [],
  "page": 0,
  "size": 20,
  "total": 100
}
```
The frontend handles both plain arrays and paginated responses transparently.

---

## 1. Authentication

### POST `/api/v1/users/login`
Public. No auth header required.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response `data`** *(confirmed from actual backend)*
```json
{
  "accessToken": "eyJhbGci...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "user": {
    "userId": "21ebe410-9dcf-464e-9419-fabed59aef56",
    "email": "user@example.com",
    "fullName": "System Administrator",
    "phoneNumber": null,
    "role": "ADMIN",
    "status": "ACTIVE",
    "emailVerified": false,
    "lastLoginAt": "2026-04-19T17:09:37.997024",
    "createdTime": "2026-04-18T08:53:15.526678",
    "updatedTime": "2026-04-19T17:09:37.819075"
  }
}
```

| Field | Notes |
|---|---|
| `accessToken` | JWT. Used as `Authorization: Bearer <token>` |
| `expiresIn` | Seconds until expiry |
| `user.userId` | Maps to frontend `User.id` |
| `user.fullName` | Maps to frontend `User.name` |

---

### POST `/api/v1/users/register`
Public. No auth header required.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Full Name"
}
```

**Response `data`** — same shape as login (`accessToken` + `user`).

---

### GET `/api/v1/users/me`
Protected.

**Response `data`**
```json
{
  "userId": "21ebe410-...",
  "email": "user@example.com",
  "fullName": "System Administrator",
  "phoneNumber": null,
  "role": "ADMIN",
  "status": "ACTIVE",
  "emailVerified": false,
  "lastLoginAt": "2026-04-19T17:09:37.997024",
  "createdTime": "2026-04-18T08:53:15.526678",
  "updatedTime": "2026-04-19T17:09:37.819075"
}
```
Same `BackendUser` shape as the `user` object inside the login response.

---

## 2. Trades

### GET `/api/v1/trades`
Protected. Returns trades for the authenticated user.

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `status` | `OPEN \| PARTIALLY_CLOSED \| CLOSED` | No | Filter by trade status |
| `accountId` | `UUID` | No | Filter by account |
| `limit` | `number` | No | Max results (used for recent-trades panel) |
| `page` | `number` | No | Zero-based page index |
| `size` | `number` | No | Page size |

**Used by the frontend as:**
- `GET /api/v1/trades?status=OPEN` → open positions on dashboard
- `GET /api/v1/trades?status=CLOSED&limit=10` → recent trades panel
- `GET /api/v1/trades` (all) → trades list page

**Response `data`** — array or paginated list of `Trade` objects:
```json
[
  {
    "id": "uuid",
    "accountId": "uuid",
    "accountStrategyId": "uuid",
    "strategyCode": "LSR_V2",
    "symbol": "BTCUSDT",
    "direction": "LONG",
    "status": "CLOSED",
    "entryTime": 1713456000000,
    "entryPrice": 62450.50,
    "exitTime": 1713542400000,
    "exitAvgPrice": 63100.00,
    "stopLossPrice": 61500.00,
    "tp1Price": 63200.00,
    "tp2Price": 64000.00,
    "quantity": 0.05,
    "realizedPnl": 32.48,
    "unrealizedPnl": 0.0,
    "feeUsdt": 1.24,
    "positions": []
  }
]
```

| Field | Type | Notes |
|---|---|---|
| `id` | `UUID` | Trade ID |
| `entryTime` / `exitTime` | `number` | **Epoch milliseconds** |
| `direction` | `"LONG" \| "SHORT"` | |
| `status` | `"OPEN" \| "PARTIALLY_CLOSED" \| "CLOSED"` | |
| `positions` | `TradePosition[]` | Leg details — see section 2.1 |

**For open positions**, the frontend also needs these live fields:

```json
{
  "tradeId": "uuid",
  "accountId": "uuid",
  "accountStrategyId": "uuid",
  "symbol": "BTCUSDT",
  "direction": "LONG",
  "quantity": 0.05,
  "entryPrice": 62450.50,
  "markPrice": 63100.00,
  "unrealizedPnl": 32.48,
  "unrealizedPnlPct": 1.04,
  "openedAt": 1713456000000
}
```

> **Note:** The dashboard's open-positions panel expects either the full `Trade` shape
> (with `unrealizedPnl` / `markPrice` calculated server-side) **or** a dedicated
> `LivePosition` projection. Whichever shape is returned, `markPrice`, `unrealizedPnl`,
> and `unrealizedPnlPct` must be present.

---

### GET `/api/v1/trades/:id`
Protected.

**Response `data`** — single `Trade` with nested `positions` array.

```json
{
  "id": "uuid",
  "positions": [
    {
      "id": "uuid",
      "tradeId": "uuid",
      "type": "TP1",
      "quantity": 0.025,
      "entryPrice": 62450.50,
      "exitTime": 1713500000000,
      "exitPrice": 63200.00,
      "exitReason": "TP_HIT",
      "feeUsdt": 0.62,
      "realizedPnl": 18.74
    }
  ]
}
```

### 2.1 TradePosition fields

| Field | Type | Values |
|---|---|---|
| `type` | `string` | `SINGLE`, `TP1`, `TP2`, `RUNNER` |
| `exitReason` | `string \| null` | `TP_HIT`, `SL_HIT`, `RUNNER_CLOSE`, `MANUAL_CLOSE`, `BACKTEST_END` |

---

## 3. P&L

### GET `/api/v1/pnl/summary`
Protected.

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `period` | `today \| week \| month` | Yes | Aggregation window |

**Response `data`**
```json
{
  "period": "today",
  "realizedPnl": 145.32,
  "unrealizedPnl": 32.48,
  "totalPnl": 177.80,
  "tradeCount": 8,
  "winRate": 62.5,
  "openCount": 2
}
```

| Field | Type | Notes |
|---|---|---|
| `realizedPnl` | `number` | USDT. Closed trades in the period. |
| `unrealizedPnl` | `number` | USDT. Sum of all currently open positions. |
| `winRate` | `number` | Percentage `0–100`. |
| `openCount` | `number` | Number of currently open trades. |

> Used by the 4 hero stat cards on the dashboard.

---

### GET `/api/v1/pnl/daily`
Protected.

**Query parameters**

| Param | Type | Required |
|---|---|---|
| `from` | `ISO8601 date` | Yes |
| `to` | `ISO8601 date` | Yes |
| `strategyCode` | `string` | No |

**Response `data`** — array of daily P&L points:
```json
[
  { "date": "2026-04-18", "realizedPnl": 85.20, "tradeCount": 4 },
  { "date": "2026-04-19", "realizedPnl": 145.32, "tradeCount": 8 }
]
```

---

### GET `/api/v1/pnl/by-strategy`
Protected.

**Query parameters** — `from`, `to` (ISO8601 dates, optional)

**Response `data`**
```json
[
  {
    "strategyCode": "LSR_V2",
    "realizedPnl": 210.50,
    "tradeCount": 12,
    "winRate": 66.7
  }
]
```

---

## 4. Account Strategies

### GET `/api/v1/account-strategies`
Protected.

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `userId` | `UUID` | No | Filter by user (defaults to authenticated user) |

**Response `data`** — array or paginated list:
```json
[
  {
    "id": "uuid",
    "accountId": "uuid",
    "strategyCode": "LSR_V2",
    "symbol": "BTCUSDT",
    "interval": "1h",
    "status": "LIVE",
    "capitalAllocatedUsdt": 1000.00,
    "allowLong": true,
    "allowShort": false,
    "priorityOrder": 1,
    "createdAt": "2026-04-18T08:53:15.526678",
    "updatedAt": "2026-04-19T17:09:37.819075"
  }
]
```

| Field | Type | Values |
|---|---|---|
| `status` | `string` | `LIVE`, `PAUSED`, `STOPPED` |
| `interval` | `string` | `1m`, `5m`, `15m`, `1h`, `4h`, `1d` |
| `strategyCode` | `string` | `LSR`, `LSR_V2`, `VCB`, `TREND_PULLBACK_SINGLE_EXIT`, `RAHT_V1`, `TSMOM_V1` |

---

### GET `/api/v1/account-strategies/:id`
Protected. Returns a single `AccountStrategy`.

---

## 5. Strategy Parameters — LSR

### GET `/api/v1/lsr-params/:accountStrategyId`
Protected. Returns the live params for a strategy.

**Response `data`**
```json
{
  "adxThreshold": 25,
  "rsiOverbought": 70,
  "rsiOversold": 30,
  "adxPeriod": 14,
  "rsiPeriod": 14,
  "useErFilter": false,
  "erThreshold": 0.6,
  "erPeriod": 10,
  "useRelVolFilter": false,
  "relVolThreshold": 1.5,
  "stopLossAtr": 2.0,
  "atrPeriod": 14,
  "tp1RMultiple": 1.0,
  "tp2RMultiple": 2.0,
  "useRunner": true,
  "runnerActivationR": 2.5,
  "riskPercentage": 1.0,
  "maxPositionSizeUsdt": 500.0,
  "allowLong": true,
  "allowShort": false
}
```

---

### GET `/api/v1/lsr-params/defaults`
Protected. Returns the system defaults for LSR params (used to pre-fill the backtest param tuner).

**Response `data`** — same shape as above with all fields at their default values.

---

### PUT `/api/v1/lsr-params/:accountStrategyId`
Protected. Full replace of params.

**Request body** — full `LsrParams` object (same shape as GET response).

**Response `data`** — updated `LsrParams`.

---

### PATCH `/api/v1/lsr-params/:accountStrategyId`
Protected. Partial update.

**Request body** — partial `LsrParams` (only fields to change).

**Response `data`** — updated `LsrParams`.

---

## 6. Strategy Parameters — VCB

### GET `/api/v1/vcb-params/:accountStrategyId`

**Response `data`**
```json
{
  "compressionLookback": 20,
  "compressionBbWidth": 0.03,
  "compressionKcWidth": 0.025,
  "useKcFilter": true,
  "minBreakoutAtr": 0.5,
  "maxBreakoutAtr": 3.0,
  "volumeMultiplier": 1.5,
  "useVolumeFilter": true,
  "stopLossAtr": 1.5,
  "atrPeriod": 14,
  "tp1RMultiple": 1.0,
  "tp2RMultiple": 2.0,
  "useRunner": false,
  "riskPercentage": 1.0,
  "maxPositionSizeUsdt": 500.0
}
```

---

### GET `/api/v1/vcb-params/defaults`
Same pattern as LSR defaults.

---

### PUT `/api/v1/vcb-params/:accountStrategyId`
Full replace.

### PATCH `/api/v1/vcb-params/:accountStrategyId`
Partial update.

---

## 7. Backtest

### POST `/api/v1/backtest`
Protected. Submits a new backtest run.

**Request body**
```json
{
  "symbol": "BTCUSDT",
  "interval": "1h",
  "fromDate": "2024-01-01",
  "toDate": "2024-06-30",
  "initialCapital": 10000.0,
  "strategyCode": "LSR_V2",
  "strategyAccountStrategyIds": {
    "LSR_V2": "account-strategy-uuid"
  },
  "strategyParamOverrides": {
    "LSR_V2": {
      "adxThreshold": 30,
      "stopLossAtr": 1.5
    }
  }
}
```

| Field | Notes |
|---|---|
| `strategyCode` | Comma-separated for multi-strategy: `"LSR_V2,VCB"` |
| `strategyParamOverrides` | Only fields that differ from defaults. May be empty `{}`. |

**Response `data`** — the created `BacktestRun`:
```json
{
  "id": "uuid",
  "userId": "uuid",
  "status": "PENDING",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "fromDate": "2024-01-01",
  "toDate": "2024-06-30",
  "initialCapital": 10000.0,
  "strategyCode": "LSR_V2",
  "strategyAccountStrategyIds": { "LSR_V2": "uuid" },
  "paramSnapshot": { "LSR_V2": { "adxThreshold": 30 } },
  "metrics": null,
  "errorMessage": null,
  "createdAt": "2026-04-19T17:00:00",
  "completedAt": null
}
```

> **`paramSnapshot`** must be persisted — it powers the "Re-run with these params" button.

---

### GET `/api/v1/backtest`
Protected. Returns list of past runs.

**Query parameters** — `page`, `size` (pagination, optional).

**Response `data`** — array or paginated list of `BacktestRun` (same shape as POST response, `metrics` populated once complete).

---

### GET `/api/v1/backtest/:id`
Protected. Single run with full `metrics`.

**Response `data`**
```json
{
  "id": "uuid",
  "status": "COMPLETE",
  "metrics": {
    "totalReturn": 1250.50,
    "totalReturnPct": 12.51,
    "winRate": 58.3,
    "profitFactor": 1.82,
    "avgWinUsdt": 45.20,
    "avgLossUsdt": 24.80,
    "maxDrawdown": 380.00,
    "maxDrawdownPct": 3.8,
    "sharpe": 1.45,
    "sortino": 2.10,
    "totalTrades": 48,
    "winningTrades": 28,
    "losingTrades": 20
  },
  "paramSnapshot": { "LSR_V2": { "adxThreshold": 30 } }
}
```

---

### GET `/api/v1/backtest/:id/equity-points`
Protected. Time-series equity curve data.

**Response `data`**
```json
[
  {
    "ts": 1704067200000,
    "equity": 10000.00,
    "drawdown": 0.0,
    "drawdownPct": 0.0
  },
  {
    "ts": 1704153600000,
    "equity": 10085.30,
    "drawdown": 0.0,
    "drawdownPct": 0.0
  }
]
```

---

### GET `/api/v1/backtest/:id/trades`
Protected. All trades executed in this backtest run, with nested position legs.

**Response `data`**
```json
[
  {
    "id": "uuid",
    "backtestRunId": "uuid",
    "direction": "LONG",
    "entryTime": 1704067200000,
    "entryPrice": 42500.00,
    "exitTime": 1704153600000,
    "exitPrice": 43200.00,
    "stopLossPrice": 41800.00,
    "tp1Price": 43200.00,
    "tp2Price": 44000.00,
    "quantity": 0.1,
    "realizedPnl": 70.00,
    "rMultiple": 1.0,
    "positions": [
      {
        "id": "uuid",
        "type": "TP1",
        "quantity": 0.05,
        "exitTime": 1704153600000,
        "exitPrice": 43200.00,
        "exitReason": "TP_HIT",
        "realizedPnl": 35.00
      }
    ]
  }
]
```

> Required for the annotated candlestick chart overlay on the backtest result page.

---

### GET `/api/v1/backtest/:id/candles`
Protected. OHLCV data for the backtest's symbol/interval/date range.

**Response `data`**
```json
[
  {
    "symbol": "BTCUSDT",
    "interval": "1h",
    "openTime": 1704067200000,
    "open": 42480.00,
    "high": 42650.00,
    "low": 42310.00,
    "close": 42500.00,
    "volume": 1250.5,
    "closeTime": 1704070799999
  }
]
```

> All timestamps are **epoch milliseconds UTC**.

---

## 8. Market Data

### GET `/api/v1/market`
Protected.

**Query parameters**

| Param | Type | Required |
|---|---|---|
| `symbol` | `string` | Yes |
| `interval` | `1m \| 5m \| 15m \| 1h \| 4h \| 1d` | Yes |
| `from` | `ISO8601` | No |
| `to` | `ISO8601` | No |
| `limit` | `number` | No |

**Response `data`** — `MarketData[]` (same shape as backtest candles above).

---

### GET `/api/v1/market/indicators`
Protected. FeatureStore indicators overlaid on the chart.

**Query parameters** — `symbol`, `interval` (same as `/market`)

**Response `data`**
```json
[
  {
    "symbol": "BTCUSDT",
    "interval": "1h",
    "ts": 1704067200000,
    "emaFast": 42480.00,
    "emaSlow": 42200.00,
    "rsi": 58.3,
    "adx": 28.5,
    "atr": 650.0,
    "bbUpper": 43500.00,
    "bbMiddle": 42500.00,
    "bbLower": 41500.00,
    "kcUpper": 43200.00,
    "kcMiddle": 42500.00,
    "kcLower": 41800.00
  }
]
```

---

## 9. Portfolio

### GET `/api/v1/portfolio`
Protected.

**Response `data`**
```json
{
  "accountId": "uuid",
  "totalUsdt": 12450.80,
  "availableUsdt": 10450.80,
  "lockedUsdt": 2000.00,
  "assets": [
    {
      "asset": "BTC",
      "free": 0.05,
      "locked": 0.0,
      "usdtValue": 3150.00
    },
    {
      "asset": "USDT",
      "free": 10450.80,
      "locked": 2000.00,
      "usdtValue": 12450.80
    }
  ]
}
```

---

## 10. Scheduler

### GET `/api/v1/scheduler`
Protected. Returns current scheduler state.

**Response `data`**
```json
{
  "running": true,
  "activeStrategies": 2,
  "lastTickAt": "2026-04-19T17:09:37.819075"
}
```

---

### POST `/api/v1/scheduler/pause`
Protected. Pauses a specific strategy or all strategies.

**Request body**
```json
{ "accountStrategyId": "uuid" }
```
Omit `accountStrategyId` to pause all.

---

### POST `/api/v1/scheduler/resume`
Protected. Same body shape as pause.

---

## 11. WebSocket — STOMP

**Endpoint** `ws://localhost:8080/ws`  
**Protocol** STOMP over WebSocket  
**Auth** Pass the JWT in the STOMP CONNECT frame:
```
CONNECT
Authorization:Bearer eyJhbGci...
```

### Topic `/topic/pnl/:accountId`

Publishes real-time P&L updates for all open trades belonging to `accountId`.
Published whenever a price tick is processed.

**Message body** (JSON string)
```json
{
  "tradeId": "uuid",
  "accountId": "uuid",
  "markPrice": 63250.00,
  "unrealizedPnl": 40.00,
  "unrealizedPnlPct": 1.28,
  "ts": 1713542400000
}
```

| Field | Type | Notes |
|---|---|---|
| `tradeId` | `UUID` | Links update to a specific open position |
| `markPrice` | `number` | Current mark / last price |
| `unrealizedPnl` | `number` | USDT |
| `unrealizedPnlPct` | `number` | Percentage change from entry |
| `ts` | `number` | Epoch milliseconds |

> The frontend subscribes on dashboard mount and updates the live P&L cells.
> On reconnect, the frontend re-fetches open positions via REST to reconcile missed updates.

---

## 12. Field Name Mapping (Backend ↔ Frontend)

The frontend maps Java-style DTO field names to conventional names at the API boundary.
The backend **must not** change these field names without coordinating with the frontend.

| Backend field | Frontend field | Endpoint |
|---|---|---|
| `userId` | `User.id` | login, register, /me |
| `fullName` | `User.name` | login, register, /me |
| `accessToken` | `LoginResponse.token` | login, register |
| `createdTime` | `User.createdAt` | login, register, /me |

All other endpoints are expected to use field names matching the TypeScript interfaces
defined in `src/types/` exactly. If the backend uses different names, add them to this table.

---

## 13. CORS Configuration Required

The backend must allow requests from the frontend origin.

```java
// Minimum required CORS config for development
@CrossOrigin(origins = "http://localhost:3000")
// OR global config in SecurityConfig:
config.setAllowedOrigins(List.of("http://localhost:3000"));
config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
```

CSRF must be **disabled** for REST API endpoints (the frontend does not send CSRF tokens):
```java
http.csrf(AbstractHttpConfigurer::disable)
```

---

## 14. Endpoint Priority Summary

| Priority | Endpoint | Status | Used By |
|---|---|---|---|
| ✅ Done | `POST /api/v1/users/login` | **Live** | Auth |
| ✅ Done | `POST /api/v1/users/register` | **Live** | Auth |
| ✅ Done | `GET /api/v1/users/me` | **Live** | Auth refresh |
| ✅ Done | `GET /api/v1/account-strategies` | **Live** | Dashboard, Strategies page |
| ✅ Done | `GET /api/v1/trades` | **Live** | Dashboard, Trades page |
| ✅ Done | `GET /api/v1/trades/:id` | **Live** | Trade detail |
| ⚠️ Needed | `GET /api/v1/pnl/summary?period=today` | **Missing** | Dashboard hero stats |
| ⚠️ Needed | `GET /api/v1/pnl/daily` | **Missing** | P&L analytics page |
| ⚠️ Needed | `GET /api/v1/pnl/by-strategy` | **Missing** | P&L analytics page |
| ⚠️ Needed | `GET /api/v1/portfolio` | **Missing** | Portfolio page |
| ⚠️ Needed | `GET /api/v1/lsr-params/:id` | **Missing** | Strategy detail |
| ⚠️ Needed | `GET /api/v1/lsr-params/defaults` | **Missing** | Backtest param tuner |
| ⚠️ Needed | `PUT /api/v1/lsr-params/:id` | **Missing** | Strategy detail |
| ⚠️ Needed | `GET /api/v1/vcb-params/:id` | **Missing** | Strategy detail |
| ⚠️ Needed | `GET /api/v1/vcb-params/defaults` | **Missing** | Backtest param tuner |
| ⚠️ Needed | `PUT /api/v1/vcb-params/:id` | **Missing** | Strategy detail |
| ⚠️ Needed | `POST /api/v1/backtest` | **Missing** | Backtest wizard |
| ⚠️ Needed | `GET /api/v1/backtest` | **Missing** | Backtest list |
| ⚠️ Needed | `GET /api/v1/backtest/:id` | **Missing** | Backtest result |
| ⚠️ Needed | `GET /api/v1/backtest/:id/equity-points` | **Missing** | Equity curve chart |
| ⚠️ Needed | `GET /api/v1/backtest/:id/trades` | **Missing** | Annotated chart overlay |
| ⚠️ Needed | `GET /api/v1/backtest/:id/candles` | **Missing** | Annotated chart overlay |
| ⚠️ Needed | `GET /api/v1/market` | **Missing** | Market page |
| ⚠️ Needed | `POST /api/v1/montecarlo` | **Missing** | Monte Carlo page |
| ⚠️ Needed | WS `/topic/pnl/:accountId` | **Missing** | Live P&L on dashboard |
| 🔵 Nice to have | `GET /api/v1/market/indicators` | **Missing** | Chart overlays |
| 🔵 Nice to have | `GET /api/v1/scheduler` | **Missing** | Scheduler management |
| 🔵 Nice to have | `POST /api/v1/scheduler/pause` | **Missing** | Strategy pause button |
| 🔵 Nice to have | `POST /api/v1/scheduler/resume` | **Missing** | Strategy resume button |
