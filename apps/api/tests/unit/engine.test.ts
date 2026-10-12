/**
 * Pure game-engine logic tests: callLimit enforcement, simultaneous winners,
 * multi-pattern wins, and FREE-cell behaviour.
 *
 * These tests call checkWin / checkAllPatterns directly — no HTTP, no Prisma.
 * They verify the invariants that verifyAndClaimWins relies on.
 */

import { describe, it, expect } from 'vitest';
import { checkWin, checkAllPatterns } from '../../src/modules/bingo/cards/card.service';

// The same deterministic card used across tests.
// index = row * 5 + col
//   B col (0): 1, 2, 3, 4, 5
//   I col (1): 16,17,18,19,20
//   N col (2): 31,32,FREE,33,34  (index 12 = FREE = 0)
//   G col (3): 46,47,48,49,50
//   O col (4): 61,62,63,64,65
const CARD = [
   1,  16,  31,  46,  61,
   2,  17,  32,  47,  62,
   3,  18,   0,  48,  63,
   4,  19,  33,  49,  64,
   5,  20,  34,  50,  65,
];

// Helper: build an ordered draw list from an array, mimicking BingoDrawEvent
function draws(numbers: number[]) {
  return numbers.map((number, i) => ({ number, sequence: i + 1 }));
}

// Helper: the callLimit slice logic extracted from verifyAndClaimWins
function effectiveSet(orderedDraws: { number: number }[], callLimit: number | null) {
  const slice = callLimit !== null ? orderedDraws.slice(0, callLimit) : orderedDraws;
  return new Set(slice.map((d) => d.number));
}

// ─── callLimit enforcement ────────────────────────────────────────────────────

describe('callLimit: rule fires when pattern completes within the limit', () => {
  it('ANY_ROW row 0 with callLimit=10: fires at draw 4 (all 4 non-FREE values drawn)', () => {
    // row 0: values 1,16,31,46,61 — all non-zero, no FREE in row 0
    const ordered = draws([1, 16, 31, 46, 61, 2, 17, 32, 47, 62]); // 10 total
    const effective = effectiveSet(ordered, 10);
    expect(checkWin('ANY_ROW', CARD, effective)).toBe(true);
  });

  it('ANY_ROW row 0 with callLimit=5: fires (exactly enough draws)', () => {
    const ordered = draws([1, 16, 31, 46, 61]);
    const effective = effectiveSet(ordered, 5);
    expect(checkWin('ANY_ROW', CARD, effective)).toBe(true);
  });

  it('ANY_ROW row 2 (has FREE) with callLimit=4: fires with 4 drawn', () => {
    // row 2: values 3,18,FREE,48,63 — need 3,18,48,63
    const ordered = draws([3, 18, 48, 63]);
    const effective = effectiveSet(ordered, 4);
    expect(checkWin('ANY_ROW', CARD, effective)).toBe(true);
  });
});

describe('callLimit: rule is blocked when pattern completes AFTER the limit', () => {
  it('ANY_ROW row 0 with callLimit=3: blocked (only 3 draws, 5 needed)', () => {
    const ordered = draws([1, 16, 31, 46, 61]);
    const effective = effectiveSet(ordered, 3); // only first 3: {1,16,31}
    expect(checkWin('ANY_ROW', CARD, effective)).toBe(false);
  });

  it('callLimit=4 on a row needing 5 draws: blocked', () => {
    const ordered = draws([1, 16, 31, 46, 61, 999]);
    const effective = effectiveSet(ordered, 4); // first 4: {1,16,31,46}
    expect(checkWin('ANY_ROW', CARD, effective)).toBe(false);
  });

  it('callLimit=20 but only 10 draws available: uses all 10 draws (no error)', () => {
    // Should evaluate against the 10 available draws, not crash
    const ordered = draws([1, 16, 31, 46, 61, 2, 17, 32, 47, 62]);
    const effective = effectiveSet(ordered, 20); // slice(0,20) on len-10 = all 10
    expect(checkWin('ANY_ROW', CARD, effective)).toBe(true); // row 0 is drawn
  });
});

describe('callLimit: exact boundary', () => {
  it('callLimit equals exactly the draw that completes the row: fires', () => {
    // 5th draw completes row 0
    const ordered = draws([2, 17, 1, 16, 31, 46, 61]); // 31 is draw 5 of row-0 numbers
    // Wait — row 0 needs: 1,16,31,46,61 — completed at draw 7 here
    // Let's make 5th draw complete the row
    const ordered2 = draws([1, 16, 31, 46, 61]); // row 0 complete at draw 5
    expect(checkWin('ANY_ROW', CARD, effectiveSet(ordered2, 5))).toBe(true);  // exact: fires
    expect(checkWin('ANY_ROW', CARD, effectiveSet(ordered2, 4))).toBe(false); // one short: blocked
  });
});

// ─── callLimit=null (unlimited) ───────────────────────────────────────────────

describe('callLimit: null means no limit (evaluate against all drawn numbers)', () => {
  it('fires regardless of draw count when callLimit is null', () => {
    const ordered = draws([1, 16, 31, 46, 61]);
    const effective = effectiveSet(ordered, null);
    expect(checkWin('ANY_ROW', CARD, effective)).toBe(true);
  });
});

// ─── Simultaneous winners ─────────────────────────────────────────────────────

describe('simultaneous winners: multiple tickets can win the same pattern', () => {
  // Two cards, both have row 0 drawn
  const CARD_A = [...CARD]; // already wins row 0 when 1,16,31,46,61 drawn

  const CARD_B = [
    7,  22,  37,  52,  67,   // row 0 — different numbers, same column ranges
    8,  23,  38,  53,  68,
    9,  24,   0,  54,  69,
   10,  25,  39,  55,  70,
   11,  26,  40,  56,  71,
  ];

  it('both cards win ANY_ROW when their respective row-0 numbers are drawn', () => {
    const drawnA = new Set([1, 16, 31, 46, 61]);
    const drawnB = new Set([7, 22, 37, 52, 67]);

    expect(checkWin('ANY_ROW', CARD_A, drawnA)).toBe(true);
    expect(checkWin('ANY_ROW', CARD_B, drawnB)).toBe(true);
  });

  it('one card wins, other does not, when only first card row drawn', () => {
    const drawn = new Set([1, 16, 31, 46, 61]); // only CARD_A row 0
    expect(checkWin('ANY_ROW', CARD_A, drawn)).toBe(true);
    expect(checkWin('ANY_ROW', CARD_B, drawn)).toBe(false);
  });

  it('shared drawn set can produce wins on different patterns for different cards', () => {
    // Shared draws that complete CARD_A row 0 AND CARD_B TL diagonal
    // CARD_B TL diagonal: indices 0,6,12,18,24 → 7,23,0(FREE),55,71
    const shared = new Set([1, 16, 31, 46, 61,   // CARD_A row 0
                            7, 23, 55, 71]);        // CARD_B TL diagonal (FREE auto-counts)
    expect(checkWin('ANY_ROW', CARD_A, shared)).toBe(true);
    expect(checkWin('ANY_DIAG', CARD_B, shared)).toBe(true);
  });
});

// ─── Multiple prize rules on one ticket ───────────────────────────────────────

describe('single ticket can win multiple patterns simultaneously', () => {
  it('row 0 + B column simultaneously when both are complete', () => {
    // row 0: 1,16,31,46,61; B col: 1,2,3,4,5
    const drawn = new Set([1, 16, 31, 46, 61, 2, 3, 4, 5]);
    const wins = checkAllPatterns(CARD, drawn);
    expect(wins).toContain('ANY_ROW');
    expect(wins).toContain('ANY_COL');
  });

  it('TL diagonal + FOUR_CORNERS can fire without any full row or column', () => {
    // TL diagonal: 1,17,FREE,49,65; FOUR_CORNERS: 1,61,5,65
    // Together: 1,17,49,65,61,5 — does diagonal fire? 1,17,0(FREE),49,65 ✓
    const drawn = new Set([1, 17, 49, 65, 61, 5]);
    const wins = checkAllPatterns(CARD, drawn);
    expect(wins).toContain('ANY_DIAG');
    expect(wins).toContain('FOUR_CORNERS');
    expect(wins).not.toContain('FULL_HOUSE');
  });
});

// ─── FREE cell behaviour ──────────────────────────────────────────────────────

describe('FREE cell always counts as matched in every pattern', () => {
  it('row 2 needs only 4 draws (FREE at index 12 auto-counts)', () => {
    // row 2: 3,18,0(FREE),48,63 — need 3,18,48,63
    expect(checkWin('ANY_ROW', CARD, new Set([3, 18, 48, 63]))).toBe(true);
    expect(checkWin('ANY_ROW', CARD, new Set([3, 18, 48]))).toBe(false);
  });

  it('N column needs only 4 draws (FREE at index 12 auto-counts)', () => {
    // N col: 31,32,FREE,33,34 — need 31,32,33,34
    expect(checkWin('ANY_COL', CARD, new Set([31, 32, 33, 34]))).toBe(true);
    expect(checkWin('ANY_COL', CARD, new Set([31, 32, 33]))).toBe(false);
  });

  it('TL diagonal needs only 4 draws (FREE at centre auto-counts)', () => {
    // TL: indices 0,6,12,18,24 → values 1,17,0(FREE),49,65
    expect(checkWin('ANY_DIAG', CARD, new Set([1, 17, 49, 65]))).toBe(true);
    expect(checkWin('ANY_DIAG', CARD, new Set([1, 17, 49]))).toBe(false);
  });

  it('TR diagonal needs only 4 draws (FREE at centre auto-counts)', () => {
    // TR: indices 4,8,12,16,20 → values 61,47,0(FREE),19,5
    expect(checkWin('ANY_DIAG', CARD, new Set([61, 47, 19, 5]))).toBe(true);
  });

  it('FULL_HOUSE fires with 24 draws (24 non-FREE cells)', () => {
    const allNonFree = CARD.filter((n) => n !== 0);
    expect(allNonFree).toHaveLength(24);
    expect(checkWin('FULL_HOUSE', CARD, new Set(allNonFree))).toBe(true);
  });

  it('FULL_HOUSE blocked with only 23 draws', () => {
    const allNonFree = CARD.filter((n) => n !== 0);
    const missing = new Set(allNonFree);
    missing.delete(allNonFree[0] as number);
    expect(checkWin('FULL_HOUSE', CARD, missing)).toBe(false);
  });
});

// ─── False wins ───────────────────────────────────────────────────────────────

describe('false win prevention', () => {
  it('numbers from a different column range do not satisfy the pattern', () => {
    // Replace B-col draws with I-col numbers — pattern should not fire
    // B col row 0 value is 1; if we draw 16 (I) instead, B col row 0 is unmatched
    expect(checkWin('ANY_COL', CARD, new Set([16, 17, 18, 19, 20]))).toBe(true);  // I col
    expect(checkWin('ANY_COL', CARD, new Set([1, 17, 18, 19, 20]))).toBe(false);  // mixed
  });

  it('diagonal indices are not satisfied by row/column draws', () => {
    // Full row 0 does not complete either diagonal (only index 0 overlaps TL diagonal)
    expect(checkWin('ANY_DIAG', CARD, new Set([1, 16, 31, 46, 61]))).toBe(false);
  });

  it('FOUR_CORNERS not satisfied by middle-cell draws', () => {
    expect(checkWin('FOUR_CORNERS', CARD, new Set([18, 32, 48]))).toBe(false);
  });
});
