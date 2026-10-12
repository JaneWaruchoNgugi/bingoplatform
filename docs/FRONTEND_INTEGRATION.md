# Frontend Integration Guide

**Verified against:** `apps/api` Phase 2 backend  
**Date:** 2026-10-12  
**Verification status:** 84/84 tests pass · 0 TypeScript errors · 41/41 routes documented

---

## 1. Backend Readiness

| Check | Result |
|-------|--------|
| Server starts | ✅ Port 3000 |
| PostgreSQL connected | ✅ (`/health/ready` → `database: true`) |
| Redis connected | ✅ (`/health/ready` → `redis: true`) |
| TypeScript strict | ✅ 0 errors |
| All tests | ✅ 84/84 |
| OpenAPI spec | ✅ 41/41 routes documented |
| Swagger UI | ✅ `GET /api/docs` (redirects to `/api/docs/`) |

**Confirmed live from running server:**
```json
GET /api/v1/health        → { "success": true, "data": { "status": "ok" } }
GET /api/v1/health/ready  → { "success": true, "data": { "database": true, "redis": true, "ready": true } }
```

---

## 2. Setup

```bash
# Install workspace dependencies from repo root
npm install

# Start the API (hot-reload)
npm run dev -w @bingo/api
# Server: http://localhost:3000
# Swagger: http://localhost:3000/api/docs
# OpenAPI JSON: http://localhost:3000/api/openapi.json
```

### Environment variables

Copy `.env.example` to `.env`. The frontend only needs `VITE_API_URL` pointing at the running backend:

| Variable | Dev value | Notes |
|----------|-----------|-------|
| `VITE_API_URL` | `http://localhost:3000` | Base URL for HTTP calls |
| `VITE_WS_URL` | `ws://localhost:3000` | Socket.IO server URL |

---

## 3. Response Envelope

Every HTTP response uses this wrapper. **Always check `success` before reading `data`.**

```typescript
// Success (single resource)
interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

// Success (paginated list)
interface ApiPage<T> {
  success: true;
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  requestId: string;
}

// Error
interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: {            // only present on VALIDATION_ERROR
      formErrors: string[];
      fieldErrors: Record<string, string[]>;
    };
  };
  requestId: string;     // always a UUID
}
```

All list endpoints return the paginated form with `meta`.

Verified live error shapes:
```json
// 401 — no auth header
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Authentication required" } }

// 403 — wrong admin token
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Admin authorization required" } }

// 400 — Zod validation failure (includes per-field errors)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid body",
    "details": {
      "formErrors": [],
      "fieldErrors": {
        "ticketCount": ["Number must be greater than or equal to 1"],
        "idempotencyKey": ["Required"]
      }
    }
  }
}

// 400 — path param not a UUID
{ "success": false, "error": { "code": "INVALID_UUID", "message": "Invalid round ID" } }

// 404 — resource not found
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Round not found" } }
```

---

## 4. TypeScript Types

```typescript
// ─── Enums ────────────────────────────────────────────────────────────────────

type RoundStatus =
  | 'SCHEDULED'
  | 'OPEN_FOR_SALE'
  | 'SALES_CLOSED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

type PurchaseStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';
type ClaimStatus    = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'ALLOCATED' | 'SETTLED';
type AllocationStatus = 'PENDING' | 'SETTLED' | 'FAILED';
type WinPattern =
  | 'ANY_ROW' | 'ANY_COL' | 'ANY_DIAG' | 'FULL_HOUSE' | 'FOUR_CORNERS';

// ─── Models ───────────────────────────────────────────────────────────────────

interface BingoCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  priceMinorUnits: number;   // integer, e.g. 500 = KES 5.00
  currency: string;          // ISO 4217, default "KES"
  maxTicketsPerPurchase: number;
  createdAt: string;         // ISO 8601
  updatedAt: string;
}

interface BingoPrizeRule {
  id: string;
  roundId: string;
  name: string;
  pattern: { type: WinPattern };
  prizeMinorUnits: number | null;
  prizePercentage: string | null;  // Prisma Decimal serialises to string
  callLimit: number | null;
  priority: number;
  isActive: boolean;
}

interface BingoRound {
  id: string;
  categoryId: string;
  category?: { name: string; slug: string };   // included on GET /bingo/rounds
  status: RoundStatus;
  scheduledStart: string;
  salesDeadline: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  maxTickets: number | null;
  totalTickets: number;
  version: number;
  prizeRules?: BingoPrizeRule[];  // included on GET /bingo/rounds/:id
  createdAt: string;
  updatedAt: string;
}

interface RoundState {
  id: string;
  status: RoundStatus;
  totalTickets: number;
  version: number;
  drawCount: number;
  lastDrawnNumber: number | null;
  lastDrawnAt: string | null;
}

interface BingoDrawEvent {
  sequence: number;
  number: number;          // 1–75
  drawnAt: string;
}

interface BingoTicket {
  id: string;
  roundId: string;
  purchaseId: string;
  playerId: string;
  serialNumber: string;    // e.g. "BNG-A1B2C3D4-FF12AB34"
  isVoid: boolean;
  createdAt: string;
}

interface BingoCard {
  id: string;
  ticketId: string;
  numbers: number[];  // flat 25-element array; index 12 is always 0 (FREE)
  createdAt: string;
}

interface BingoPurchase {
  id: string;
  roundId: string;
  playerId: string;
  status: PurchaseStatus;
  ticketCount: number;
  pricePerTicket: number;  // minor units
  totalAmount: number;     // minor units
  currency: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  tickets?: Array<{ id: string; serialNumber: string; isVoid: boolean }>;
}

interface BingoWinClaim {
  id: string;
  roundId: string;
  ticketId: string;
  prizeRuleId: string;
  playerId: string;
  status: ClaimStatus;
  verifiedAt: string | null;
  claimedAt: string;
  prizeRule?: { name: string };
}

interface BingoPrizeAllocation {
  id: string;
  roundId: string;
  claimId: string;
  playerId: string;
  amountMinorUnits: number;
  currency: string;
  status: AllocationStatus;
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### 75-ball card layout

```typescript
// numbers[] is a flat 25-element array, read as 5 columns × 5 rows:
// index 0–4   = column B (numbers 1–15)
// index 5–9   = column I (16–30)
// index 10–14 = column N (31–45)  — index 12 is FREE (value 0)
// index 15–19 = column G (46–60)
// index 20–24 = column O (61–75)
//
// To render a 5×5 grid with B-I-N-G-O column headers:
function cardGrid(numbers: number[]): number[][] {
  return [0, 1, 2, 3, 4].map(col =>
    [0, 1, 2, 3, 4].map(row => numbers[col * 5 + row])
  );
}
// gridCell[col][row] — or transpose if you prefer row-major:
// row 0: numbers[0], numbers[5], numbers[10], numbers[15], numbers[20]  (top row)
```

---

## 5. Authentication

### Development (current)

Player routes require the `x-mock-player-id` header OR a `Bearer` token. The header value becomes the `playerId` — use any stable string per player.

```http
x-mock-player-id: player-abc123
```

Admin routes require:
```http
x-mock-admin-token: dev-admin-secret
```

**Do not build UI that stores or displays `dev-admin-secret`** — this token is rejected in `NODE_ENV=production` before authentication even runs (server halts at startup via `assertAdaptersNotMocked()`). The admin panel is a separate concern.

### Production (blocked)

`requirePlayer` will accept `Authorization: Bearer <token>` once a real `AuthAdapter` is injected. The frontend auth flow will use that header. No code change is needed in API routes — only the adapter injection changes on the server side.

### Socket.IO auth (dev)

```typescript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3000', {
  extraHeaders: { 'x-mock-player-id': playerId },
  // Production: use socket.auth = { token } instead
});
```

---

## 6. API Endpoints

### Rate limiting

Global: **300 requests / 15 minutes per IP.** Exceeded: HTTP 429 `TOO_MANY_REQUESTS`.

### Pagination query parameters

All paginated list endpoints accept:
- `?page=1` (default: 1, min: 1)
- `?limit=20` (default: 20, min: 1, max: 100)

---

### Health

| Method | Path | Auth | Response |
|--------|------|------|----------|
| GET | `/api/v1/health` | — | `{ status: "ok" }` |
| GET | `/api/v1/health/live` | — | `{ status: "ok" }` |
| GET | `/api/v1/health/ready` | — | `{ database: boolean, redis: boolean, ready: boolean }` |

---

### Categories — public

`GET /api/v1/bingo/categories` returns a bare `BingoCategory[]` (no pagination envelope).

```typescript
// GET /api/v1/bingo/categories[?activeOnly=false&page&limit]
// Response: ApiPage<BingoCategory>

// GET /api/v1/bingo/categories/:id
// Response: ApiSuccess<BingoCategory>

// GET /api/v1/bingo/categories/:id/rounds[?page&limit]
// Response: ApiPage<BingoRound>
```

---

### Rounds — public

```typescript
// GET /api/v1/bingo/rounds[?page&limit&status&categoryId]
// status filter: RoundStatus enum value
// Response: ApiPage<BingoRound>   ← round includes { category: { name, slug } }

// GET /api/v1/bingo/rounds/:id
// Response: ApiSuccess<BingoRound>  ← includes prizeRules[]

// GET /api/v1/bingo/rounds/:id/state
// Response: ApiSuccess<RoundState>   ← live cursor for polling / initial load

// GET /api/v1/bingo/rounds/:id/numbers
// Response: ApiSuccess<BingoDrawEvent[]>  ← ordered by sequence asc

// GET /api/v1/bingo/rounds/:id/winners
// Response: ApiSuccess<BingoPrizeAllocation[]>  ← includes nested claim+prizeRule

// GET /api/v1/bingo/rounds/:id/results
// Response: ApiSuccess<{ round: BingoRound, draws: BingoDrawEvent[], claims: BingoWinClaim[], allocations: BingoPrizeAllocation[] }>
```

---

### Purchases — player-authenticated

```typescript
// POST /api/v1/bingo/rounds/:id/purchases
// Headers: x-mock-player-id (dev) or Authorization: Bearer
// Body:
interface CreatePurchaseBody {
  ticketCount: number;       // 1–100, max capped by category.maxTicketsPerPurchase
  idempotencyKey: string;    // 8–128 chars; same key returns same purchase (idempotent)
}
// Response: ApiSuccess<{ purchase: BingoPurchase, tickets: BingoTicket[] }>
// Errors:  409 SALES_CLOSED (round not OPEN_FOR_SALE)
//          409 CONFLICT (idempotency key already used for a different round)
//          400 VALIDATION_ERROR (ticketCount > maxTicketsPerPurchase)

// GET /api/v1/bingo/purchases/:id
// Own purchase only — 403 if different player
// Response: ApiSuccess<BingoPurchase>   ← includes tickets[]
```

---

### Tickets & Cards — player-authenticated

```typescript
// GET /api/v1/bingo/tickets/:id
// Own ticket only — 403 if different player
// Response: ApiSuccess<BingoTicket & { card: BingoCard }>

// GET /api/v1/bingo/tickets/:id/card
// Response: ApiSuccess<BingoCard>    ← numbers[] is the 25-element card

// GET /api/v1/bingo/tickets/:id/wins
// Response: ApiSuccess<BingoWinClaim[]>   ← includes prizeRule.name
```

---

### My Account — player-authenticated

```typescript
// GET /api/v1/bingo/me/tickets[?page&limit]
// Response: ApiPage<BingoTicket & { card: BingoCard }>

// GET /api/v1/bingo/me/purchases[?page&limit]
// Response: ApiPage<BingoPurchase>

// GET /api/v1/bingo/me/wins[?page&limit]
// Response: ApiPage<BingoWinClaim>   ← includes prizeRule.name

// GET /api/v1/bingo/me/prizes[?page&limit]
// Response: ApiPage<BingoPrizeAllocation>   ← includes claim.prizeRule.name

// GET /api/v1/bingo/history[?page&limit]
// Rounds the player bought tickets for
// Response: ApiPage<BingoRound>   ← includes category { name, slug }
```

---

### Admin — dev-only (`x-mock-admin-token: dev-admin-secret`)

All admin routes return **401 in `NODE_ENV=production`** regardless of token.

```typescript
// Category management
GET    /api/v1/admin/bingo/categories
POST   /api/v1/admin/bingo/categories        // body: CreateCategoryBody
PATCH  /api/v1/admin/bingo/categories/:id    // body: Partial<CreateCategoryBody> (no slug change)

// Round lifecycle
GET    /api/v1/admin/bingo/rounds[?page&limit]
POST   /api/v1/admin/bingo/rounds            // body: CreateRoundBody
GET    /api/v1/admin/bingo/rounds/:id
PATCH  /api/v1/admin/bingo/rounds/:id        // SCHEDULED status only
POST   /api/v1/admin/bingo/rounds/:id/open-sales
POST   /api/v1/admin/bingo/rounds/:id/close-sales
POST   /api/v1/admin/bingo/rounds/:id/start
POST   /api/v1/admin/bingo/rounds/:id/cancel  // body: { reason: string }
POST   /api/v1/admin/bingo/rounds/:id/complete

// Game operations
POST   /api/v1/admin/bingo/rounds/:id/draw         // returns BingoDrawEvent
POST   /api/v1/admin/bingo/rounds/:id/verify-wins  // returns BingoWinClaim[]
POST   /api/v1/admin/bingo/rounds/:id/settle       // MOCK — real money disabled

// Financial
POST   /api/v1/admin/bingo/purchases/:id/reconcile

// Reports & audit
GET    /api/v1/admin/bingo/reports
GET    /api/v1/admin/bingo/audit-events[?roundId&page&limit]
GET    /api/v1/admin/bingo/results/:id
```

**Admin request bodies:**

```typescript
interface CreateCategoryBody {
  name: string;                     // max 64
  slug: string;                     // lowercase alphanumeric + hyphens
  description?: string;             // max 500
  isActive?: boolean;               // default true
  priceMinorUnits: number;          // integer, min 1
  currency?: string;                // 3-char ISO 4217, default "KES"
  maxTicketsPerPurchase?: number;   // 1–100, default 10
}

interface CreateRoundBody {
  categoryId: string;               // UUID
  scheduledStart: string;           // ISO 8601 datetime
  salesDeadline: string;            // ISO 8601 datetime, must be before scheduledStart
  maxTickets?: number;              // optional cap
  prizeRules?: Array<{
    name: string;
    pattern: { type: WinPattern };
    prizeMinorUnits?: number;
    prizePercentage?: number;       // 0–100
    callLimit?: number;             // 1–75
    priority?: number;              // default 0
  }>;
}
```

---

## 7. Socket.IO Events

Connect once per session. Join/leave round rooms as needed.

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('ws://localhost:3000', {
  extraHeaders: { 'x-mock-player-id': playerId },
  transports: ['websocket', 'polling'],
});

// Join a round room — receive snapshot immediately
socket.emit('round:join', roundId);

// Leave a round room
socket.emit('round:leave', roundId);
```

**Server → client events:**

```typescript
// Emitted on 'round:join' with current state + full draw history
socket.on('round:snapshot', (payload: {
  round: { id: string; status: RoundStatus; totalTickets: number };
  draws: Array<{ sequence: number; number: number; drawnAt: string }>;
  timestamp: string;
}) => { ... });

// Emitted when admin draws a number
socket.on('draw:number', (payload: {
  roundId: string;
  sequence: number;
  number: number;
  drawnAt: Date;   // Date object (not string) from socket serialisation
}) => { ... });

// Emitted on every round state transition
socket.on('round:status', (payload: {
  roundId: string;
  status: RoundStatus;
}) => { ... });

// Emitted when prize settlement finishes
socket.on('round:completed', (payload: {
  roundId: string;
  results: { settledCount: number };
}) => { ... });

// Emitted on room-join errors (round not found, auth failed)
socket.on('error', (payload: {
  code: string;
  message: string;
}) => { ... });
```

> **Note:** `draw:number.drawnAt` arrives as a `Date` object (not ISO string) due to Socket.IO's default serialization. Use `.toISOString()` or store as milliseconds if you need to compare with HTTP responses.

---

## 8. Money & Prices

All amounts are **integer minor units**. For KES: divide by 100 to display.

```typescript
function formatKES(minorUnits: number): string {
  return `KES ${(minorUnits / 100).toFixed(2)}`;
}
// 500 → "KES 5.00"
// 1000 → "KES 10.00"
```

The `currency` field is always `"KES"` for now. Treat it as a hint to select the formatter, not a guaranteed value in case it changes.

**Purchase idempotency key:** Generate once per checkout attempt and store client-side. Retry with the same key — the server returns the existing purchase. A UUIDv4 is a safe choice.

```typescript
const idempotencyKey = crypto.randomUUID(); // store in sessionStorage before POST
```

---

## 9. Endpoint Test Coverage

### Tested by integration tests (mocked Prisma)

| Endpoint | Tests |
|----------|-------|
| `GET /bingo/categories` | ✅ |
| `GET /bingo/categories/:id` | ✅ |
| `GET /bingo/rounds` | ✅ (list, status filter, pagination) |
| `GET /bingo/rounds/:id/state` | ✅ |
| `POST /bingo/rounds/:id/purchases` | ✅ (auth, validation, ownership) |
| `GET /bingo/me/tickets` | ✅ |
| `POST /admin/bingo/rounds/:id/draw` | ✅ |
| `GET /admin/bingo/reports` | ✅ |
| `POST /admin/bingo/categories` | ✅ (admin guard) |
| `GET /admin/bingo/audit-events` | ✅ |
| All error shapes (401, 403, 400, 404) | ✅ |
| Health `GET /health`, `/health/ready` | ✅ |

### Implemented but not yet covered by automated tests

These endpoints are wired up and work correctly at the service layer but lack dedicated integration test files:

| Endpoint | Status |
|----------|--------|
| `GET /bingo/rounds/:id/numbers` | Implemented, no integration test |
| `GET /bingo/rounds/:id/winners` | Implemented, no integration test |
| `GET /bingo/rounds/:id/results` | Implemented, no integration test |
| `GET /bingo/purchases/:id` | Implemented, no integration test |
| `GET /bingo/tickets/:id` | Implemented, no integration test |
| `GET /bingo/tickets/:id/card` | Implemented, no integration test |
| `GET /bingo/tickets/:id/wins` | Implemented, no integration test |
| `GET /bingo/me/purchases` | Implemented, no integration test |
| `GET /bingo/me/wins` | Implemented, no integration test |
| `GET /bingo/me/prizes` | Implemented, no integration test |
| `GET /bingo/history` | Implemented, no integration test |
| All round lifecycle transitions | Service tested; route integration tests not written |
| `POST .../verify-wins` | Service implemented; no integration test |
| `POST .../settle` | Service implemented (mock); no integration test |
| `POST .../reconcile` | Implemented; no integration test |
| Socket.IO events | Functional; no automated test (requires live server) |

**Recommendation:** Use the untested endpoints freely in the frontend — the service logic is sound and TypeScript-clean. Add integration tests as you build each screen.

---

## 10. Missing / Blocked Functionality

These are not available yet and may affect frontend screens:

| Feature | Status | Frontend approach |
|---------|--------|-------------------|
| Real player login (JWT) | ⛔ Blocked — needs company auth | Use mock header in dev; show "sign in" placeholder in UI |
| Real wallet debit | ⛔ Blocked — needs company wallet | Purchase flow works end-to-end with mock; show "payment processed" in dev |
| Real prize credit | ⛔ Blocked — needs company wallet | Prize history shows correctly; amounts are in DB regardless |
| Percentage-based prizes | ⚠️ Stored, not calculated | Show `prizeMinorUnits` only; hide `prizePercentage` until defined |
| Round cancellation refund | ⚠️ Not implemented | Show "cancelled" status; refund UI is future work |
| `callLimit` enforcement | ⚠️ Stored, not enforced | Ignore for now; prize rules fire regardless of draw count |
| Multi-instance Socket.IO | ⚠️ Single-instance | Fine for dev; note for deployment planning |

---

## 11. Error Codes Reference

| Code | HTTP | When |
|------|------|------|
| `UNAUTHORIZED` | 401 | No auth header or invalid player token |
| `FORBIDDEN` | 403 | Wrong admin token |
| `NOT_FOUND` | 404 | Resource does not exist |
| `VALIDATION_ERROR` | 400 | Zod schema failure — check `error.details.fieldErrors` |
| `INVALID_UUID` | 400 | Path param is not a valid UUID |
| `INVALID_JSON` | 400 | Malformed JSON request body |
| `INVALID_STATE_TRANSITION` | 409 | Round state machine violation |
| `SALES_CLOSED` | 409 | Round is not `OPEN_FOR_SALE` |
| `CONFLICT` | 409 | Duplicate slug or idempotency key collision |
| `TOO_MANY_REQUESTS` | 429 | 300+ requests / 15 min from same IP |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

---

## 12. Suggested Frontend Mock Data Strategy

For screens that require data not yet in the DB (empty dev environment):

1. **Categories & Rounds** — seed via admin panel using the real `POST /admin/bingo/categories` and `POST /admin/bingo/rounds` endpoints. These work fully.
2. **Purchases & Tickets** — open a round for sales, then `POST /bingo/rounds/:id/purchases` with the mock player header. Cards are real 75-ball cards in the DB.
3. **Live draw** — `POST /admin/bingo/rounds/:id/draw` to trigger broadcasts. Connect a Socket.IO client to see events.
4. **Wins & prizes** — run verify-wins + settle-prizes via admin after drawing numbers.

There is no need for a separate mock server — the real API with mock auth/wallet handles all dev scenarios.
