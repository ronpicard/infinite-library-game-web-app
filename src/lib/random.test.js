import { describe, expect, it } from 'vitest';
import { hashInts, mulberry32, pickHashed } from './random.js';

describe('hashInts', () => {
  it('returns the same uint32 for the same inputs', () => {
    expect(hashInts(1, 2, 3, 4)).toBe(hashInts(1, 2, 3, 4));
  });

  it('changes when any argument changes', () => {
    const base = hashInts(7, 8, 9, 10);
    expect(hashInts(8, 8, 9, 10)).not.toBe(base);
    expect(hashInts(7, 9, 9, 10)).not.toBe(base);
    expect(hashInts(7, 8, 10, 10)).not.toBe(base);
    expect(hashInts(7, 8, 9, 11)).not.toBe(base);
  });

  it('treats omitted trailing args as zero', () => {
    expect(hashInts(5)).toBe(hashInts(5, 0, 0, 0));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = hashInts(-3, 99, 0xba8e1, 1);
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe('mulberry32', () => {
  it('yields the same sequence for the same seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 16; i++) expect(a()).toBe(b());
  });

  it('yields values in [0, 1)', () => {
    const rng = mulberry32(0xdeadbeef);
    for (let i = 0; i < 64; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('does not collapse to a constant stream', () => {
    const rng = mulberry32(1);
    const values = new Set(Array.from({ length: 20 }, () => rng()));
    expect(values.size).toBeGreaterThan(1);
  });
});

describe('pickHashed', () => {
  it('selects an element using hash modulo length', () => {
    const arr = ['a', 'b', 'c'];
    expect(pickHashed(arr, 0)).toBe('a');
    expect(pickHashed(arr, 1)).toBe('b');
    expect(pickHashed(arr, 5)).toBe('c');
  });
});
