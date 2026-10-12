# API Endpoints

Base URL: `http://localhost:3000`  
Interactive docs: `GET /api/docs`  
Machine-readable spec: `GET /api/openapi.json`

Auth headers (development only):
- Player: `x-mock-player-id: <any-string>`
- Admin: `x-mock-admin-token: dev-admin-secret`

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/health` | — | Liveness |
| GET | `/api/v1/health/live` | — | Liveness alias |
| GET | `/api/v1/health/ready` | — | Readiness (DB + Redis) |

---

## Bingo — Public

### Categories
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/bingo/categories` | List active categories (`?activeOnly=false` for all) |
| GET | `/api/v1/bingo/categories/:id` | Get category |
| GET | `/api/v1/bingo/categories/:id/rounds` | Paginated rounds for a category |

### Rounds
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/bingo/rounds` | Paginated rounds (`?status=`, `?categoryId=`) |
| GET | `/api/v1/bingo/rounds/:id` | Round with prize rules |
| GET | `/api/v1/bingo/rounds/:id/state` | Live cursor: status, drawCount, lastDrawnNumber, lastDrawnAt |
| GET | `/api/v1/bingo/rounds/:id/numbers` | Draw history (sequence order) |
| GET | `/api/v1/bingo/rounds/:id/winners` | Prize allocations with claims |
| GET | `/api/v1/bingo/rounds/:id/results` | Full results: round + draws + claims + allocations |

---

## Bingo — Authenticated Player

### Purchases
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/bingo/rounds/:id/purchases` | Buy tickets (requires `ticketCount`, `idempotencyKey`) |
| GET | `/api/v1/bingo/purchases/:id` | Get purchase (owner only) |

### Tickets & Cards
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/bingo/tickets/:id` | Get ticket (owner only) |
| GET | `/api/v1/bingo/tickets/:id/card` | Get 25-number card layout |
| GET | `/api/v1/bingo/tickets/:id/wins` | Win claims for a ticket |

### My Account
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/bingo/me/tickets` | My tickets (paginated) |
| GET | `/api/v1/bingo/me/purchases` | My purchases (paginated) |
| GET | `/api/v1/bingo/me/wins` | My win claims (paginated) |
| GET | `/api/v1/bingo/me/prizes` | My prize allocations (paginated) |
| GET | `/api/v1/bingo/history` | Rounds I participated in (paginated) |

---

## Bingo — Admin (`x-mock-admin-token: dev-admin-secret`)

### Category Management
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/bingo/categories` | List all categories (including inactive) |
| POST | `/api/v1/admin/bingo/categories` | Create category |
| PATCH | `/api/v1/admin/bingo/categories/:id` | Update category |

### Round Lifecycle
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/bingo/rounds` | List rounds (paginated) |
| POST | `/api/v1/admin/bingo/rounds` | Schedule a round |
| GET | `/api/v1/admin/bingo/rounds/:id` | Get round |
| PATCH | `/api/v1/admin/bingo/rounds/:id` | Update round (SCHEDULED only) |
| POST | `/api/v1/admin/bingo/rounds/:id/open-sales` | `SCHEDULED → OPEN_FOR_SALE` |
| POST | `/api/v1/admin/bingo/rounds/:id/close-sales` | `OPEN_FOR_SALE → SALES_CLOSED` |
| POST | `/api/v1/admin/bingo/rounds/:id/start` | `SALES_CLOSED → IN_PROGRESS` |
| POST | `/api/v1/admin/bingo/rounds/:id/cancel` | Any → `CANCELLED` (requires `reason`) |
| POST | `/api/v1/admin/bingo/rounds/:id/complete` | `IN_PROGRESS → COMPLETED` |

### Draw & Win Verification
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/admin/bingo/rounds/:id/draw` | Draw next number (1–75, crypto-secure, unique) |
| POST | `/api/v1/admin/bingo/rounds/:id/verify-wins` | Scan all tickets for wins (idempotent) |
| POST | `/api/v1/admin/bingo/rounds/:id/settle` | Credit prize winners (mock — real money disabled) |

### Financial & Admin Tools
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/admin/bingo/purchases/:id/reconcile` | Resolve a PENDING purchase via wallet |
| GET | `/api/v1/admin/bingo/reports` | Aggregate counts incl. pendingPurchases |
| GET | `/api/v1/admin/bingo/audit-events` | Audit log (`?roundId=`, `?page=`, `?limit=`) |
| GET | `/api/v1/admin/bingo/results/:id` | Round results alias |

---

## Common Response Envelope

```json
{ "success": true,  "data": { ... }, "requestId": "<uuid>" }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "..." }, "requestId": "<uuid>" }
```

Paginated responses include:
```json
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }, "requestId": "..." }
```

## Standard Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Zod validation failed |
| `INVALID_UUID` | 400 | Path param is not a UUID |
| `INVALID_JSON` | 400 | Malformed JSON body |
| `INVALID_STATE_TRANSITION` | 409 | Round state machine violation |
| `SALES_CLOSED` | 409 | Round is not OPEN_FOR_SALE |
| `CONFLICT` | 409 | Duplicate (slug/idempotency key) |
| `UNAUTHORIZED` | 401 | No/invalid auth credentials |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `TOO_MANY_REQUESTS` | 429 | Rate limit (300 req/15 min) |
| `INTERNAL_ERROR` | 500 | Unhandled server error |

## Socket.IO Events

Connect to `ws://localhost:3000` with header `x-mock-player-id: <playerId>`.

| Event (client→server) | Payload | Description |
|----------------------|---------|-------------|
| `round:join` | `roundId: string` | Join round room, receive snapshot |
| `round:leave` | `roundId: string` | Leave room |

| Event (server→client) | Payload | Trigger |
|----------------------|---------|---------|
| `round:snapshot` | `{ round, draws }` | On `round:join` |
| `draw:number` | `{ roundId, sequence, number, drawnAt }` | Admin draws a number |
| `round:status` | `{ roundId, status }` | Any state transition |
| `round:completed` | `{ roundId, settledCount }` | Prize settlement finishes |
| `error` | `{ code, message }` | Round not found, auth error |
