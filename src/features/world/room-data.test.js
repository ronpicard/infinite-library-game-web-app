import { describe, expect, it } from 'vitest';
import { neighbor, oppositeDir } from './hex.js';
import { getRoomData, isDoorOpen, openDoors } from './room-data.js';

describe('isDoorOpen', () => {
  it('opens only directions 0 and 3 from the origin', () => {
    expect(openDoors(0, 0)).toEqual([0, 3]);
  });

  it('is symmetric across every sampled edge', () => {
    for (let q = -20; q <= 20; q += 3) {
      for (let r = -20; r <= 20; r += 3) {
        for (let d = 0; d < 6; d++) {
          const n = neighbor(q, r, d);
          expect(isDoorOpen(q, r, d)).toBe(isDoorOpen(n.q, n.r, oppositeDir(d)));
        }
      }
    }
  });
});

describe('getRoomData', () => {
  it('is a pure function of room coordinates', () => {
    const a = getRoomData(4, -2);
    const b = getRoomData(4, -2);
    expect(a.seed).toBe(b.seed);
    expect(a.bookCount).toBe(b.bookCount);
    expect(a.rows).toBe(b.rows);
    expect(a.perRow).toBe(b.perRow);
    expect([...a.coherent.keys()]).toEqual([...b.coherent.keys()]);
    expect([...a.missing]).toEqual([...b.missing]);
    expect([...a.flat]).toEqual([...b.flat]);
  });

  it('partitions walls into doors and shelves', () => {
    const room = getRoomData(3, 5);
    const all = [...room.doors, ...room.shelfWalls].sort((a, b) => a - b);
    expect(all).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(room.doors).size).toBe(room.doors.length);
  });

  it('sizes bookCount from shelves, rows, and volumes per row', () => {
    const room = getRoomData(-1, 2);
    expect(room.bookCount).toBe(room.shelfWalls.length * room.rows * room.perRow);
    expect(room.rows).toBeGreaterThanOrEqual(3);
    expect(room.rows).toBeLessThanOrEqual(5);
    expect(room.perRow).toBeGreaterThanOrEqual(20);
    expect(room.perRow).toBeLessThanOrEqual(27);
  });

  it('never marks the same volume missing, flat, and coherent', () => {
    const room = getRoomData(7, -4);
    for (const idx of room.coherent.keys()) {
      expect(room.missing.has(idx)).toBe(false);
      expect(room.flat.has(idx)).toBe(false);
    }
    for (const idx of room.missing) expect(room.flat.has(idx)).toBe(false);
  });

  it('places an intro letter and a clue on the origin shelves', () => {
    const origin = getRoomData(0, 0);
    const kinds = [...origin.coherent.values()].map((v) => v.kind);
    expect(kinds).toContain('intro');
    expect(kinds).toContain('clue');
    expect(origin.coherent.size).toBeGreaterThanOrEqual(2);
  });

  it('places at least a clue in a typical gallery', () => {
    const room = getRoomData(2, 1);
    const kinds = [...room.coherent.values()].map((v) => v.kind);
    expect(kinds).toContain('clue');
    expect(kinds).not.toContain('intro');
  });
});
