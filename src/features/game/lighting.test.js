import { describe, expect, it } from 'vitest';
import {
  LIGHT_BLEND_SECONDS,
  NEIGHBOR_LIGHT,
  advanceLightBlend,
  follow,
  lampFlickerFactor,
  roomLightWeight,
} from './lighting.js';

describe('roomLightWeight', () => {
  it('crossfades from the previous gallery to the current one', () => {
    expect(roomLightWeight('a', 'b', 'a', 0)).toBeCloseTo(1);
    expect(roomLightWeight('b', 'b', 'a', 0)).toBeCloseTo(NEIGHBOR_LIGHT);
    expect(roomLightWeight('b', 'b', 'a', 1)).toBeCloseTo(1);
    expect(roomLightWeight('a', 'b', 'a', 1)).toBeCloseTo(NEIGHBOR_LIGHT);
    const midB = roomLightWeight('b', 'b', 'a', 0.5);
    expect(midB).toBeGreaterThan(NEIGHBOR_LIGHT);
    expect(midB).toBeLessThan(1);
  });

  it('keeps other neighbors dim', () => {
    expect(roomLightWeight('c', 'b', 'a', 0.5)).toBe(NEIGHBOR_LIGHT);
  });
});

describe('lampFlickerFactor', () => {
  it('stays near 1', () => {
    for (let t = 0; t < 8; t += 0.2) {
      const f = lampFlickerFactor(t, 12, 1);
      expect(f).toBeGreaterThan(0.93);
      expect(f).toBeLessThan(1.07);
    }
  });
});

describe('follow and advanceLightBlend', () => {
  it('approaches the target without overshooting', () => {
    let v = 0;
    for (let i = 0; i < 40; i++) v = follow(v, 10, 0.05, 8);
    expect(v).toBeGreaterThan(9);
    expect(v).toBeLessThanOrEqual(10);
  });

  it('stays put when already at the target or dt is 0', () => {
    expect(follow(4, 4, 0.16, 9)).toBeCloseTo(4);
    expect(follow(1, 8, 0, 9)).toBeCloseTo(1);
  });

  it('fills the blend over the configured duration', () => {
    expect(advanceLightBlend(0, 0.3, 0.6)).toBeCloseTo(0.5);
    expect(advanceLightBlend(0.9, 0.5, 0.6)).toBe(1);
  });

  it('clamps a finished blend and uses the default duration', () => {
    expect(advanceLightBlend(1, 10)).toBe(1);
    expect(advanceLightBlend(0, 0.3)).toBeCloseTo(0.3 / LIGHT_BLEND_SECONDS);
  });
});

describe('roomLightWeight blend clamp', () => {
  it('treats out-of-range blend as the 0/1 endpoints', () => {
    expect(roomLightWeight('b', 'b', 'a', -2)).toBeCloseTo(NEIGHBOR_LIGHT);
    expect(roomLightWeight('b', 'b', 'a', 4)).toBeCloseTo(1);
    expect(roomLightWeight('a', 'b', 'a', -2)).toBeCloseTo(1);
    expect(roomLightWeight('a', 'b', 'a', 4)).toBeCloseTo(NEIGHBOR_LIGHT);
  });
});
