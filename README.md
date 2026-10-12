# Bingo Platform

npm workspaces monorepo. Phase 2 ships the full Bingo backend (`apps/api`).

## Architecture

```
bingo-platform/
├── apps/api/                     # Express API (Phase 2)
│   ├── src/
│   │   ├── modules/bingo/        # categories, rounds, purchases, tickets,
│   │   │   ├── categories/       #   draws, wins, live socket, admin RBAC
│   │   │   ├── rounds/
│   │   │   ├── purchases/
│   │   │   ├── tickets/
│   │   │   ├── draws/
│   │   │   ├── wins/
│   │   │   ├── live/             # Socket.IO rooms + broadcasts
│   │   │   └── admin/            # Admin router + reports
│   │   ├── lib/                  # auth adapter, wallet adapter, prisma, redis
│   │   ├── middleware/           # requirePlayer, requireAdmin, errorHandler
│   │   └── openapi/              # OpenAPI 3.1.0 spec (41 paths)
│   ├── prisma/                   # schema + migrations
│   ├── scripts/
│   │   └── validate-routes.ts    # exits 1 if any route is undocumented
│   └── tests/                    # 84 tests (unit + integration)
├── docs/
│   ├── API_ENDPOINTS.md          # all 41 endpoints + socket events
│   ├── BACKEND_AUDIT.md          # feature status, test coverage, blockers
│   └── INTEGRATION_CONTRACTS.md  # AuthAdapter + WalletAdapter interfaces
└── .env                          # never committed
```

## Prerequisites

### Ubuntu — PostgreSQL

```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres psql -c "CREATE USER bingo WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE bingo_db OWNER bingo;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE bingo_db TO bingo;"
```

> **Note:** `prisma migrate dev` requires `CREATE DATABASE` permission (shadow DB). If your DB user lacks it, use `npm run db:deploy` after the initial setup instead.

### Ubuntu — Redis

```bash
sudo apt install redis-server
sudo systemctl start redis-server
redis-cli ping   # should reply PONG
```

## Setup

```bash
git clone <repo>
cd bingo-platform
cp .env.example .env       # fill in DATABASE_URL, REDIS_URL
npm install
npm run db:generate        # generate Prisma Client
npm run db:deploy          # apply migrations (no shadow DB needed)
```

## Environment Variables (`.env`)

| Variable            | Required | Default       | Description                       |
|---------------------|----------|---------------|-----------------------------------|
| `DATABASE_URL`      | ✓        | —             | PostgreSQL connection string      |
| `REDIS_URL`         | ✓        | —             | Redis connection URL              |
| `NODE_ENV`          |          | `development` | `development\|production\|test`   |
| `PORT`              |          | `3000`        | HTTP listen port                  |
| `CORS_ORIGIN`       |          | `*`           | Allowed origin(s)                 |
| `LOG_LEVEL`         |          | `info`        | Pino log level                    |
| `ADMIN_SECRET`      |          | —             | Dev admin token (`x-mock-admin-token`) |

## Commands

All commands run from the repo root via npm workspaces.

| Command                              | Description                                         |
|--------------------------------------|-----------------------------------------------------|
| `npm run dev -w @bingo/api`          | Start dev server with hot-reload                    |
| `npm run build -w @bingo/api`        | Compile TypeScript to `dist/`                       |
| `npm run typecheck -w @bingo/api`    | Type-check without emitting                         |
| `npm test -w @bingo/api`             | Run all 84 tests                                    |
| `npm run db:generate -w @bingo/api`  | Regenerate Prisma Client after schema changes       |
| `npm run db:migrate -w @bingo/api`   | Create + apply a new migration (needs `CREATEDB`)   |
| `npm run db:deploy -w @bingo/api`    | Apply pending migrations (CI/production-safe)       |
| `npm run db:studio -w @bingo/api`    | Open Prisma Studio GUI                              |
| `npm run openapi:export -w @bingo/api`        | Write `openapi.json` to disk               |
| `npm run openapi:validate-routes -w @bingo/api` | Verify every Express route is in the spec |

## API

Interactive docs: `GET /api/docs` (Swagger UI)  
Machine-readable spec: `GET /api/openapi.json`

### Development Auth Headers

| Who | Header |
|-----|--------|
| Player | `x-mock-player-id: <any-string>` |
| Admin | `x-mock-admin-token: dev-admin-secret` |

> Both headers are **blocked in production**. Real adapters must be injected before starting the server in `NODE_ENV=production`. See `docs/INTEGRATION_CONTRACTS.md`.

### Key Endpoint Groups

| Group | Prefix | Auth |
|-------|--------|------|
| Health | `/api/v1/health` | — |
| Bingo public | `/api/v1/bingo/` | — |
| Bingo player | `/api/v1/bingo/me/`, `/api/v1/bingo/rounds/:id/purchases` | Player Bearer |
| Bingo admin | `/api/v1/admin/bingo/` | Admin token |

Full endpoint reference: [`docs/API_ENDPOINTS.md`](docs/API_ENDPOINTS.md)

## Response Envelope

```json
{ "success": true, "data": { ... }, "requestId": "uuid" }
{ "success": false, "error": { "code": "NOT_FOUND", "message": "..." }, "requestId": "uuid" }
```

Paginated:
```json
{ "success": true, "data": [...], "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }, "requestId": "uuid" }
```

## Socket.IO

Connect to `ws://localhost:3000`. Auth via `x-mock-player-id` header (dev) or Bearer token (production).

| Client → Server | Payload |
|-----------------|---------|
| `round:join` | `{ roundId }` |
| `round:leave` | `{ roundId }` |

| Server → Client | Trigger |
|-----------------|---------|
| `round:snapshot` | On join |
| `draw:number` | Admin draws a number |
| `round:status` | Any state transition |
| `round:completed` | Prize settlement complete |

## Production Readiness

The backend is **development-complete but not production-ready**. Two hard blockers remain:

1. **AuthAdapter** — company identity service integration required (JWT verification, player ID format).
2. **WalletAdapter** — company wallet API integration required (debit/credit/reconcile endpoints).

Until both adapters are replaced, `assertAdaptersNotMocked()` in `server.ts` will halt startup with `process.exit(1)` if mock adapters are still active in `NODE_ENV=production`.

See [`docs/BACKEND_AUDIT.md`](docs/BACKEND_AUDIT.md) for the full feature/gap list and [`docs/INTEGRATION_CONTRACTS.md`](docs/INTEGRATION_CONTRACTS.md) for the exact interfaces to implement.

## Troubleshooting

**`permission denied to create database` on `db:migrate`**  
Use `npm run db:deploy` which applies existing migration files without creating a shadow DB. Grant `CREATEDB` to your user if you need `db:migrate` in dev:
```sql
ALTER USER bingo CREATEDB;
```

**`REDIS_URL not found`**  
The root `.env` is loaded via `scripts/prisma-env.js`. Verify `REDIS_URL` is set and Redis is running.

**Port conflict**  
Change `PORT` in `.env`.

**Mock adapter still active in production**  
`server.ts` calls `assertAdaptersNotMocked()` at startup. Implement and inject real adapters via `setAuthAdapter()` / `setWalletAdapter()` before calling `startServer()`.
