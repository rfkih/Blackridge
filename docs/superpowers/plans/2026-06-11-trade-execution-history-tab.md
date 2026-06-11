# Trade Execution History tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Execution History" tab to `/trades` that leads with a failure-cause breakdown (true totals) and drills into individual failed executions with a raw-error detail drawer.

**Architecture:** Reuse the existing `trade_execution_log` table + `GET /api/v1/trade-executions`. Backend adds a single Java `FailureCategoryClassifier` (the one source of truth for the 6 cause buckets), extends the list endpoint with filters, and adds a `/summary` aggregation. Because `failureCategory` is derived in Java from freeform `error_message` (not a column), the summary and the FAILED-list drill-down process the **sparse** failed set in Java, while the "all executions" path uses true DB pagination. Frontend adds an API module, hooks, four presentational components, and wraps the page body in Radix tabs.

**Tech Stack:** Backend — Java 21, Spring Boot 3.4.x, Hibernate/JPA, JUnit5 + AssertJ + Mockito, Testcontainers ITs. Frontend — Next.js 14 App Router, TanStack Query v5, TanStack Table v8, Vitest + React Testing Library, Tailwind + `--mm-*` tokens.

**Repos / branches:**
- Backend: `C:/Project/blackheart-trading-engine` — create branch `feat/trade-execution-history` off `master`.
- Frontend: `C:/Project/blackridge-frontend` — branch `feat/trade-execution-history` (already created, spec committed there).

**Operator rules that gate this work:**
- Every prod change goes to dev too; verify on dev first; deploy via GitHub Actions (push to master).
- Backend change is read-only (no migration, no write-path/trading-logic change). Preserve the bare endpoint's current default behavior (no `status` param ⇒ all non-DIVERTED, as today).

---

## File structure

### Phase A — Backend (`blackheart-trading-engine`)
- Create `src/main/java/id/co/blackheart/service/trade/FailureCategory.java` — enum of 6 buckets.
- Create `src/main/java/id/co/blackheart/service/trade/FailureCategoryClassifier.java` — `static classify(status, errorMessage)`.
- Create `src/main/java/id/co/blackheart/dto/response/ExecutionFailureSummaryResponse.java` — summary DTO + nested `CategoryCount`.
- Modify `src/main/java/id/co/blackheart/dto/response/TradeExecutionEventResponse.java` — add `failureCategory` field.
- Modify `src/main/java/id/co/blackheart/repository/TradeExecutionLogRepository.java` — add `findInWindow` + `countInWindow`.
- Modify `src/main/java/id/co/blackheart/service/trade/TradeExecutionQueryService.java` — add filtered list + summary methods; set `failureCategory` in `toResponse`.
- Modify `src/main/java/id/co/blackheart/controller/TradeExecutionController.java` — add filter params to `list`, add `summary` endpoint.
- Tests: `FailureCategoryClassifierTest.java`, `TradeExecutionQueryServiceTest.java`, `TradeExecutionControllerIT.java`.

### Phase B — Frontend (`blackridge-frontend`)
- Create `src/lib/api/tradeExecutions.ts` — types + `getExecutions` + `getExecutionSummary`.
- Create `src/hooks/useTradeExecutions.ts` — `useExecutionsList` + `useExecutionSummary`.
- Create `tests/unit/test-utils.tsx` — `renderWithClient` (QueryClientProvider wrapper).
- Create `src/components/trades/execution/FailureBreakdownPanel.tsx`
- Create `src/components/trades/execution/ExecutionTable.tsx`
- Create `src/components/trades/execution/ExecutionDetailDrawer.tsx`
- Create `src/components/trades/execution/ExecutionFilterBar.tsx`
- Create `src/components/trades/execution/ExecutionHistoryTab.tsx`
- Modify `src/app/(dashboard)/trades/page.tsx` — wrap body in tabs (trading + hedging variants), URL `?tab` state.

---

# PHASE A — BACKEND

> Phase A is independently shippable: it produces a tested, deployable endpoint. Do all of Phase A, verify on dev, deploy, THEN start Phase B (the frontend needs the live endpoint).

### Task A0: Branch

- [ ] **Step 1: Create the backend branch**

```bash
cd /c/Project/blackheart-trading-engine
git checkout master && git pull origin master
git checkout -b feat/trade-execution-history
```

---

### Task A1: FailureCategory enum + classifier (pure unit, TDD)

**Files:**
- Create: `src/main/java/id/co/blackheart/service/trade/FailureCategory.java`
- Create: `src/main/java/id/co/blackheart/service/trade/FailureCategoryClassifier.java`
- Test: `src/test/java/id/co/blackheart/service/trade/FailureCategoryClassifierTest.java`

- [ ] **Step 1: Create the enum**

```java
// FailureCategory.java
package id.co.blackheart.service.trade;

/** The 6 user-facing failure-cause buckets for the execution-history breakdown. */
public enum FailureCategory {
    MIN_NOTIONAL,
    INSUFFICIENT_BALANCE,
    QUANTITY_PRECISION,
    NO_FILL_TIMEOUT,
    EXCHANGE_API_ERROR,
    OTHER
}
```

- [ ] **Step 2: Write the failing test**

```java
// FailureCategoryClassifierTest.java
package id.co.blackheart.service.trade;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class FailureCategoryClassifierTest {

    @Test
    void nonFailedStatusHasNoCategory() {
        assertThat(FailureCategoryClassifier.classify("SUCCESS", "anything")).isNull();
        assertThat(FailureCategoryClassifier.classify("DIVERTED", "paper")).isNull();
    }

    @Test
    void minNotionalFromValidationAndFloor() {
        assertThat(FailureCategoryClassifier.classify("FAILED",
                "Pre-trade validation: Estimated notional below minimum notional. min=7.00, estimated=4.10"))
                .isEqualTo(FailureCategory.MIN_NOTIONAL);
        assertThat(FailureCategoryClassifier.classify("FAILED",
                "Min-notional floor: account cannot afford minimum notional"))
                .isEqualTo(FailureCategory.MIN_NOTIONAL);
    }

    @Test
    void insufficientBalance() {
        assertThat(FailureCategoryClassifier.classify("FAILED", "Insufficient balance for requested action"))
                .isEqualTo(FailureCategory.INSUFFICIENT_BALANCE);
    }

    @Test
    void quantityPrecision() {
        assertThat(FailureCategoryClassifier.classify("FAILED",
                "Pre-trade validation: Estimated quantity is zero after step normalization"))
                .isEqualTo(FailureCategory.QUANTITY_PRECISION);
        assertThat(FailureCategoryClassifier.classify("FAILED", "LOT_SIZE precision error"))
                .isEqualTo(FailureCategory.QUANTITY_PRECISION);
    }

    @Test
    void noFillTimeout() {
        assertThat(FailureCategoryClassifier.classify("FAILED", "LIMIT_MAKER no fill: CANCELED_ON_TIMEOUT"))
                .isEqualTo(FailureCategory.NO_FILL_TIMEOUT);
    }

    @Test
    void rawExchangeErrorIsExchangeApi() {
        assertThat(FailureCategoryClassifier.classify("FAILED", "APIError(code=-2010): account has insufficient permissions"))
                .isEqualTo(FailureCategory.EXCHANGE_API_ERROR);
    }

    @Test
    void unmatchedPreTradeValidationIsOther() {
        assertThat(FailureCategoryClassifier.classify("FAILED", "Pre-trade validation: StrategyDecision is null"))
                .isEqualTo(FailureCategory.OTHER);
    }

    @Test
    void blankOrNullErrorIsOther() {
        assertThat(FailureCategoryClassifier.classify("FAILED", null)).isEqualTo(FailureCategory.OTHER);
        assertThat(FailureCategoryClassifier.classify("FAILED", "  ")).isEqualTo(FailureCategory.OTHER);
    }
}
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `./gradlew test --tests "id.co.blackheart.service.trade.FailureCategoryClassifierTest"`
Expected: FAIL — `FailureCategoryClassifier` does not exist (compile error).

- [ ] **Step 4: Implement the classifier**

```java
// FailureCategoryClassifier.java
package id.co.blackheart.service.trade;

import java.util.Locale;

/**
 * Single source of truth mapping a FAILED execution's freeform error_message to one of the
 * 6 {@link FailureCategory} buckets. Used by both the per-row mapping and the summary aggregation
 * so they can never disagree. Match is ordered (first hit wins), case-insensitive.
 */
public final class FailureCategoryClassifier {

    private FailureCategoryClassifier() {}

    public static FailureCategory classify(String status, String errorMessage) {
        if (!"FAILED".equalsIgnoreCase(status)) {
            return null; // SUCCESS / DIVERTED rows have no failure category
        }
        if (errorMessage == null || errorMessage.isBlank()) {
            return FailureCategory.OTHER;
        }
        String m = errorMessage.toLowerCase(Locale.ROOT);

        if (m.contains("below minimum notional") || m.contains("min-notional floor")) {
            return FailureCategory.MIN_NOTIONAL;
        }
        if (m.contains("insufficient balance") || m.contains("cannot afford")) {
            return FailureCategory.INSUFFICIENT_BALANCE;
        }
        if (m.contains("quantity is zero after step")
                || m.contains("invalid for step size")
                || m.contains("below minimum position quantity")
                || m.contains("lot_size")
                || m.contains("precision")) {
            return FailureCategory.QUANTITY_PRECISION;
        }
        if (m.contains("limit_maker no fill")
                || m.contains("canceled_on_timeout")
                || m.contains("rejected_no_fallback")) {
            return FailureCategory.NO_FILL_TIMEOUT;
        }
        // Remaining "Pre-trade validation: ..." messages are internal validation, not exchange errors.
        if (errorMessage.startsWith("Pre-trade validation:")) {
            return FailureCategory.OTHER;
        }
        return FailureCategory.EXCHANGE_API_ERROR;
    }
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `./gradlew test --tests "id.co.blackheart.service.trade.FailureCategoryClassifierTest"`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/main/java/id/co/blackheart/service/trade/FailureCategory.java \
        src/main/java/id/co/blackheart/service/trade/FailureCategoryClassifier.java \
        src/test/java/id/co/blackheart/service/trade/FailureCategoryClassifierTest.java
git commit -m "feat(trade): FailureCategoryClassifier — 6-bucket failure-cause classifier"
```

---

### Task A2: Add `failureCategory` to the row DTO

**Files:**
- Modify: `src/main/java/id/co/blackheart/dto/response/TradeExecutionEventResponse.java`

- [ ] **Step 1: Add the field**

Add this field to the `@Getter @Builder` class (after `executedAt`):

```java
    /** Derived failure bucket (null for SUCCESS rows). One of FailureCategory.name(). */
    private String failureCategory;
```

- [ ] **Step 2: Compile**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add src/main/java/id/co/blackheart/dto/response/TradeExecutionEventResponse.java
git commit -m "feat(trade): expose failureCategory on TradeExecutionEventResponse"
```

---

### Task A3: Summary DTO

**Files:**
- Create: `src/main/java/id/co/blackheart/dto/response/ExecutionFailureSummaryResponse.java`

- [ ] **Step 1: Create the DTO**

```java
package id.co.blackheart.dto.response;

import lombok.Builder;
import lombok.Getter;
import java.util.List;

/** Aggregated failure breakdown for the execution-history tab. */
@Getter
@Builder
public class ExecutionFailureSummaryResponse {
    private long totalExecutions;   // non-DIVERTED executions in window
    private long failedCount;
    private long successCount;
    private double successRatePct;  // successCount / totalExecutions * 100 (0 when no executions)
    private String topCategory;     // highest-count FailureCategory name, or null when no failures
    private List<CategoryCount> byCategory;

    @Getter
    @Builder
    public static class CategoryCount {
        private String category;    // FailureCategory.name()
        private long count;
        private double pct;         // count / failedCount * 100
    }
}
```

- [ ] **Step 2: Compile + commit**

```bash
./gradlew compileJava
git add src/main/java/id/co/blackheart/dto/response/ExecutionFailureSummaryResponse.java
git commit -m "feat(trade): ExecutionFailureSummaryResponse DTO"
```

---

### Task A4: Repository queries

**Files:**
- Modify: `src/main/java/id/co/blackheart/repository/TradeExecutionLogRepository.java`

- [ ] **Step 1: Add the two JPQL queries**

Add these imports if missing: `org.springframework.data.jpa.repository.Query`, `org.springframework.data.repository.query.Param`, `java.time.LocalDateTime`. Add inside the interface:

```java
    /**
     * Window query for the execution feed. Always excludes DIVERTED. {@code statusEq} narrows to a
     * single status when non-null (e.g. 'FAILED' / 'SUCCESS'); null means "any non-DIVERTED".
     * Optional symbol/strategy/type filters are no-ops when null. Newest first.
     */
    @Query("""
            SELECT t FROM TradeExecutionLog t
            WHERE t.accountId IN :accountIds
              AND t.status <> 'DIVERTED'
              AND (:statusEq IS NULL OR t.status = :statusEq)
              AND t.executedAt >= :from AND t.executedAt < :to
              AND (:symbol IS NULL OR t.asset = :symbol)
              AND (:strategyName IS NULL OR t.strategyName = :strategyName)
              AND (:executionType IS NULL OR t.executionType = :executionType)
            ORDER BY t.executedAt DESC
            """)
    org.springframework.data.domain.Page<TradeExecutionLog> findInWindow(
            @Param("accountIds") java.util.Collection<java.util.UUID> accountIds,
            @Param("statusEq") String statusEq,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            @Param("symbol") String symbol,
            @Param("strategyName") String strategyName,
            @Param("executionType") String executionType,
            org.springframework.data.domain.Pageable pageable);

    /** Count of non-DIVERTED executions in the same window/filters (for success-rate). */
    @Query("""
            SELECT COUNT(t) FROM TradeExecutionLog t
            WHERE t.accountId IN :accountIds
              AND t.status <> 'DIVERTED'
              AND t.executedAt >= :from AND t.executedAt < :to
              AND (:symbol IS NULL OR t.asset = :symbol)
              AND (:strategyName IS NULL OR t.strategyName = :strategyName)
              AND (:executionType IS NULL OR t.executionType = :executionType)
            """)
    long countInWindow(
            @Param("accountIds") java.util.Collection<java.util.UUID> accountIds,
            @Param("from") LocalDateTime from,
            @Param("to") LocalDateTime to,
            @Param("symbol") String symbol,
            @Param("strategyName") String strategyName,
            @Param("executionType") String executionType);
```

- [ ] **Step 2: Compile + commit**

```bash
./gradlew compileJava
git add src/main/java/id/co/blackheart/repository/TradeExecutionLogRepository.java
git commit -m "feat(trade): repository window + count queries for execution history"
```

---

### Task A5: Service — filtered list + summary (TDD with Mockito)

**Files:**
- Modify: `src/main/java/id/co/blackheart/service/trade/TradeExecutionQueryService.java`
- Test: `src/test/java/id/co/blackheart/service/trade/TradeExecutionQueryServiceTest.java`

- [ ] **Step 1: Define the filter param object** (top of the service file, as a nested static record)

Add inside `TradeExecutionQueryService`:

```java
    /** Query filters for the execution-history endpoints. Null fields = no filter. */
    public record ExecutionFilters(
            String status,          // "FAILED" | "SUCCESS" | "ALL" | null (null/ALL ⇒ any non-DIVERTED)
            String symbol,
            String strategyName,
            String executionType,   // "OPEN" | "CLOSE" | null
            String failureCategory, // FailureCategory.name() | null (only meaningful when status=FAILED)
            String accountId,       // scope to ONE owned account | null ⇒ all the caller's accounts
            LocalDateTime from,
            LocalDateTime to,
            int page,
            int size) {}
```

- [ ] **Step 2: Write the failing service test**

```java
// TradeExecutionQueryServiceTest.java
package id.co.blackheart.service.trade;

import id.co.blackheart.dto.response.ExecutionFailureSummaryResponse;
import id.co.blackheart.dto.response.TradeExecutionEventResponse;
import id.co.blackheart.model.Account;
import id.co.blackheart.model.TradeExecutionLog;
import id.co.blackheart.repository.AccountRepository;
import id.co.blackheart.repository.TradeExecutionLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TradeExecutionQueryServiceTest {

    @Mock private AccountRepository accountRepository;
    @Mock private TradeExecutionLogRepository repo;

    private TradeExecutionQueryService service;

    private final UUID userId = UUID.randomUUID();
    private final UUID acctId = UUID.randomUUID();
    private final LocalDateTime from = LocalDateTime.of(2026, 5, 1, 0, 0);
    private final LocalDateTime to = LocalDateTime.of(2026, 6, 1, 0, 0);

    @BeforeEach
    void setUp() {
        service = new TradeExecutionQueryService(accountRepository, repo);
        Account a = new Account();
        a.setAccountId(acctId);
        when(accountRepository.findByUserId(userId)).thenReturn(List.of(a));
    }

    private TradeExecutionLog failed(String error) {
        TradeExecutionLog t = new TradeExecutionLog();
        t.setTradeExecutionLogId(UUID.randomUUID());
        t.setStatus("FAILED");
        t.setExecutionType("OPEN");
        t.setSide("LONG");
        t.setAsset("BTCUSDT");
        t.setStrategyName("VRP_BTC");
        t.setErrorMessage(error);
        t.setExecutedAt(LocalDateTime.of(2026, 5, 15, 12, 0));
        return t;
    }

    @Test
    void summaryCountsFailuresByCategoryAndSuccessRate() {
        List<TradeExecutionLog> failures = List.of(
                failed("Pre-trade validation: Estimated notional below minimum notional. min=7, estimated=4"),
                failed("Min-notional floor: account cannot afford minimum notional"),
                failed("Insufficient balance for requested action"));
        when(repo.findInWindow(eq(List.of(acctId)), eq("FAILED"), eq(from), eq(to),
                any(), any(), any(), eq(Pageable.unpaged())))
                .thenReturn(new PageImpl<>(failures));
        when(repo.countInWindow(eq(List.of(acctId)), eq(from), eq(to), any(), any(), any()))
                .thenReturn(20L); // 20 executions, 3 failed → 17 success, 85%

        var filters = new TradeExecutionQueryService.ExecutionFilters(
                null, null, null, null, null, null, from, to, 0, 20);
        ExecutionFailureSummaryResponse s = service.summaryForUser(userId, filters);

        assertThat(s.getTotalExecutions()).isEqualTo(20);
        assertThat(s.getFailedCount()).isEqualTo(3);
        assertThat(s.getSuccessCount()).isEqualTo(17);
        assertThat(s.getSuccessRatePct()).isEqualTo(85.0);
        assertThat(s.getTopCategory()).isEqualTo("MIN_NOTIONAL");
        assertThat(s.getByCategory()).anySatisfy(c -> {
            assertThat(c.getCategory()).isEqualTo("MIN_NOTIONAL");
            assertThat(c.getCount()).isEqualTo(2);
        });
    }

    @Test
    void failedListFiltersByCategoryAndPaginatesInJava() {
        List<TradeExecutionLog> failures = List.of(
                failed("below minimum notional"),          // MIN_NOTIONAL
                failed("Insufficient balance"),            // INSUFFICIENT_BALANCE
                failed("below minimum notional again"));   // MIN_NOTIONAL
        when(repo.findInWindow(eq(List.of(acctId)), eq("FAILED"), eq(from), eq(to),
                any(), any(), any(), eq(Pageable.unpaged())))
                .thenReturn(new PageImpl<>(failures));

        var filters = new TradeExecutionQueryService.ExecutionFilters(
                "FAILED", null, null, null, "MIN_NOTIONAL", null, from, to, 0, 20);
        Page<TradeExecutionEventResponse> page = service.listForUser(userId, filters);

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).allSatisfy(r ->
                assertThat(r.getFailureCategory()).isEqualTo("MIN_NOTIONAL"));
    }

    @Test
    void emptyAccountsYieldEmpty() {
        when(accountRepository.findByUserId(userId)).thenReturn(List.of());
        var filters = new TradeExecutionQueryService.ExecutionFilters(
                "FAILED", null, null, null, null, null, from, to, 0, 20);
        assertThat(service.listForUser(userId, filters).getTotalElements()).isZero();
        assertThat(service.summaryForUser(userId, filters).getTotalExecutions()).isZero();
    }
}
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `./gradlew test --tests "id.co.blackheart.service.trade.TradeExecutionQueryServiceTest"`
Expected: FAIL — `summaryForUser` / `listForUser(filters)` not defined.

- [ ] **Step 4: Implement the new service methods**

Add these imports to the service: `id.co.blackheart.dto.response.ExecutionFailureSummaryResponse`, `java.time.LocalDateTime`, `java.util.ArrayList`, `java.util.Comparator`, `java.util.LinkedHashMap`, `java.util.Map`, `org.springframework.data.domain.PageImpl`. Then add:

```java
    private static final String STATUS_FAILED = "FAILED";
    private static final String STATUS_ALL = "ALL";

    @Transactional(readOnly = true)
    public Page<TradeExecutionEventResponse> listForUser(UUID userId, ExecutionFilters f) {
        List<UUID> accountIds = scopedAccountIds(userId, f.accountId());
        Pageable pageable = PageRequest.of(f.page(), f.size());
        if (accountIds.isEmpty()) {
            return Page.empty(pageable);
        }
        boolean failedView = STATUS_FAILED.equalsIgnoreCase(f.status());
        if (failedView) {
            // Sparse failed set: load all in window, classify, optional category filter, paginate in Java.
            List<TradeExecutionEventResponse> all =
                    repo.findInWindow(accountIds, STATUS_FAILED, f.from(), f.to(),
                                    f.symbol(), f.strategyName(), f.executionType(), Pageable.unpaged())
                            .map(TradeExecutionQueryService::toResponse)
                            .getContent();
            if (f.failureCategory() != null && !f.failureCategory().isBlank()) {
                all = all.stream()
                        .filter(r -> f.failureCategory().equals(r.getFailureCategory()))
                        .toList();
            }
            int total = all.size();
            int fromIdx = Math.min(f.page() * f.size(), total);
            int toIdx = Math.min(fromIdx + f.size(), total);
            return new PageImpl<>(all.subList(fromIdx, toIdx), pageable, total);
        }
        // ALL or SUCCESS: true DB pagination (no category filter applies).
        String statusEq = (f.status() == null || STATUS_ALL.equalsIgnoreCase(f.status())) ? null : f.status();
        return repo.findInWindow(accountIds, statusEq, f.from(), f.to(),
                        f.symbol(), f.strategyName(), f.executionType(), pageable)
                .map(TradeExecutionQueryService::toResponse);
    }

    @Transactional(readOnly = true)
    public ExecutionFailureSummaryResponse summaryForUser(UUID userId, ExecutionFilters f) {
        List<UUID> accountIds = scopedAccountIds(userId, f.accountId());
        if (accountIds.isEmpty()) {
            return ExecutionFailureSummaryResponse.builder()
                    .totalExecutions(0).failedCount(0).successCount(0)
                    .successRatePct(0).topCategory(null).byCategory(List.of()).build();
        }
        List<TradeExecutionLog> failures = repo.findInWindow(accountIds, STATUS_FAILED, f.from(), f.to(),
                f.symbol(), f.strategyName(), f.executionType(), Pageable.unpaged()).getContent();
        long total = repo.countInWindow(accountIds, f.from(), f.to(),
                f.symbol(), f.strategyName(), f.executionType());
        long failed = failures.size();
        long success = Math.max(0, total - failed);

        Map<String, Long> counts = new LinkedHashMap<>();
        for (TradeExecutionLog row : failures) {
            FailureCategory cat = FailureCategoryClassifier.classify(row.getStatus(), row.getErrorMessage());
            String key = (cat == null ? FailureCategory.OTHER : cat).name();
            counts.merge(key, 1L, Long::sum);
        }
        List<ExecutionFailureSummaryResponse.CategoryCount> byCategory = new ArrayList<>();
        counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .forEach(e -> byCategory.add(ExecutionFailureSummaryResponse.CategoryCount.builder()
                        .category(e.getKey())
                        .count(e.getValue())
                        .pct(failed == 0 ? 0 : round1(e.getValue() * 100.0 / failed))
                        .build()));

        return ExecutionFailureSummaryResponse.builder()
                .totalExecutions(total)
                .failedCount(failed)
                .successCount(success)
                .successRatePct(total == 0 ? 0 : round1(success * 100.0 / total))
                .topCategory(byCategory.isEmpty() ? null : byCategory.get(0).getCategory())
                .byCategory(byCategory)
                .build();
    }

    private List<UUID> resolveAccountIds(UUID userId) {
        return accountRepository.findByUserId(userId).stream().map(Account::getAccountId).toList();
    }

    /**
     * The caller's account IDs, optionally narrowed to a single requested account.
     * Ownership is enforced: an account the caller does not own yields an empty scope (no data leak).
     */
    private List<UUID> scopedAccountIds(UUID userId, String requestedAccountId) {
        List<UUID> owned = resolveAccountIds(userId);
        if (requestedAccountId == null || requestedAccountId.isBlank()) {
            return owned;
        }
        UUID requested = UUID.fromString(requestedAccountId);
        return owned.contains(requested) ? List.of(requested) : List.of();
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
```

Also update the existing `toResponse` to set the category — add this line before `.build()`:

```java
                .failureCategory(failureCategoryName(row))
```

And add the helper:

```java
    private static String failureCategoryName(TradeExecutionLog row) {
        FailureCategory c = FailureCategoryClassifier.classify(row.getStatus(), row.getErrorMessage());
        return c == null ? null : c.name();
    }
```

> Note: the existing `listForUser(UUID, Pageable)` and `listForUser(UUID, int, int)` overloads stay as-is (the bare endpoint still uses them). The new `listForUser(UUID, ExecutionFilters)` is an additional overload.

- [ ] **Step 5: Run the test and confirm it passes**

Run: `./gradlew test --tests "id.co.blackheart.service.trade.TradeExecutionQueryServiceTest"`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/main/java/id/co/blackheart/service/trade/TradeExecutionQueryService.java \
        src/test/java/id/co/blackheart/service/trade/TradeExecutionQueryServiceTest.java
git commit -m "feat(trade): execution-history filtered list + failure summary service"
```

---

### Task A6: Controller — filters + /summary endpoint

**Files:**
- Modify: `src/main/java/id/co/blackheart/controller/TradeExecutionController.java`

- [ ] **Step 1: Add the filter params to `list` and add the `summary` method**

Add imports: `id.co.blackheart.service.trade.TradeExecutionQueryService.ExecutionFilters`, `java.time.LocalDate`, `java.time.LocalDateTime`. Replace the body of `list` and add `summary`:

```java
    @GetMapping
    @Operation(summary = "List the caller's trade execution events (newest first)",
            security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<ResponseDto> list(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) String status,          // FAILED|SUCCESS|ALL (null ⇒ legacy: all non-DIVERTED)
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String strategyName,
            @RequestParam(required = false) String executionType,   // OPEN|CLOSE
            @RequestParam(required = false) String failureCategory,
            @RequestParam(required = false) String accountId,       // scope to one owned account
            @RequestParam(required = false) String from,            // ISO yyyy-MM-dd
            @RequestParam(required = false) String to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        UUID userId = jwtService.extractUserId(AuthHeaderUtil.extractToken(authHeader));
        int safeSize = Math.clamp(size, 1, MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        // Backward-compat: with no filters at all, preserve the original feed (all non-DIVERTED).
        boolean legacy = status == null && symbol == null && strategyName == null
                && executionType == null && failureCategory == null && accountId == null
                && from == null && to == null;
        Page<TradeExecutionEventResponse> events = legacy
                ? tradeExecutionQueryService.listForUser(userId, safePage, safeSize)
                : tradeExecutionQueryService.listForUser(userId, new ExecutionFilters(
                        status, symbol, strategyName, executionType, failureCategory, accountId,
                        parseFrom(from), parseTo(to), safePage, safeSize));

        return ResponseEntity.ok(ResponseDto.builder()
                .responseCode(HttpStatus.OK.value() + ResponseCode.SUCCESS.getCode())
                .data(Map.of(
                        "content", events.getContent(),
                        "page", events.getNumber(),
                        "size", events.getSize(),
                        "totalElements", events.getTotalElements(),
                        "totalPages", events.getTotalPages()))
                .build());
    }

    @GetMapping("/summary")
    @Operation(summary = "Failure-cause breakdown for the caller's executions",
            security = @SecurityRequirement(name = "bearerAuth"))
    public ResponseEntity<ResponseDto> summary(
            @RequestHeader("Authorization") String authHeader,
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) String strategyName,
            @RequestParam(required = false) String executionType,
            @RequestParam(required = false) String accountId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to
    ) {
        UUID userId = jwtService.extractUserId(AuthHeaderUtil.extractToken(authHeader));
        var filters = new ExecutionFilters(null, symbol, strategyName, executionType, null, accountId,
                parseFrom(from), parseTo(to), 0, 1);
        return ResponseEntity.ok(ResponseDto.builder()
                .responseCode(HttpStatus.OK.value() + ResponseCode.SUCCESS.getCode())
                .data(tradeExecutionQueryService.summaryForUser(userId, filters))
                .build());
    }

    /** Default range = last 30 days when unspecified. */
    private static LocalDateTime parseFrom(String iso) {
        return (iso == null || iso.isBlank())
                ? LocalDate.now().minusDays(30).atStartOfDay()
                : LocalDate.parse(iso).atStartOfDay();
    }

    private static LocalDateTime parseTo(String iso) {
        return (iso == null || iso.isBlank())
                ? LocalDate.now().plusDays(1).atStartOfDay()   // inclusive of today
                : LocalDate.parse(iso).plusDays(1).atStartOfDay();
    }
```

- [ ] **Step 2: Compile + commit**

```bash
./gradlew compileJava
git add src/main/java/id/co/blackheart/controller/TradeExecutionController.java
git commit -m "feat(trade): execution endpoint filters + /summary"
```

---

### Task A7: Controller integration test

**Files:**
- Test: `src/test/java/id/co/blackheart/controller/TradeExecutionControllerIT.java`

> Copies the `PendingApprovalControllerIT` pattern: `@SpringBootTest @AutoConfigureMockMvc @Transactional extends IntegrationTestBase`, real minted JWT, MockMvc + jsonPath. Requires Docker (Testcontainers).

- [ ] **Step 1: Write the IT**

```java
package id.co.blackheart.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import id.co.blackheart.model.Account;
import id.co.blackheart.model.TradeExecutionLog;
import id.co.blackheart.model.User;
import id.co.blackheart.repository.AccountRepository;
import id.co.blackheart.repository.TradeExecutionLogRepository;
import id.co.blackheart.repository.UserRepository;
import id.co.blackheart.service.user.JwtService;
import id.co.blackheart.testsupport.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.transaction.TestTransaction;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TradeExecutionControllerIT extends IntegrationTestBase {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private UserRepository userRepository;
    @Autowired private AccountRepository accountRepository;
    @Autowired private TradeExecutionLogRepository execRepo;
    @Autowired private JwtService jwtService;

    private String bearer;
    private UUID accountId;

    @BeforeEach
    void seed() {
        String email = "exec-" + UUID.randomUUID() + "@test.local";
        User u = userRepository.save(buildUser(email, "USER"));
        bearer = "Bearer " + jwtService.generateToken(u);

        Account a = new Account();
        a.setUserId(u.getUserId());
        a.setAccountType("TRADING");
        a.setUsername(email);
        a = accountRepository.save(a);
        accountId = a.getAccountId();

        execRepo.save(exec("FAILED", "BTCUSDT", "VRP_BTC",
                "Pre-trade validation: Estimated notional below minimum notional. min=7, estimated=4"));
        execRepo.save(exec("FAILED", "BTCUSDT", "VRP_BTC", "Insufficient balance for requested action"));
        execRepo.save(exec("SUCCESS", "ETHUSDT", "DCB_ETH", null));
        execRepo.save(exec("DIVERTED", "ETHUSDT", "DCB_ETH", "paper")); // must never appear
        // commit so the non-@Transactional security/JPA read path sees the rows
        TestTransaction.flagForCommit();
        TestTransaction.end();
        TestTransaction.start();
    }

    private TradeExecutionLog exec(String status, String asset, String strat, String err) {
        TradeExecutionLog t = new TradeExecutionLog();
        t.setStatus(status);
        t.setExecutionType("OPEN");
        t.setSide("LONG");
        t.setAccountId(accountId);
        t.setUsername("u");
        t.setAsset(asset);
        t.setStrategyName(strat);
        t.setErrorMessage(err);
        t.setExecutedAt(LocalDateTime.now().minusDays(1));
        return t;
    }

    private User buildUser(String email, String role) {
        User u = new User();
        u.setEmail(email);
        u.setRole(role);
        u.setStatus("ACTIVE");
        u.setFullName("Test " + role);
        u.setPasswordHash("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy");
        u.setEmailVerified(Boolean.TRUE);
        return u;
    }

    @Test
    void failedListExcludesDivertedAndTagsCategory() throws Exception {
        mvc.perform(get("/api/v1/trade-executions?status=FAILED").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.content[0].failureCategory").exists());
    }

    @Test
    void categoryDrilldownFilters() throws Exception {
        mvc.perform(get("/api/v1/trade-executions?status=FAILED&failureCategory=MIN_NOTIONAL")
                        .header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].failureCategory").value("MIN_NOTIONAL"));
    }

    @Test
    void summaryReturnsBreakdownAndSuccessRate() throws Exception {
        mvc.perform(get("/api/v1/trade-executions/summary").header("Authorization", bearer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.failedCount").value(2))
                .andExpect(jsonPath("$.data.successCount").value(1))
                .andExpect(jsonPath("$.data.topCategory").exists())
                .andExpect(jsonPath("$.data.byCategory").isArray());
    }

    @Test
    void rejectsUnauthenticated() throws Exception {
        mvc.perform(get("/api/v1/trade-executions/summary")).andExpect(status().isUnauthorized());
    }
}
```

> If `Account`/`User` setters differ from the above (e.g. required NOT-NULL columns), adjust to match the entity — run the test and follow the constraint violations. The `TestTransaction` commit dance mirrors how other ITs make seeded rows visible to the JWT filter's separate read; if `IntegrationTestBase` already commits per-test, drop the `TestTransaction` lines.

- [ ] **Step 2: Run the IT** (needs Docker running)

Run: `./gradlew test --tests "id.co.blackheart.controller.TradeExecutionControllerIT"`
Expected: PASS (4 tests). Fix entity-field mismatches if they surface.

- [ ] **Step 3: Run the full execution-history test set + commit**

```bash
./gradlew test --tests "id.co.blackheart.*trade*Execution*" --tests "id.co.blackheart.service.trade.FailureCategory*"
git add src/test/java/id/co/blackheart/controller/TradeExecutionControllerIT.java
git commit -m "test(trade): execution-history endpoint integration tests"
```

---

### Task A8: Verify on dev + deploy

- [ ] **Step 1: Full build/test**

Run: `./gradlew build`
Expected: BUILD SUCCESSFUL (whole suite green).

- [ ] **Step 2: Bring up the dev stack and smoke the endpoints**

Per the local-docker memory, start the dev stack, then mint an admin JWT and curl both endpoints against the dev trading JVM (`:8080`):

```bash
# (mint a JWT from the dev JWT_SECRET per project_prod_research_from_local_tunnel recipe)
curl -s "http://localhost:8080/api/v1/trade-executions?status=FAILED&size=5" -H "Authorization: Bearer $JWT" | jq '.data | {totalElements, first: .content[0].failureCategory}'
curl -s "http://localhost:8080/api/v1/trade-executions/summary" -H "Authorization: Bearer $JWT" | jq '.data | {failedCount, successRatePct, topCategory}'
```
Expected: 200 envelopes; `failureCategory` populated on failed rows; summary numbers sane.

- [ ] **Step 3: PR + deploy**

```bash
git push -u origin feat/trade-execution-history
gh pr create --title "feat(trade): execution-history filters + failure summary" \
  --body "Adds FailureCategoryClassifier + filtered list + /summary for the new Execution History tab. Read-only, no migration. See spec 2026-06-11-trade-execution-history-tab-design.md."
```
After merge to master, the GitHub Actions pipeline builds the GHCR image and deploys to the VPS. Confirm the endpoint is live on prod before starting Phase B against it.

---

# PHASE B — FRONTEND

> Prereq: the backend endpoints are live on the environment the frontend points at. Work on the existing `feat/trade-execution-history` branch in `blackridge-frontend`.

### Task B1: API module (TDD)

**Files:**
- Create: `src/lib/api/tradeExecutions.ts`
- Test: `tests/unit/lib/tradeExecutions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/tradeExecutions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', () => ({ apiClient: { get: vi.fn() } }));
import { apiClient } from '@/lib/api/client';
import { getExecutions, getExecutionSummary } from '@/lib/api/tradeExecutions';

const mockGet = apiClient.get as unknown as ReturnType<typeof vi.fn>;

describe('tradeExecutions api', () => {
  beforeEach(() => mockGet.mockReset());

  it('maps the paginated execution envelope (totalElements → total)', async () => {
    mockGet.mockResolvedValue({
      data: {
        content: [{ id: '1', status: 'FAILED', failureCategory: 'MIN_NOTIONAL', asset: 'BTCUSDT' }],
        page: 0, size: 20, totalElements: 1, totalPages: 1,
      },
    });
    const res = await getExecutions({ status: 'FAILED', from: '2026-05-01', to: '2026-06-01', page: 0, size: 20 });
    expect(mockGet).toHaveBeenCalledWith('/api/v1/trade-executions', expect.objectContaining({
      params: expect.objectContaining({ status: 'FAILED', from: '2026-05-01', to: '2026-06-01' }),
    }));
    expect(res.total).toBe(1);
    expect(res.content[0].failureCategory).toBe('MIN_NOTIONAL');
  });

  it('reads the summary payload', async () => {
    mockGet.mockResolvedValue({
      data: { totalExecutions: 20, failedCount: 3, successCount: 17, successRatePct: 85,
              topCategory: 'MIN_NOTIONAL', byCategory: [{ category: 'MIN_NOTIONAL', count: 2, pct: 66.7 }] },
    });
    const s = await getExecutionSummary({ from: '2026-05-01', to: '2026-06-01' });
    expect(s.failedCount).toBe(3);
    expect(s.byCategory[0].category).toBe('MIN_NOTIONAL');
  });

  it('omits failureCategory param when not set', async () => {
    mockGet.mockResolvedValue({ data: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 } });
    await getExecutions({ status: 'ALL' });
    const params = mockGet.mock.calls[0][1].params;
    expect(params).not.toHaveProperty('failureCategory');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/lib/tradeExecutions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

```ts
// src/lib/api/tradeExecutions.ts
import { apiClient } from './client';

export type FailureCategory =
  | 'MIN_NOTIONAL' | 'INSUFFICIENT_BALANCE' | 'QUANTITY_PRECISION'
  | 'NO_FILL_TIMEOUT' | 'EXCHANGE_API_ERROR' | 'OTHER';

export type ExecutionStatusFilter = 'FAILED' | 'SUCCESS' | 'ALL';

export interface ExecutionEvent {
  id: string;
  executionType: 'OPEN' | 'CLOSE';
  side: 'LONG' | 'SHORT' | null;
  status: 'SUCCESS' | 'FAILED';
  accountId: string | null;
  username: string | null;
  asset: string | null;
  strategyName: string | null;
  executionReason: string | null;
  errorMessage: string | null;
  tradeId: string | null;
  executedAt: string;            // ISO LocalDateTime, e.g. "2026-06-11T12:34:07"
  failureCategory: FailureCategory | null;
}

export interface ExecutionsPage {
  content: ExecutionEvent[];
  page: number;
  size: number;
  total: number;
}

export interface ExecutionCategoryCount {
  category: FailureCategory;
  count: number;
  pct: number;
}

export interface ExecutionSummary {
  totalExecutions: number;
  failedCount: number;
  successCount: number;
  successRatePct: number;
  topCategory: FailureCategory | null;
  byCategory: ExecutionCategoryCount[];
}

export interface ExecutionFilters {
  status?: ExecutionStatusFilter;
  symbol?: string;
  strategyName?: string;
  executionType?: 'OPEN' | 'CLOSE' | 'ALL';
  failureCategory?: FailureCategory | null;
  from?: string;     // yyyy-MM-dd
  to?: string;
  accountId?: string;
  page?: number;
  size?: number;
}

function buildParams(f: ExecutionFilters): Record<string, string | number> {
  const p: Record<string, string | number> = {};
  if (f.status && f.status !== 'ALL') p.status = f.status;
  if (f.symbol) p.symbol = f.symbol.toUpperCase();
  if (f.strategyName) p.strategyName = f.strategyName;
  if (f.executionType && f.executionType !== 'ALL') p.executionType = f.executionType;
  if (f.failureCategory) p.failureCategory = f.failureCategory;
  if (f.from) p.from = f.from;
  if (f.to) p.to = f.to;
  if (f.accountId) p.accountId = f.accountId;
  if (f.page != null) p.page = f.page;
  if (f.size != null) p.size = f.size;
  return p;
}

interface BackendExecutionsPage {
  content: ExecutionEvent[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export async function getExecutions(f: ExecutionFilters = {}): Promise<ExecutionsPage> {
  // apiClient's response interceptor already unwraps the { responseCode, data } envelope.
  const { data } = await apiClient.get<BackendExecutionsPage>('/api/v1/trade-executions', {
    params: buildParams(f),
  });
  return {
    content: data?.content ?? [],
    page: data?.page ?? f.page ?? 0,
    size: data?.size ?? f.size ?? 20,
    total: data?.totalElements ?? 0,
  };
}

export async function getExecutionSummary(
  f: Omit<ExecutionFilters, 'status' | 'failureCategory' | 'page' | 'size'> = {},
): Promise<ExecutionSummary> {
  const { data } = await apiClient.get<ExecutionSummary>('/api/v1/trade-executions/summary', {
    params: buildParams(f),
  });
  return {
    totalExecutions: data?.totalExecutions ?? 0,
    failedCount: data?.failedCount ?? 0,
    successCount: data?.successCount ?? 0,
    successRatePct: data?.successRatePct ?? 0,
    topCategory: data?.topCategory ?? null,
    byCategory: data?.byCategory ?? [],
  };
}
```

- [ ] **Step 4: Run the test + commit**

Run: `npx vitest run tests/unit/lib/tradeExecutions.test.ts`
Expected: PASS (3 tests).

```bash
git add src/lib/api/tradeExecutions.ts tests/unit/lib/tradeExecutions.test.ts
git commit -m "feat(trades): tradeExecutions API module + tests"
```

---

### Task B2: Hooks

**Files:**
- Create: `src/hooks/useTradeExecutions.ts`

- [ ] **Step 1: Implement the hooks** (mirrors `useTrades.ts`)

```ts
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  getExecutions, getExecutionSummary,
  type ExecutionFilters,
} from '@/lib/api/tradeExecutions';
import { QUERY_STALE_TIMES } from '@/lib/constants';

export function useExecutionsList(filters: ExecutionFilters) {
  return useQuery({
    queryKey: [
      'executions', 'list',
      filters.status ?? 'FAILED', filters.symbol ?? null, filters.strategyName ?? null,
      filters.executionType ?? null, filters.failureCategory ?? null,
      filters.from ?? null, filters.to ?? null, filters.accountId ?? null,
      filters.page ?? 0, filters.size ?? 20,
    ],
    queryFn: () => getExecutions(filters),
    staleTime: QUERY_STALE_TIMES.closedTrades,
    placeholderData: (prev) => prev,
  });
}

export function useExecutionSummary(
  filters: Omit<ExecutionFilters, 'status' | 'failureCategory' | 'page' | 'size'>,
) {
  return useQuery({
    queryKey: [
      'executions', 'summary',
      filters.symbol ?? null, filters.strategyName ?? null, filters.executionType ?? null,
      filters.from ?? null, filters.to ?? null, filters.accountId ?? null,
    ],
    queryFn: () => getExecutionSummary(filters),
    staleTime: QUERY_STALE_TIMES.closedTrades,
    placeholderData: (prev) => prev,
  });
}
```

> If `QUERY_STALE_TIMES.closedTrades` does not exist, check `src/lib/constants.ts` for the right key (e.g. `trades`) and use it.

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/hooks/useTradeExecutions.ts
git commit -m "feat(trades): useExecutionsList + useExecutionSummary hooks"
```

---

### Task B3: Test util — QueryClientProvider wrapper

**Files:**
- Create: `tests/unit/test-utils.tsx`

- [ ] **Step 1: Create the wrapper** (greenfield — no existing precedent)

```tsx
// tests/unit/test-utils.tsx
import { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(ui, { wrapper });
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/unit/test-utils.tsx
git commit -m "test: renderWithClient helper for QueryClientProvider-wrapped components"
```

---

### Task B4: FailureBreakdownPanel (TDD)

**Files:**
- Create: `src/components/trades/execution/FailureBreakdownPanel.tsx`
- Test: `tests/unit/components/FailureBreakdownPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/components/FailureBreakdownPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FailureBreakdownPanel } from '@/components/trades/execution/FailureBreakdownPanel';
import type { ExecutionSummary } from '@/lib/api/tradeExecutions';

const summary: ExecutionSummary = {
  totalExecutions: 20, failedCount: 3, successCount: 17, successRatePct: 85,
  topCategory: 'MIN_NOTIONAL',
  byCategory: [
    { category: 'MIN_NOTIONAL', count: 2, pct: 66.7 },
    { category: 'INSUFFICIENT_BALANCE', count: 1, pct: 33.3 },
  ],
};

describe('FailureBreakdownPanel', () => {
  it('renders summary stats and cause bars', () => {
    render(<FailureBreakdownPanel summary={summary} isLoading={false} activeCategory={null} onSelectCategory={() => {}} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('Min-notional')).toBeInTheDocument();
    expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
  });

  it('fires onSelectCategory when a bar is clicked', () => {
    const onSelect = vi.fn();
    render(<FailureBreakdownPanel summary={summary} isLoading={false} activeCategory={null} onSelectCategory={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Min-notional/ }));
    expect(onSelect).toHaveBeenCalledWith('MIN_NOTIONAL');
  });

  it('toggles category off when the active bar is clicked again', () => {
    const onSelect = vi.fn();
    render(<FailureBreakdownPanel summary={summary} isLoading={false} activeCategory="MIN_NOTIONAL" onSelectCategory={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Min-notional/ }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/unit/components/FailureBreakdownPanel.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/trades/execution/FailureBreakdownPanel.tsx
'use client';

import type { ExecutionSummary, FailureCategory } from '@/lib/api/tradeExecutions';

export const CATEGORY_LABEL: Record<FailureCategory, string> = {
  MIN_NOTIONAL: 'Min-notional',
  INSUFFICIENT_BALANCE: 'Insufficient balance',
  QUANTITY_PRECISION: 'Quantity/precision',
  NO_FILL_TIMEOUT: 'No-fill / timeout',
  EXCHANGE_API_ERROR: 'Exchange/API',
  OTHER: 'Other',
};

const CATEGORY_COLOR: Record<FailureCategory, string> = {
  MIN_NOTIONAL: '#ef4444',
  INSUFFICIENT_BALANCE: '#f59e0b',
  NO_FILL_TIMEOUT: '#eab308',
  QUANTITY_PRECISION: '#84cc16',
  EXCHANGE_API_ERROR: '#22c55e',
  OTHER: '#6b7280',
};

interface Props {
  summary: ExecutionSummary | undefined;
  isLoading: boolean;
  activeCategory: FailureCategory | null;
  onSelectCategory: (c: FailureCategory | null) => void;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="mm-card" style={{ flex: 1, padding: '9px 12px' }}>
      <div className="mm-kicker" style={{ fontSize: 10 }}>{label}</div>
      <div className="font-num" style={{ fontSize: 18, color: tone ?? 'var(--mm-ink-1)' }}>{value}</div>
    </div>
  );
}

export function FailureBreakdownPanel({ summary, isLoading, activeCategory, onSelectCategory }: Props) {
  if (isLoading && !summary) {
    return <div className="mm-card" style={{ padding: 16, color: 'var(--mm-ink-3)' }}>Loading breakdown…</div>;
  }
  if (!summary) return null;
  const maxCount = summary.byCategory.reduce((m, c) => Math.max(m, c.count), 0) || 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Stat label="Executions" value={String(summary.totalExecutions)} />
        <Stat label="Failed" value={String(summary.failedCount)} tone="var(--mm-dn)" />
        <Stat label="Success rate" value={`${Math.round(summary.successRatePct)}%`} tone="var(--mm-up)" />
        <Stat label="Top cause" value={summary.topCategory ? CATEGORY_LABEL[summary.topCategory] : '—'} />
      </div>

      <div className="mm-card" style={{ padding: 12 }}>
        <div className="mm-kicker" style={{ marginBottom: 9 }}>Why trades failed · click to filter</div>
        {summary.byCategory.length === 0 ? (
          <div style={{ color: 'var(--mm-ink-3)', fontSize: 13 }}>No failures in this range 🎉</div>
        ) : (
          <div className="flex flex-col gap-2">
            {summary.byCategory.map((c) => {
              const active = activeCategory === c.category;
              return (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => onSelectCategory(active ? null : c.category)}
                  aria-pressed={active}
                  className="flex items-center gap-2 text-left"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <span style={{ width: 132, color: 'var(--mm-ink-1)', fontSize: 12 }}>
                    {CATEGORY_LABEL[c.category]}
                  </span>
                  <span style={{ flex: 1, height: 13, background: 'var(--mm-hair)', borderRadius: 3, position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${(c.count / maxCount) * 100}%`,
                      background: CATEGORY_COLOR[c.category], borderRadius: 3,
                      outline: active ? '1.5px solid var(--mm-ink-2)' : 'none', outlineOffset: 1,
                    }} />
                  </span>
                  <span className="font-num" style={{ width: 70, textAlign: 'right', color: 'var(--mm-ink-2)', fontSize: 12 }}>
                    {c.count} · {Math.round(c.pct)}%
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test + commit**

Run: `npx vitest run tests/unit/components/FailureBreakdownPanel.test.tsx`
Expected: PASS (3 tests).

```bash
git add src/components/trades/execution/FailureBreakdownPanel.tsx tests/unit/components/FailureBreakdownPanel.test.tsx
git commit -m "feat(trades): FailureBreakdownPanel with clickable cause bars"
```

---

### Task B5: ExecutionDetailDrawer (TDD)

**Files:**
- Create: `src/components/trades/execution/ExecutionDetailDrawer.tsx`
- Test: `tests/unit/components/ExecutionDetailDrawer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutionDetailDrawer } from '@/components/trades/execution/ExecutionDetailDrawer';
import type { ExecutionEvent } from '@/lib/api/tradeExecutions';

const base: ExecutionEvent = {
  id: '1', executionType: 'OPEN', side: 'LONG', status: 'FAILED',
  accountId: 'a', username: 'u', asset: 'BTCUSDT', strategyName: 'VRP_BTC',
  executionReason: 'ZSCORE entry', errorMessage: 'Pre-trade validation: below minimum notional',
  tradeId: null, executedAt: '2026-06-11T12:34:07', failureCategory: 'MIN_NOTIONAL',
};

describe('ExecutionDetailDrawer', () => {
  it('shows the raw error and the no-trade note when tradeId is null', () => {
    render(<ExecutionDetailDrawer event={base} onClose={() => {}} />);
    expect(screen.getByText(/below minimum notional/)).toBeInTheDocument();
    expect(screen.getByText(/rejected before a trade was created/i)).toBeInTheDocument();
  });

  it('renders a trade link when tradeId is present', () => {
    render(<ExecutionDetailDrawer event={{ ...base, tradeId: 't-9' }} onClose={() => {}} />);
    expect(screen.getByRole('link', { name: /view trade/i })).toHaveAttribute('href', '/trades/t-9');
  });

  it('calls onClose', () => {
    const onClose = vi.fn();
    render(<ExecutionDetailDrawer event={base} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when event is null', () => {
    const { container } = render(<ExecutionDetailDrawer event={null} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run + confirm fail**

Run: `npx vitest run tests/unit/components/ExecutionDetailDrawer.test.tsx`
Expected: FAIL — not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/trades/execution/ExecutionDetailDrawer.tsx
'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import type { ExecutionEvent } from '@/lib/api/tradeExecutions';
import { CATEGORY_LABEL } from './FailureBreakdownPanel';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span style={{ color: 'var(--mm-ink-3)' }}>{label}</span>
      <span style={{ color: 'var(--mm-ink-1)' }}>{children}</span>
    </>
  );
}

export function ExecutionDetailDrawer({ event, onClose }: { event: ExecutionEvent | null; onClose: () => void }) {
  if (!event) return null;
  const when = (() => {
    const d = new Date(event.executedAt);
    return Number.isNaN(d.getTime()) ? event.executedAt : format(d, 'yyyy-MM-dd HH:mm:ss');
  })();

  return (
    <div role="dialog" aria-label="Execution detail"
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(460px, 92vw)', zIndex: 50,
        background: 'var(--mm-card)', borderLeft: '1px solid var(--mm-hair)', padding: 18, overflowY: 'auto' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div className="mm-kicker">Execution detail</div>
        <button type="button" onClick={onClose} aria-label="Close"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--mm-ink-2)' }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px', fontSize: 12.5 }}>
        <Row label="When">{when}</Row>
        <Row label="Status">
          <span style={{ color: event.status === 'FAILED' ? 'var(--mm-dn)' : 'var(--mm-up)' }}>{event.status}</span>
        </Row>
        {event.failureCategory && <Row label="Cause">{CATEGORY_LABEL[event.failureCategory]}</Row>}
        <Row label="Symbol · Strat">{event.asset} · {event.strategyName} · {event.executionType} {event.side}</Row>
        {event.executionReason && <Row label="Signal reason">{event.executionReason}</Row>}
        {event.errorMessage && <Row label="Raw error">{event.errorMessage}</Row>}
        <Row label="Trade">
          {event.tradeId
            ? <Link href={`/trades/${event.tradeId}`} style={{ color: 'var(--color-info)' }}>View trade →</Link>
            : <span style={{ color: 'var(--mm-ink-3)' }}>— rejected before a trade was created</span>}
        </Row>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run + commit**

Run: `npx vitest run tests/unit/components/ExecutionDetailDrawer.test.tsx`
Expected: PASS (4 tests).

```bash
git add src/components/trades/execution/ExecutionDetailDrawer.tsx tests/unit/components/ExecutionDetailDrawer.test.tsx
git commit -m "feat(trades): ExecutionDetailDrawer slide-over"
```

---

### Task B6: ExecutionTable

**Files:**
- Create: `src/components/trades/execution/ExecutionTable.tsx`
- Test: `tests/unit/components/ExecutionTable.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExecutionTable } from '@/components/trades/execution/ExecutionTable';
import type { ExecutionEvent } from '@/lib/api/tradeExecutions';

const rows: ExecutionEvent[] = [{
  id: '1', executionType: 'OPEN', side: 'LONG', status: 'FAILED', accountId: 'a', username: 'u',
  asset: 'BTCUSDT', strategyName: 'VRP_BTC', executionReason: null,
  errorMessage: 'Pre-trade validation: below minimum notional. min=7, estimated=4',
  tradeId: null, executedAt: '2026-06-11T12:34:07', failureCategory: 'MIN_NOTIONAL',
}];

describe('ExecutionTable', () => {
  it('renders a row with its cause badge and calls onRowClick', () => {
    const onRowClick = vi.fn();
    render(<ExecutionTable rows={rows} isLoading={false} onRowClick={onRowClick} />);
    expect(screen.getByText('Min-notional')).toBeInTheDocument();
    fireEvent.click(screen.getByText('BTCUSDT'));
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
```

- [ ] **Step 2: Run + confirm fail**, then **Step 3: implement**:

```tsx
// src/components/trades/execution/ExecutionTable.tsx
'use client';

import { useMemo } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { DataTable } from '@/components/shared/DataTable';
import { StrategyBadge } from '@/components/trading/StrategyBadge';
import type { ExecutionEvent } from '@/lib/api/tradeExecutions';
import { CATEGORY_LABEL } from './FailureBreakdownPanel';

function CauseBadge({ event }: { event: ExecutionEvent }) {
  if (event.status !== 'FAILED' || !event.failureCategory) {
    return <span style={{ color: 'var(--mm-up)', fontSize: 11 }}>● OK</span>;
  }
  return (
    <span style={{ color: 'var(--mm-dn)', fontSize: 11, fontWeight: 500 }}>
      ● {CATEGORY_LABEL[event.failureCategory]}
    </span>
  );
}

export function ExecutionTable({
  rows, isLoading, onRowClick,
}: { rows: ExecutionEvent[]; isLoading: boolean; onRowClick: (e: ExecutionEvent) => void }) {
  const columns = useMemo<ColumnDef<ExecutionEvent, unknown>[]>(() => [
    {
      accessorKey: 'executedAt', header: 'Time',
      cell: ({ row }) => {
        const d = new Date(row.original.executedAt);
        return <span className="font-mono text-[11px] text-text-muted">
          {Number.isNaN(d.getTime()) ? row.original.executedAt : format(d, 'MM-dd HH:mm')}</span>;
      },
    },
    { accessorKey: 'executionType', header: 'Type',
      cell: ({ row }) => <span className="font-mono text-[11px] text-text-secondary">{row.original.executionType}</span> },
    { accessorKey: 'asset', header: 'Symbol',
      cell: ({ row }) => <span className="font-mono text-[13px] font-medium text-text-primary">{row.original.asset}</span> },
    { accessorKey: 'strategyName', header: 'Strategy',
      cell: ({ row }) => row.original.strategyName ? <StrategyBadge code={row.original.strategyName} size="sm" /> : <span>—</span> },
    { accessorKey: 'side', header: 'Side',
      cell: ({ row }) => <span style={{ color: row.original.side === 'SHORT' ? 'var(--mm-dn)' : 'var(--mm-up)', fontSize: 11 }}>{row.original.side ?? '—'}</span> },
    { id: 'cause', header: 'Cause', cell: ({ row }) => <CauseBadge event={row.original} /> },
    { id: 'detail', header: 'Detail',
      cell: ({ row }) => <span className="text-[11px] text-text-secondary" style={{
        display: 'block', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {row.original.errorMessage ?? row.original.executionReason ?? '—'}</span> },
  ], []);

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      onRowClick={onRowClick}
      getRowId={(r) => r.id}
      manualSorting
      hideSearch
      emptyTitle="No executions"
      emptyDescription="No executions match these filters in this range."
      hidePagination
    />
  );
}
```

- [ ] **Step 4: Run + commit**

Run: `npx vitest run tests/unit/components/ExecutionTable.test.tsx`
Expected: PASS.

```bash
git add src/components/trades/execution/ExecutionTable.tsx tests/unit/components/ExecutionTable.test.tsx
git commit -m "feat(trades): ExecutionTable with cause badges"
```

---

### Task B7: ExecutionFilterBar

**Files:**
- Create: `src/components/trades/execution/ExecutionFilterBar.tsx`

- [ ] **Step 1: Implement** (reuses the trades-page filter idioms: `mm-pill`, `DatePicker`, `<select className="mm-btn">`)

```tsx
// src/components/trades/execution/ExecutionFilterBar.tsx
'use client';

import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import type { ExecutionStatusFilter } from '@/lib/api/tradeExecutions';

export interface ExecutionFilterState {
  status: ExecutionStatusFilter;
  symbol: string;
  strategyName: string;
  executionType: 'OPEN' | 'CLOSE' | 'ALL';
  from: string;
  to: string;
}

const STATUS: { key: ExecutionStatusFilter; label: string }[] = [
  { key: 'FAILED', label: 'Failed' }, { key: 'ALL', label: 'All' }, { key: 'SUCCESS', label: 'Success' },
];
const TYPES: { key: 'ALL' | 'OPEN' | 'CLOSE'; label: string }[] = [
  { key: 'ALL', label: 'Open+Close' }, { key: 'OPEN', label: 'Open' }, { key: 'CLOSE', label: 'Close' },
];

export function ExecutionFilterBar({
  filters, strategyCodes, onPatch,
}: {
  filters: ExecutionFilterState;
  strategyCodes: string[];
  onPatch: (patch: Partial<ExecutionFilterState>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {STATUS.map((s) => (
        <button key={s.key} type="button" onClick={() => onPatch({ status: s.key })}
          className={cn('mm-pill', filters.status === s.key && 'mm-pill-active')}
          style={{ padding: '5px 12px', fontSize: 11 }} aria-pressed={filters.status === s.key}>
          {s.label}
        </button>
      ))}
      <input type="text" value={filters.symbol}
        onChange={(e) => onPatch({ symbol: e.target.value.toUpperCase() })}
        placeholder="symbol" aria-label="Filter by symbol"
        className="mm-btn" style={{ padding: '5px 10px', fontSize: 12, width: 110,
          background: 'var(--mm-surface-2)', color: 'var(--mm-ink-1)' }} />
      <select aria-label="Filter by strategy" value={filters.strategyName}
        onChange={(e) => onPatch({ strategyName: e.target.value })} className="mm-btn" style={{ fontSize: 12 }}>
        <option value="">any strategy</option>
        {strategyCodes.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select aria-label="Filter by execution type" value={filters.executionType}
        onChange={(e) => onPatch({ executionType: e.target.value as ExecutionFilterState['executionType'] })}
        className="mm-btn" style={{ fontSize: 12 }}>
        {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>
      <DatePicker id="exec-from" value={filters.from} onChange={(v) => onPatch({ from: v })}
        placeholder="From" clearable className="h-7 px-2 py-0 text-[12px]" />
      <DatePicker id="exec-to" value={filters.to} onChange={(v) => onPatch({ to: v })}
        placeholder="To" clearable className="h-7 px-2 py-0 text-[12px]" />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add src/components/trades/execution/ExecutionFilterBar.tsx
git commit -m "feat(trades): ExecutionFilterBar"
```

---

### Task B8: ExecutionHistoryTab orchestrator (TDD)

**Files:**
- Create: `src/components/trades/execution/ExecutionHistoryTab.tsx`
- Test: `tests/unit/components/ExecutionHistoryTab.test.tsx`

- [ ] **Step 1: Write the failing test** (mocks the hooks)

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithClient } from '../test-utils';

const summary = {
  totalExecutions: 20, failedCount: 3, successCount: 17, successRatePct: 85, topCategory: 'MIN_NOTIONAL',
  byCategory: [{ category: 'MIN_NOTIONAL', count: 2, pct: 66.7 }, { category: 'INSUFFICIENT_BALANCE', count: 1, pct: 33.3 }],
};
const listData = {
  content: [{
    id: '1', executionType: 'OPEN', side: 'LONG', status: 'FAILED', accountId: 'a', username: 'u',
    asset: 'BTCUSDT', strategyName: 'VRP_BTC', executionReason: null,
    errorMessage: 'below minimum notional', tradeId: null,
    executedAt: '2026-06-11T12:34:07', failureCategory: 'MIN_NOTIONAL',
  }],
  page: 0, size: 20, total: 1,
};

const useExecutionSummary = vi.fn();
const useExecutionsList = vi.fn();
vi.mock('@/hooks/useTradeExecutions', () => ({
  useExecutionSummary: (...a: unknown[]) => useExecutionSummary(...a),
  useExecutionsList: (...a: unknown[]) => useExecutionsList(...a),
}));
vi.mock('@/hooks/useStrategies', () => ({ useStrategies: () => ({ data: [] }) }));

import { ExecutionHistoryTab } from '@/components/trades/execution/ExecutionHistoryTab';

describe('ExecutionHistoryTab', () => {
  beforeEach(() => {
    useExecutionSummary.mockReturnValue({ data: summary, isLoading: false });
    useExecutionsList.mockReturnValue({ data: listData, isLoading: false });
  });

  it('renders breakdown + table', () => {
    renderWithClient(<ExecutionHistoryTab accountId="a" />);
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('BTCUSDT')).toBeInTheDocument();
  });

  it('clicking a cause bar passes failureCategory to the list hook', () => {
    renderWithClient(<ExecutionHistoryTab accountId="a" />);
    fireEvent.click(screen.getByRole('button', { name: /Min-notional/ }));
    const lastCall = useExecutionsList.mock.calls.at(-1)![0];
    expect(lastCall.failureCategory).toBe('MIN_NOTIONAL');
  });

  it('opens the drawer on row click', () => {
    renderWithClient(<ExecutionHistoryTab accountId="a" />);
    fireEvent.click(screen.getByText('BTCUSDT'));
    expect(screen.getByRole('dialog', { name: /execution detail/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run + confirm fail**, then **Step 3: implement**:

```tsx
// src/components/trades/execution/ExecutionHistoryTab.tsx
'use client';

import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { useExecutionSummary, useExecutionsList } from '@/hooks/useTradeExecutions';
import { useStrategies } from '@/hooks/useStrategies';
import type { ExecutionEvent, FailureCategory } from '@/lib/api/tradeExecutions';
import { FailureBreakdownPanel } from './FailureBreakdownPanel';
import { ExecutionFilterBar, type ExecutionFilterState } from './ExecutionFilterBar';
import { ExecutionTable } from './ExecutionTable';
import { ExecutionDetailDrawer } from './ExecutionDetailDrawer';

const PAGE_SIZE = 50;

export function ExecutionHistoryTab({ accountId }: { accountId: string | undefined }) {
  const [filters, setFilters] = useState<ExecutionFilterState>(() => ({
    status: 'FAILED', symbol: '', strategyName: '', executionType: 'ALL',
    from: format(subDays(new Date(), 30), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd'),
  }));
  const [activeCategory, setActiveCategory] = useState<FailureCategory | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ExecutionEvent | null>(null);

  const patch = (p: Partial<ExecutionFilterState>) => { setPage(0); setActiveCategory(null); setFilters((f) => ({ ...f, ...p })); };

  const strategiesQuery = useStrategies();
  const strategyCodes = useMemo<string[]>(
    () => Array.from(new Set((strategiesQuery.data ?? []).map((s: { code: string }) => s.code))).sort(),
    [strategiesQuery.data],
  );

  const common = {
    symbol: filters.symbol || undefined,
    strategyName: filters.strategyName || undefined,
    executionType: filters.executionType,
    from: filters.from, to: filters.to, accountId,
  };

  const summaryQuery = useExecutionSummary(common);
  const listQuery = useExecutionsList({
    ...common,
    status: filters.status,
    failureCategory: filters.status === 'FAILED' ? activeCategory : null,
    page, size: PAGE_SIZE,
  });

  const rows = listQuery.data?.content ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <ExecutionFilterBar filters={filters} strategyCodes={strategyCodes} onPatch={patch} />

      <FailureBreakdownPanel
        summary={summaryQuery.data}
        isLoading={summaryQuery.isLoading}
        activeCategory={activeCategory}
        onSelectCategory={(c) => { setPage(0); setActiveCategory(c); }}
      />

      {activeCategory && (
        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--mm-ink-2)' }}>
          <span>Filtered to <b>{activeCategory}</b></span>
          <button type="button" onClick={() => setActiveCategory(null)} className="mm-pill" style={{ padding: '2px 8px' }}>clear ✕</button>
        </div>
      )}

      <ExecutionTable rows={rows} isLoading={listQuery.isLoading} onRowClick={setSelected} />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-[12px]" style={{ color: 'var(--mm-ink-2)' }}>
          <button type="button" className="mm-pill" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={{ padding: '3px 10px' }}>‹ Prev</button>
          <span>page {page + 1} of {totalPages}</span>
          <button type="button" className="mm-pill" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ padding: '3px 10px' }}>Next ›</button>
        </div>
      )}

      <ExecutionDetailDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
```

> If `useStrategies()` returns a different shape than `{ data: { code }[] }`, adjust the `strategyCodes` mapping to match (check `src/hooks/useStrategies.ts`). The trades page derives `uniqueStrategyCodes` from its data — copy that exact derivation if simpler.

- [ ] **Step 4: Run + commit**

Run: `npx vitest run tests/unit/components/ExecutionHistoryTab.test.tsx`
Expected: PASS (3 tests).

```bash
git add src/components/trades/execution/ExecutionHistoryTab.tsx tests/unit/components/ExecutionHistoryTab.test.tsx
git commit -m "feat(trades): ExecutionHistoryTab orchestrator"
```

---

### Task B9: Wire the tab into the page

**Files:**
- Modify: `src/app/(dashboard)/trades/page.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, add:

```tsx
import { Suspense as ReactSuspense } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExecutionHistoryTab } from '@/components/trades/execution/ExecutionHistoryTab';
```
(If `Suspense` is already imported, reuse it instead of `ReactSuspense`.)

- [ ] **Step 2: Replace the `TradesPage` component body to host tabs**

Replace the existing `export default function TradesPage()` with:

```tsx
export default function TradesPage() {
  const { activeAccount, isAll, scopedAccountId } = useActiveAccount();
  const isHedging = !isAll && activeAccount?.accountType === 'HEDGING';

  return (
    <Suspense fallback={<Skeleton className="h-[60vh] w-full" />}>
      <Tabs defaultValue="journal" className="flex flex-col gap-4">
        <TabsList className="bg-[var(--bg-elevated)]">
          <TabsTrigger value="journal">{isHedging ? 'Rebalances' : 'Journal'}</TabsTrigger>
          <TabsTrigger value="executions">Execution History</TabsTrigger>
        </TabsList>

        <TabsContent value="journal">
          {isHedging ? <RebalancesMonitor accountId={scopedAccountId} /> : <TradesPageContent />}
        </TabsContent>

        <TabsContent value="executions">
          <ExecutionHistoryTab accountId={scopedAccountId} />
        </TabsContent>
      </Tabs>
    </Suspense>
  );
}
```

> `TradesPageContent` and `RebalancesMonitor` already exist in the file and are unchanged. The Journal tab renders byte-identical content to today; only its wrapper changed. `Suspense` wrapping is required because `TradesPageContent` reads `useSearchParams`.

- [ ] **Step 3: Typecheck + run the full unit suite + lint**

Run: `npm run typecheck && npx vitest run && npm run lint`
Expected: typecheck clean, all Vitest tests pass (incl. the new ones + the smoke test), lint clean.

- [ ] **Step 4: Manual check (the app)** — start the dev server, open `/trades`:
  - Journal tab renders the existing ledger unchanged.
  - Execution History tab shows the breakdown + failed rows; clicking a cause bar filters the table; clicking a row opens the drawer; a single HEDGING account shows `Rebalances | Execution History`.

- [ ] **Step 5: Commit + push**

```bash
git add "src/app/(dashboard)/trades/page.tsx"
git commit -m "feat(trades): Execution History tab on the trades page"
git push -u origin feat/trade-execution-history
```

- [ ] **Step 6: PR**

```bash
gh pr create --title "feat(trades): Trade Execution History tab" \
  --body "Adds the Execution History tab: failure-cause breakdown + drill-down table + detail drawer. Consumes the new /trade-executions filters + /summary. Spec + plan in docs/superpowers/."
```

---

## Self-review notes (already reconciled)

- **Spec coverage:** breakdown (B4/B8), full-log toggle via status pill (B7/B8), 6 buckets (A1), true backend totals (A4/A5/A6), drawer not modal (B5), DIVERTED excluded (A4 query + A7 test), hedging tab set (B9), backend-located classifier (A1 used by A5 row map + summary). All present.
- **Type consistency:** `FailureCategory` names identical across A1 enum, frontend union (B1), `CATEGORY_LABEL` (B4), and test fixtures. `ExecutionFilters`/`ExecutionFilterState` are distinct by design (API filter vs UI state) — the orchestrator (B8) maps UI→API explicitly.
- **Known follow-ups (out of scope):** URL-syncing the execution-tab filters (kept in local state for v1; only deferred if desired later); persisting the active tab in the URL `?tab` (left as Radix `defaultValue` — add `useSearchParams` sync later if wanted); a materialized `failure_category` column if read-time classification ever gets hot.
