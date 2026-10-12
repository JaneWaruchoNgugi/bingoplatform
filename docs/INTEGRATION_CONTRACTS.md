# Integration Contracts

This document describes every external interface the Bingo module depends on that must be fulfilled by the parent platform before the module can go live.

---

## 1. Player Identity (AuthAdapter)

**Interface file:** `apps/api/src/lib/auth.ts`

The Bingo module never manages registration, login, or credential storage. It receives a verified player identity token on each request and must validate it via the company's auth infrastructure.

### Interface

```typescript
interface AuthAdapter {
  verifyPlayerToken(token: string): Promise<PlayerContext | null>;
  verifyAdminToken(token: string): Promise<AdminContext | null>;
}

interface PlayerContext {
  playerId: string;    // authoritative player identifier
  username: string;
  roles: string[];
}

interface AdminContext {
  adminId: string;
  username: string;
  roles: string[];
}
```

### Required from company

| Item | Notes |
|------|-------|
| **Token format** | JWT, opaque token, session cookie? |
| **Verification endpoint / SDK** | URL, key, or library to validate tokens |
| **Player ID format** | UUID, integer, external provider ID? |
| **Admin role claim** | Which role name or claim grants admin access? |
| **Token lifetime / refresh** | How to handle expired tokens at request time |
| **Eligibility flags** | Any player flags that should block ticket purchases (e.g. self-exclusion, KYC pending)? |

### Current status

**MOCK ONLY.** `mockAuthAdapter` accepts `x-mock-player-id` header as player identity and `x-mock-admin-token: dev-admin-secret` as admin auth. **Both are hard-blocked in production** — `requireAdmin` returns 401 in `NODE_ENV=production`, and `assertAdaptersNotMocked()` in `server.ts` halts startup if mock adapters are still registered.

### Integration steps

1. Implement `AuthAdapter` against company auth service.
2. Call `setAuthAdapter(realAdapter)` before `startServer()`.
3. Remove `x-mock-player-id` / `x-mock-admin-token` from `CORS allowedHeaders` in production.

---

## 2. Wallet (WalletAdapter)

**Interface file:** `apps/api/src/lib/wallet.ts`

All financial operations — ticket debits and prize credits — go through a single typed adapter. **Real-money transactions are disabled until this adapter is replaced.**

### Interface

```typescript
interface WalletAdapter {
  debit(
    playerId: string,
    amountMinorUnits: number,   // e.g. 500 = KES 5.00
    currency: string,           // ISO 4217, default "KES"
    idempotencyKey: string,     // caller-controlled; same key = same transaction
    description: string,
  ): Promise<WalletDebitResult>;

  credit(
    playerId: string,
    amountMinorUnits: number,
    currency: string,
    idempotencyKey: string,
    description: string,
  ): Promise<WalletCreditResult>;

  getTransactionStatus(externalRef: string): Promise<WalletTransactionStatus>;

  reconcile(externalRef: string): Promise<{ status: 'CONFIRMED' | 'FAILED'; finalAmount?: number }>;
}
```

**Result statuses:** `CONFIRMED | PENDING | FAILED`
- `CONFIRMED` — funds moved, proceed with ticket issuance / prize payout.
- `PENDING` — outcome not yet known; Bingo stores the purchase as PENDING and provides `POST /api/v1/admin/bingo/purchases/:id/reconcile` to resolve it later.
- `FAILED` — transaction rejected; purchase is not confirmed, no tickets issued.

### Required from company

| Item | Notes |
|------|-------|
| **Wallet API base URL** | Dev / staging / production URLs |
| **Authentication** | API key, mTLS, OAuth client credentials? |
| **Idempotency key handling** | How the wallet deduplicates: header, body field, URL segment? |
| **Currency units** | Confirm "minor units" (e.g. 500 = KES 5.00) or full units? |
| **Async confirmation flow** | Does debit return PENDING with webhook callback, or is it synchronous? |
| **Reconcile endpoint** | URL / method for final status of a PENDING ref |
| **Error codes** | Insufficient funds, player not found, daily limit exceeded — how expressed? |
| **Prize credit constraints** | Can the Bingo module credit any player, or only players who made a debit in that round? |

### Current status

**MOCK ONLY.** `mockWalletAdapter` always returns `CONFIRMED`. `assertAdaptersNotMocked()` in `server.ts` blocks production startup with mock adapter active.

### Integration steps

1. Implement `WalletAdapter` against company wallet API.
2. Call `setWalletAdapter(realAdapter)` before `startServer()`.
3. Test `PENDING` → reconcile flow with company sandbox before enabling async purchases.

---

## 3. Financial Reference Durability

Every debit and credit is stored as a `BingoFinancialReference` record (table `bingo_financial_references`) with:
- `externalRef` — the reference returned by the wallet, used for idempotency and reconciliation.
- `status` — `PENDING | CONFIRMED | FAILED`.
- `type` — `DEBIT | CREDIT`.

On restart all PENDING records persist in PostgreSQL. The reconciliation endpoint allows manual or automated resolution.

### Data no one should ever mutate externally

- `bingo_cards.numbers` — the authoritative card layout for win checking.
- `bingo_draw_events.number` / `.sequence` — draw history is append-only.
- `bingo_win_claims` — created by server-side verification, never by the client.

---

## 4. Socket.IO Live Room (Production)

For multi-instance deployments, configure the Redis adapter **before** `initSocket()`:

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: process.env.REDIS_URL });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

**Current status:** Single-instance only. State is restored from PostgreSQL on reconnect — Redis is not used as financial source of truth.

---

## 5. Information Required Before Go-Live

The following decisions must be confirmed before any production ticket purchase can be processed:

1. **Auth token format and verification library/endpoint.**
2. **Wallet API credentials and sandbox access.**
3. **Idempotency key format accepted by the wallet** (min/max length, allowed characters).
4. **PENDING transaction reconciliation mechanism** (webhook push vs. poll interval).
5. **Player eligibility check** — does the Bingo module call a KYC/AML endpoint, or does the auth token already encode eligibility?
6. **Prize currency** — are all prizes in KES, or does the category define currency?
7. **Jackpot / percentage-based prize calculation** — `prizePercentage` is stored but not used in settlement (`settleAllocations` uses `prizeMinorUnits` only). Percentage payout logic must be defined and approved.
8. **Maximum ticket price** — validation currently trusts the `BingoCategory.priceMinorUnits` stored at category creation. Business approval needed for any price change workflow.
9. **Draw authority** — must every draw be triggered by a specific operator role, or is automated drawing acceptable?
10. **Regulatory / licensing obligations** — any specific audit record format, retention period, or regulator notification requirements?
