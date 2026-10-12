import { randomInt } from 'crypto';

/**
 * 75-ball bingo card layout:
 *   B: 1–15  I: 16–30  N: 31–45 (FREE centre)  G: 46–60  O: 61–75
 * Stored as a flat 25-element array (row-major, index 12 = FREE = 0).
 */

const COLUMNS = [
  { min: 1, max: 15 },   // B
  { min: 16, max: 30 },  // I
  { min: 31, max: 45 },  // N
  { min: 46, max: 60 },  // G
  { min: 61, max: 75 },  // O
] as const;

export const FREE_CELL_INDEX = 12; // row 2, col 2 (N column)

function pickUnique(min: number, max: number, count: number): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = randomInt(pool.length - i) + i;
    [pool[i], pool[idx]] = [pool[idx] as number, pool[i] as number];
    result.push(pool[i] as number);
  }
  return result;
}

export function generateCard(): number[] {
  const card = new Array<number>(25).fill(0);
  for (let col = 0; col < 5; col++) {
    const { min, max } = COLUMNS[col]!;
    const needed = col === 2 ? 4 : 5; // N column has FREE centre
    const nums = pickUnique(min, max, needed);
    let numIdx = 0;
    for (let row = 0; row < 5; row++) {
      const pos = row * 5 + col;
      if (pos === FREE_CELL_INDEX) {
        card[pos] = 0; // FREE
      } else {
        card[pos] = nums[numIdx++] as number;
      }
    }
  }
  return card;
}

export function validateCard(numbers: number[]): boolean {
  if (numbers.length !== 25) return false;
  if (numbers[FREE_CELL_INDEX] !== 0) return false;
  for (let col = 0; col < 5; col++) {
    const { min, max } = COLUMNS[col]!;
    const colNums = new Set<number>();
    for (let row = 0; row < 5; row++) {
      const pos = row * 5 + col;
      if (pos === FREE_CELL_INDEX) continue;
      const n = numbers[pos] as number;
      if (n < min || n > max) return false;
      if (colNums.has(n)) return false;
      colNums.add(n);
    }
  }
  return true;
}

export type WinPattern = 'ANY_ROW' | 'ANY_COL' | 'ANY_DIAG' | 'FULL_HOUSE' | 'FOUR_CORNERS';

const PATTERNS: Record<WinPattern, number[][]> = {
  ANY_ROW: [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
  ],
  ANY_COL: [
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
  ],
  ANY_DIAG: [
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ],
  FULL_HOUSE: [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  ],
  FOUR_CORNERS: [[0, 4, 20, 24]],
};

export function checkWin(
  pattern: WinPattern,
  cardNumbers: number[],
  drawnNumbers: Set<number>,
): boolean {
  const lines = PATTERNS[pattern];
  return lines.some((line) =>
    line.every((idx) => {
      const n = cardNumbers[idx] as number;
      return n === 0 || drawnNumbers.has(n); // FREE cells always count
    }),
  );
}

export function checkAllPatterns(
  cardNumbers: number[],
  drawnNumbers: Set<number>,
): WinPattern[] {
  return (Object.keys(PATTERNS) as WinPattern[]).filter((p) =>
    checkWin(p, cardNumbers, drawnNumbers),
  );
}
