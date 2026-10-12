/**
 * Wallet adapter interface for financial operations.
 * Real implementations connect to company M-Pesa / wallet infrastructure.
 * MockWalletAdapter is for development and testing ONLY.
 * Real-money operations are DISABLED until approved.
 */

export interface WalletDebitResult {
  externalRef: string;
  status: 'CONFIRMED' | 'PENDING' | 'FAILED';
  amountMinorUnits: number;
  currency: string;
}

export interface WalletCreditResult {
  externalRef: string;
  status: 'CONFIRMED' | 'PENDING' | 'FAILED';
  amountMinorUnits: number;
  currency: string;
}

export interface WalletTransactionStatus {
  externalRef: string;
  status: 'CONFIRMED' | 'PENDING' | 'FAILED' | 'UNKNOWN';
  amountMinorUnits: number;
  currency: string;
}

export interface WalletAdapter {
  debit(
    playerId: string,
    amountMinorUnits: number,
    currency: string,
    idempotencyKey: string,
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

  reconcile(
    externalRef: string,
  ): Promise<{ status: 'CONFIRMED' | 'FAILED'; finalAmount?: number }>;
}

// ─── Mock adapter (dev/test only) ─────────────────────────────────────────────
// ⚠ Always returns CONFIRMED. Never call real services.

let _mockRefCounter = 0;

export const mockWalletAdapter: WalletAdapter = {
  async debit(playerId, amountMinorUnits, currency, idempotencyKey) {
    _mockRefCounter += 1;
    return {
      externalRef: `mock-debit-${idempotencyKey}-${_mockRefCounter}`,
      status: 'CONFIRMED',
      amountMinorUnits,
      currency,
    };
  },
  async credit(playerId, amountMinorUnits, currency, idempotencyKey) {
    _mockRefCounter += 1;
    return {
      externalRef: `mock-credit-${idempotencyKey}-${_mockRefCounter}`,
      status: 'CONFIRMED',
      amountMinorUnits,
      currency,
    };
  },
  async getTransactionStatus(externalRef) {
    return { externalRef, status: 'CONFIRMED', amountMinorUnits: 0, currency: 'KES' };
  },
  async reconcile(externalRef) {
    return { status: 'CONFIRMED' };
  },
};

let _walletAdapter: WalletAdapter = mockWalletAdapter;

export function setWalletAdapter(adapter: WalletAdapter): void {
  _walletAdapter = adapter;
}

export function getWalletAdapter(): WalletAdapter {
  return _walletAdapter;
}
