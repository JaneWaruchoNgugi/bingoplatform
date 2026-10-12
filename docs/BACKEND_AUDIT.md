# Backend Audit Report

**Date:** 2026-10-12  
**Scope:** `apps/api` — Bingo Platform Phase 2 backend  
**Status:** Development-complete; not production-ready (see blockers below)

---

## 1. Implemented Features

### Core Bingo Game Logic
| Feature | Status | Notes |
|---------|--------|-------|
| 75-ball card generation | ✅ Complete | `crypto.randomInt`, column-range enforced, FREE cell at index 12 |
| Card validation | ✅ Complete | Range, uniqueness, FREE-cell checks |
| Win patterns | ✅ Complete | ANY_ROW, ANY_COL, ANY_DIAG, FULL_HOUSE, FOUR_CORNERS |
| Draw (crypto-secure) | ✅ Complete | Unique per round, 1–75, append-only `bingo_draw_events` |
| Win verification | ✅ Complete | Server-side scan; idempotent upsert via unique `(ticketId, prizeRuleId)` |
| Prize settlement | ✅ Mock only | Calls mock wallet adapter; real-money DISABLED |

### Round Lifecycle
| Transition | Route | Status |
|-----------|-------|--------|
| Create (SCHEDULED) | `POST /admin/.../rounds` | ✅ |
| SCHEDULED → OPEN_FOR_SALE | `POST .../open-sales` | ✅ |
| OPEN_FOR_SALE → SALES_CLOSED | `POST .../close-sales` | ✅ |
| SALES_CLOSED → IN_PROGRESS | `POST .../start` | ✅ |
| IN_PROGRESS → COMPLETED | `POST .../complete` | ✅ |
| Any → CANCELLED | `POST .../cancel` | ✅ (requires reason) |

### API Surface
- 41 routes registered, 41 documented in OpenAPI 3.1.0 (`npm run openapi:validate-routes` passes)
- Swagger UI at `/api/docs`; raw spec at `/api/openapi.json`
- All routes validated with Zod; ownership checks on player-scoped resources

### Financial Workflow
| Concern | Status |
|---------|--------|
| Idempotency key on purchases | ✅ Unique constraint + early-return |
| Optimistic locking on `totalTickets` | ✅ `version` field + transaction check |
| Tickets issued only after CONFIRMED debit | ✅ In `$transaction` block after wallet response |
| PENDING purchase reconciliation | ✅ `POST /admin/.../purchases/:id/reconcile` |
| Financial reference records | ✅ `bingo_financial_references` per debit/credit |
| Prize allocation idempotency | ✅ `upsert` on unique `(claimId)` |

### Live Gameplay
| Feature | Status |
|---------|--------|
| Socket.IO connection | ✅ |
| `round:join` / `round:snapshot` | ✅ |
| `draw:number` broadcast | ✅ Called from `draws.service.ts` |
| `round:status` broadcast | ✅ Called from `rounds.service.ts` state machine |
| `round:completed` broadcast | ✅ Called from `wins.service.ts` after settlement |
| State recovery from PostgreSQL on reconnect | ✅ Snapshot re-fetched from DB on join |
| Multi-instance Redis adapter | ⚠️ Not configured (single-instance only) |

### Security
| Control | Status |
|---------|--------|
| Helmet headers | ✅ |
| CORS (configurable origin) | ✅ |
| Rate limiting (300 req / 15 min) | ✅ |
| Player auth middleware | ✅ Bearer JWT (mock: `x-mock-player-id`) |
| Admin auth middleware | ✅ Token check; **returns 401 in production** |
| Production mock-adapter guard | ✅ `assertAdaptersNotMocked()` halts startup |
| Ownership checks | ✅ Purchases, tickets, wins |
| No browser-supplied prices/prizes | ✅ All amounts from DB, not request body |
| Zod validation on all inputs | ✅ |
| Malformed JSON → 400 | ✅ |
| SQL injection | ✅ Prisma ORM; no raw queries |
| Audit trail | ✅ All state changes written to `bingo_audit_events` |

### Database
| Concern | Status |
|---------|--------|
| PostgreSQL authoritative | ✅ |
| Redis as financial truth | ✅ Not used |
| Schema migrations tracked | ✅ `prisma/migrations/` with `migrate resolve --applied` |
| All models in Prisma schema | ✅ 11 Bingo models |
| Indexes on hot query paths | ✅ status, categoryId, scheduledStart, playerId, roundId |

---

## 2. Incomplete / Deferred Features

| Feature | Status | Notes |
|---------|--------|-------|
| Real auth integration | ⛔ Blocked | Waiting for company auth API contract |
| Real wallet integration | ⛔ Blocked | Waiting for company wallet API + credentials |
| Percentage-based prizes | ⚠️ Deferred | `prizePercentage` stored but not used in settlement |
| PENDING → auto-reconcile (webhook/cron) | ⚠️ Deferred | Manual admin endpoint exists; auto-reconcile needs wallet webhook design |
| Admin JWT auth (production) | ⚠️ Deferred | `requireAdmin` blocks all requests in production until real auth is wired |
| Multi-instance Socket.IO | ⚠️ Deferred | Redis adapter config documented in `INTEGRATION_CONTRACTS.md` |
| Ticket void / refund on cancellation | ⚠️ Partial | Tickets voided on FAILED reconcile; round cancellation does not auto-void/refund |
| Jackpot carry-over | ⚠️ Not designed | Not in scope until business rules confirmed |
| Call limit on prize rules | ⚠️ Stored, not enforced | `prizeRule.callLimit` is persisted but `verifyAndClaimWins` does not check it |

---

## 3. Security Risks and Blockers

| Risk | Severity | Mitigation / Blocker |
|------|----------|---------------------|
| Mock adapters in production | **CRITICAL** | Blocked by `assertAdaptersNotMocked()` — process exits if mock adapters remain active |
| Admin auth is dev-only | **CRITICAL** | All admin routes return 401 in production until `setAuthAdapter(realAdapter)` is called |
| Player token not verified against DB | HIGH | Mock accepts any string as player ID. Real adapter must validate against company identity service |
| Wallet debit races on `totalTickets` | LOW | Mitigated by optimistic locking + `$transaction`; extremely low probability of missed increment |
| No rate limit on individual player purchases | MEDIUM | Global 300 req/15 min rate limit; per-player purchase rate limit not implemented |

---

## 4. Test Coverage Summary

| Suite | Tests | Status |
|-------|-------|--------|
| `unit/card.test.ts` | 17 | ✅ Pass |
| `unit/errors.test.ts` | 7 | ✅ Pass |
| `unit/response.test.ts` | 4 | ✅ Pass |
| `unit/users.schema.test.ts` | 13 | ✅ Pass |
| `integration/health.test.ts` | 6 | ✅ Pass |
| `integration/bingo.categories.test.ts` | 6 | ✅ Pass |
| `integration/bingo.rounds.test.ts` | 8 | ✅ Pass |
| `integration/bingo.purchases.test.ts` | 10 | ✅ Pass |
| `integration/bingo.draws.test.ts` | 4 | ✅ Pass |
| `integration/bingo.admin.test.ts` | 9 | ✅ Pass |
| **Total** | **84** | **✅ All pass** |

Not covered by automated tests:
- `verifyAndClaimWins` / `settleAllocations` (wins service)
- Socket.IO event flow (requires live server)
- Purchase reconciliation endpoint
- Round cancellation + ticket voiding flow
- Concurrent purchase stress test

---

## 5. Verification Commands

```bash
cd /home/jane-ngugi/bingo-platform

# Run all tests
npm test -w @bingo/api

# TypeScript strict check
npm run typecheck -w @bingo/api

# Verify all routes are documented
npm run openapi:validate-routes -w @bingo/api

# Start dev server
npm run dev -w @bingo/api

# Open Swagger UI
open http://localhost:3000/api/docs
```
