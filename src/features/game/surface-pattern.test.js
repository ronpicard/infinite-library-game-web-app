import { describe, expect, it } from 'vitest';
import { getRoomData } from '../world/room-data.js';
import {
  FLOOR_FAMILIES,
  PATTERN_SIZE,
  WALL_FAMILIES,
  fillPatternPixels,
  makePatternSpec,
  patternShade,
} from './surface-pattern.js';

describe('makePatternSpec', () => {
  it('is a pure function of seed and surface', () => {
    const a = makePatternSpec(0xba8e1, 'floor');
    const b = makePatternSpec(0xba8e1, 'floor');
    expect(a).toEqual(b);
  });

  it('gives floor and wall independent families', () => {
    const floor = makePatternSpec(99, 'floor');
    const wall = makePatternSpec(99, 'wall');
    expect(floor.family).toBeGreaterThanOrEqual(0);
    expect(floor.family).toBeLessThan(FLOOR_FAMILIES);
    expect(wall.family).toBeGreaterThanOrEqual(0);
    expect(wall.family).toBeLessThan(WALL_FAMILIES);
    expect(floor).not.toEqual(wall);
  });

  it('spreads floor families across a patch of galleries', () => {
    const families = new Set();
    for (let q = -6; q <= 6; q++) {
      for (let r = -6; r <= 6; r++) {
        families.add(makePatternSpec(getRoomData(q, r).seed, 'floor').family);
      }
    }
    expect(families.size).toBeGreaterThan(5);
  });
});

describe('patternShade', () => {
  it('stays in (0, 1] for every family', () => {
    for (const surface of ['floor', 'wall']) {
      for (let family = 0; family < 8; family++) {
        const spec = { ...makePatternSpec(family * 17 + 3, surface), family };
        for (let i = 0; i < 12; i++) {
          const s = patternShade(i / 12, (i * 3) / 17, spec);
          expect(s).toBeGreaterThan(0);
          expect(s).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('is deterministic at a UV', () => {
    const spec = makePatternSpec(123, 'floor');
    expect(patternShade(0.31, 0.44, spec)).toBe(patternShade(0.31, 0.44, spec));
  });
});

describe('fillPatternPixels', () => {
  it('writes opaque grayscale unique to the spec', () => {
    const a = new Uint8ClampedArray(PATTERN_SIZE * PATTERN_SIZE * 4);
    const b = new Uint8ClampedArray(a.length);
    fillPatternPixels(a, PATTERN_SIZE, makePatternSpec(1, 'floor'));
    fillPatternPixels(b, PATTERN_SIZE, makePatternSpec(2, 'floor'));
    expect(a[3]).toBe(255);
    expect(a[0]).toBe(a[1]);
    expect(a[0]).toBe(a[2]);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });
});
