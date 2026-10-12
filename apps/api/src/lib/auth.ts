/**
 * Authentication & authorization adapter interfaces.
 * Real implementations are injected at runtime from company auth infrastructure.
 * Mock implementations are used in development/test only and MUST NOT reach production.
 */

export interface PlayerContext {
  playerId: string;
  username: string;
  roles: string[];
}

export interface AdminContext {
  adminId: string;
  username: string;
  roles: string[];
}

export type AuthContext = PlayerContext | AdminContext;

export interface AuthAdapter {
  verifyPlayerToken(token: string): Promise<PlayerContext | null>;
  verifyAdminToken(token: string): Promise<AdminContext | null>;
}

// ─── Mock adapter (dev/test only) ─────────────────────────────────────────────

export const MOCK_PLAYER_HEADER = 'x-mock-player-id';
export const MOCK_ADMIN_HEADER = 'x-mock-admin-token';
export const DEV_ADMIN_TOKEN = 'dev-admin-secret';

export const mockAuthAdapter: AuthAdapter = {
  async verifyPlayerToken(token: string): Promise<PlayerContext | null> {
    if (!token) return null;
    return { playerId: token, username: `player-${token}`, roles: ['player'] };
  },
  async verifyAdminToken(token: string): Promise<AdminContext | null> {
    if (token !== DEV_ADMIN_TOKEN) return null;
    return { adminId: 'dev-admin', username: 'dev-admin', roles: ['admin'] };
  },
};

let _adapter: AuthAdapter = mockAuthAdapter;

export function setAuthAdapter(adapter: AuthAdapter): void {
  _adapter = adapter;
}

export function getAuthAdapter(): AuthAdapter {
  return _adapter;
}
