import { describe, it, expect } from 'vitest';
import {
  generateCard,
  validateCard,
  checkWin,
  checkAllPatterns,
  FREE_CELL_INDEX,
  type WinPattern,
} from '../../src/modules/bingo/cards/card.service';

// Grid layout: index = row * 5 + col
// col:  B   I   N   G   O
// row0: 0   1   2   3   4
// row1: 5   6   7   8   9
// row2: 10  11  12  13  14  ← 12 is FREE
// row3: 15  16  17  18  19
// row4: 20  21  22  23  24

const COL_RANGES = [
  { min: 1,  max: 15 },   // B
  { min: 16, max: 30 },   // I
  { min: 31, max: 45 },   // N
  { min: 46, max: 60 },   // G
  { min: 61, max: 75 },   // O
];

// Deterministic test card — every number is the column minimum so the positions
// are predictable for pattern tests.
//   B col: rows 0-4 → indices  0, 5,10,15,20 → values  1, 2, 3, 4, 5
//   I col: rows 0-4 → indices  1, 6,11,16,21 → values 16,17,18,19,20
//   N col: rows 0-4 → indices  2, 7,12,17,22 → values  0(FREE), 31,32,33 (4 vals, skip FREE)
//   G col: rows 0-4 → indices  3, 8,13,18,23 → values 46,47,48,49,50
//   O col: rows 0-4 → indices  4, 9,14,19,24 → values 61,62,63,64,65
//
// Resulting flat array (row-major):
//  idx:  0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24
const CARD = [
   1,  16,  31,  46,  61,  // row 0
   2,  17,  32,  47,  62,  // row 1
   3,  18,   0,  48,  63,  // row 2  ← index 12 = FREE
   4,  19,  33,  49,  64,  // row 3
   5,  20,  34,  50,  65,  // row 4
];
// Sanity check the test card itself
if (CARD[FREE_CELL_INDEX] !== 0) throw new Error('Test card FREE cell misconfigured');

// ─── generateCard ─────────────────────────────────────────────────────────────

describe('generateCard()', () => {
  it('produces exactly 25 numbers', () => {
    expect(generateCard()).toHaveLength(25);
  });

  it('centre cell (index 12) is always FREE (0)', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateCard()[FREE_CELL_INDEX]).toBe(0);
    }
  });

  it('each column contains numbers in the correct range', () => {
    const card = generateCard();
    for (let col = 0; col < 5; col++) {
      const { min, max } = COL_RANGES[col]!;
      for (let row = 0; row < 5; row++) {
        const idx = row * 5 + col;
        if (idx === FREE_CELL_INDEX) continue;
        const n = card[idx] as number;
        expect(n, `col ${col} row ${row} idx ${idx}`).toBeGreaterThanOrEqual(min);
        expect(n, `col ${col} row ${row} idx ${idx}`).toBeLessThanOrEqual(max);
      }
    }
  });

  it('numbers within each column are unique', () => {
    const card = generateCard();
    for (let col = 0; col < 5; col++) {
      const nums = [0, 1, 2, 3, 4]
        .map((row) => row * 5 + col)
        .filter((idx) => idx !== FREE_CELL_INDEX)
        .map((idx) => card[idx] as number);
      expect(new Set(nums).size).toBe(nums.length);
    }
  });

  it('no number appears in more than one column', () => {
    const card = generateCard();
    const all = card.filter((n) => n !== 0);
    expect(new Set(all).size).toBe(all.length);
  });

  it('B column numbers are 1–15', () => {
    for (let i = 0; i < 30; i++) {
      const card = generateCard();
      for (let row = 0; row < 5; row++) {
        const n = card[row * 5 + 0] as number;
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(15);
      }
    }
  });

  it('O column numbers are 61–75', () => {
    for (let i = 0; i < 30; i++) {
      const card = generateCard();
      for (let row = 0; row < 5; row++) {
        const n = card[row * 5 + 4] as number;
        expect(n).toBeGreaterThanOrEqual(61);
        expect(n).toBeLessThanOrEqual(75);
      }
    }
  });

  it('produces different cards on successive calls', () => {
    const cards = Array.from({ length: 30 }, generateCard);
    const unique = new Set(cards.map((c) => c.join(',')));
    expect(unique.size).toBeGreaterThan(1);
  });
});

// ─── validateCard ─────────────────────────────────────────────────────────────

describe('validateCard()', () => {
  it('accepts a valid generated card', () => {
    expect(validateCard(generateCard())).toBe(true);
  });

  it('accepts the deterministic test card', () => {
    expect(validateCard(CARD)).toBe(true);
  });

  it('rejects wrong length (24)', () => {
    expect(validateCard(new Array(24).fill(1))).toBe(false);
  });

  it('rejects wrong length (26)', () => {
    expect(validateCard(new Array(26).fill(1))).toBe(false);
  });

  it('rejects non-zero FREE cell', () => {
    const bad = [...CARD];
    bad[FREE_CELL_INDEX] = 5;
    expect(validateCard(bad)).toBe(false);
  });

  it('rejects number out of B column range (value 16 in B col)', () => {
    const bad = [...CARD];
    bad[0] = 16; // B column must be 1–15
    expect(validateCard(bad)).toBe(false);
  });

  it('rejects number out of O column range (value 60 in O col)', () => {
    const bad = [...CARD];
    bad[4] = 60; // O column must be 61–75
    expect(validateCard(bad)).toBe(false);
  });

  it('rejects duplicate in B column', () => {
    const bad = [...CARD];
    bad[5] = bad[0] as number; // both row0 and row1 of B = 1
    expect(validateCard(bad)).toBe(false);
  });

  it('rejects duplicate in O column', () => {
    const bad = [...CARD];
    bad[24] = bad[4] as number;
    expect(validateCard(bad)).toBe(false);
  });
});

// ─── checkWin — ALL_ROW ───────────────────────────────────────────────────────

describe('checkWin() ANY_ROW', () => {
  it('row 0: fires when all non-FREE cells in row are drawn', () => {
    // row 0: indices 0,1,2,3,4 → values 1,16,31,46,61 (all non-zero)
    expect(checkWin('ANY_ROW', CARD, new Set([1, 16, 31, 46, 61]))).toBe(true);
  });

  it('row 1: fires', () => {
    // row 1: values 2,17,32,47,62
    expect(checkWin('ANY_ROW', CARD, new Set([2, 17, 32, 47, 62]))).toBe(true);
  });

  it('row 2: fires with only 4 draws (FREE centre counts)', () => {
    // row 2: indices 10,11,12,13,14 → values 3,18,0,48,63; FREE at 12 auto-counts
    expect(checkWin('ANY_ROW', CARD, new Set([3, 18, 48, 63]))).toBe(true);
  });

  it('row 2: does NOT fire with 3 non-FREE draws', () => {
    expect(checkWin('ANY_ROW', CARD, new Set([3, 18, 48]))).toBe(false);
  });

  it('row 3: fires', () => {
    expect(checkWin('ANY_ROW', CARD, new Set([4, 19, 33, 49, 64]))).toBe(true);
  });

  it('row 4: fires', () => {
    expect(checkWin('ANY_ROW', CARD, new Set([5, 20, 34, 50, 65]))).toBe(true);
  });

  it('does NOT fire when one cell in a row is missing', () => {
    expect(checkWin('ANY_ROW', CARD, new Set([1, 16, 31, 46]))).toBe(false);
  });

  it('does NOT fire on empty drawn set', () => {
    expect(checkWin('ANY_ROW', CARD, new Set())).toBe(false);
  });
});

// ─── checkWin — ANY_COL ───────────────────────────────────────────────────────

describe('checkWin() ANY_COL', () => {
  it('B column: fires', () => {
    // B col: indices 0,5,10,15,20 → values 1,2,3,4,5
    expect(checkWin('ANY_COL', CARD, new Set([1, 2, 3, 4, 5]))).toBe(true);
  });

  it('I column: fires', () => {
    expect(checkWin('ANY_COL', CARD, new Set([16, 17, 18, 19, 20]))).toBe(true);
  });

  it('N column: fires with 4 draws (FREE counts)', () => {
    // N col: indices 2,7,12,17,22 → values 31,32,0,33,34; FREE at 12 auto-counts
    expect(checkWin('ANY_COL', CARD, new Set([31, 32, 33, 34]))).toBe(true);
  });

  it('N column: does NOT fire with 3 non-FREE draws', () => {
    expect(checkWin('ANY_COL', CARD, new Set([31, 32, 33]))).toBe(false);
  });

  it('G column: fires', () => {
    expect(checkWin('ANY_COL', CARD, new Set([46, 47, 48, 49, 50]))).toBe(true);
  });

  it('O column: fires', () => {
    expect(checkWin('ANY_COL', CARD, new Set([61, 62, 63, 64, 65]))).toBe(true);
  });

  it('does NOT fire when one cell missing', () => {
    expect(checkWin('ANY_COL', CARD, new Set([1, 2, 3, 4]))).toBe(false);
  });
});

// ─── checkWin — ANY_DIAG ──────────────────────────────────────────────────────

describe('checkWin() ANY_DIAG', () => {
  it('TL→BR diagonal fires: indices [0,6,12,18,24]', () => {
    // values: 1, 17, 0(FREE), 49, 65
    expect(checkWin('ANY_DIAG', CARD, new Set([1, 17, 49, 65]))).toBe(true);
  });

  it('TR→BL diagonal fires: indices [4,8,12,16,20]', () => {
    // values: 61, 47, 0(FREE), 19, 5
    expect(checkWin('ANY_DIAG', CARD, new Set([61, 47, 19, 5]))).toBe(true);
  });

  it('does NOT fire when one diagonal cell missing', () => {
    expect(checkWin('ANY_DIAG', CARD, new Set([1, 17, 49]))).toBe(false);
  });

  it('does NOT fire with wrong cells (non-diagonal)', () => {
    // Row 0 fully drawn — not a diagonal win
    expect(checkWin('ANY_DIAG', CARD, new Set([1, 16, 31, 46, 61]))).toBe(false);
  });
});

// ─── checkWin — FOUR_CORNERS ──────────────────────────────────────────────────

describe('checkWin() FOUR_CORNERS', () => {
  it('fires when all 4 corners are drawn: indices [0,4,20,24]', () => {
    // corners: 1, 61, 5, 65
    expect(checkWin('FOUR_CORNERS', CARD, new Set([1, 61, 5, 65]))).toBe(true);
  });

  it('does NOT fire with only 3 corners', () => {
    expect(checkWin('FOUR_CORNERS', CARD, new Set([1, 61, 5]))).toBe(false);
  });

  it('does NOT fire with 4 non-corner cells', () => {
    expect(checkWin('FOUR_CORNERS', CARD, new Set([2, 17, 32, 47]))).toBe(false);
  });
});

// ─── checkWin — FULL_HOUSE ────────────────────────────────────────────────────

describe('checkWin() FULL_HOUSE', () => {
  it('fires when every non-FREE cell is drawn', () => {
    const all = CARD.filter((n) => n !== 0);
    expect(checkWin('FULL_HOUSE', CARD, new Set(all))).toBe(true);
  });

  it('does NOT fire when one number is missing', () => {
    const all = CARD.filter((n) => n !== 0);
    const missing = new Set(all);
    missing.delete(all[0] as number);
    expect(checkWin('FULL_HOUSE', CARD, missing)).toBe(false);
  });

  it('does NOT fire on an empty draw set', () => {
    expect(checkWin('FULL_HOUSE', CARD, new Set())).toBe(false);
  });
});

// ─── checkAllPatterns ─────────────────────────────────────────────────────────

describe('checkAllPatterns()', () => {
  it('returns empty array when nothing drawn', () => {
    expect(checkAllPatterns(CARD, new Set())).toHaveLength(0);
  });

  it('returns ANY_ROW when row 0 is complete', () => {
    const wins = checkAllPatterns(CARD, new Set([1, 16, 31, 46, 61]));
    expect(wins).toContain('ANY_ROW');
  });

  it('returns ANY_COL when B column complete', () => {
    const wins = checkAllPatterns(CARD, new Set([1, 2, 3, 4, 5]));
    expect(wins).toContain('ANY_COL');
  });

  it('returns both ANY_ROW and ANY_COL when a cell satisfies both', () => {
    // Draw row 0 + B column — both complete
    const drawn = new Set([1, 16, 31, 46, 61,  // row 0
                           2, 3, 4, 5]);         // rest of B col
    const wins = checkAllPatterns(CARD, drawn);
    expect(wins).toContain('ANY_ROW');
    expect(wins).toContain('ANY_COL');
  });

  it('returns FOUR_CORNERS without any row or column complete', () => {
    const wins = checkAllPatterns(CARD, new Set([1, 61, 5, 65]));
    expect(wins).toContain('FOUR_CORNERS');
    expect(wins).not.toContain('ANY_ROW');
    expect(wins).not.toContain('ANY_COL');
  });

  it('returns all 5 patterns when entire card drawn', () => {
    const all = CARD.filter((n) => n !== 0);
    const wins = checkAllPatterns(CARD, new Set(all));
    expect(wins).toContain('ANY_ROW');
    expect(wins).toContain('ANY_COL');
    expect(wins).toContain('ANY_DIAG');
    expect(wins).toContain('FOUR_CORNERS');
    expect(wins).toContain('FULL_HOUSE');
  });
});
