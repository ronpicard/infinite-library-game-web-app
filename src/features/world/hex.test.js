import { describe, expect, it } from 'vitest';
import {
  DIRECTION_NAMES,
  DIRECTIONS,
  HEX_RADIUS,
  axialToWorld,
  dirBetween,
  dirUnitVector,
  neighbor,
  oppositeDir,
  roomKey,
  worldToAxial,
} from './hex.js';

describe('hex grid constants', () => {
  it('defines six opposite axial directions', () => {
    expect(DIRECTIONS).toHaveLength(6);
    expect(DIRECTION_NAMES).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(oppositeDir(oppositeDir(i))).toBe(i);
      const n = neighbor(0, 0, i);
      const back = neighbor(n.q, n.r, oppositeDir(i));
      expect(back).toEqual({ q: 0, r: 0 });
    }
  });
});

describe('neighbor and dirBetween', () => {
  it('moves (0,0) east to (1,0)', () => {
    expect(neighbor(0, 0, 0)).toEqual({ q: 1, r: 0 });
  });

  it('returns the direction between adjacent rooms', () => {
    const n = neighbor(2, -3, 4);
    expect(dirBetween(2, -3, n.q, n.r)).toBe(4);
  });

  it('returns -1 for non-adjacent rooms', () => {
    expect(dirBetween(0, 0, 2, 0)).toBe(-1);
  });
});

describe('roomKey', () => {
  it('joins axial coordinates', () => {
    expect(roomKey(-4, 11)).toBe('-4,11');
  });
});

describe('axial and world conversion', () => {
  it('round-trips integer axial coordinates through world space', () => {
    for (let q = -8; q <= 8; q++) {
      for (let r = -8; r <= 8; r++) {
        const w = axialToWorld(q, r);
        const got = worldToAxial(w.x, w.z);
        expect(got.q === q && got.r === r).toBe(true);
      }
    }
  });

  it('places origin at world origin', () => {
    expect(axialToWorld(0, 0)).toEqual({ x: 0, z: 0 });
  });

  it('places neighbor 0 at 1.5 * HEX_RADIUS on x', () => {
    expect(axialToWorld(1, 0).x).toBeCloseTo(HEX_RADIUS * 1.5);
  });
});

describe('dirUnitVector', () => {
  it('returns a unit-length x/z vector for every direction', () => {
    for (let i = 0; i < 6; i++) {
      const v = dirUnitVector(i);
      expect(Math.hypot(v.x, v.z)).toBeCloseTo(1);
    }
  });
});
