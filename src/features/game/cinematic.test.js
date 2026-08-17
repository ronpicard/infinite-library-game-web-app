import { describe, expect, it } from 'vitest';
import {
  CRIMSON_LOCK,
  CRIMSON_REVEAL,
  CRIMSON_TOTAL,
  cinematicOwnsAmbientLights,
  crimsonCameraSway,
  crimsonEmberIntensity,
  crimsonFogDensity,
  crimsonLightMultiplier,
  crimsonRevealT,
  crimsonRoomScale,
  crimsonRuneSpin,
  crimsonShouldTransform,
  crimsonTransitionU,
  isLookFrozen,
} from './cinematic.js';

describe('isLookFrozen', () => {
  it('freezes look while paused', () => {
    expect(isLookFrozen(true, null)).toBe(true);
  });

  it('freezes look during the crimson arrival', () => {
    expect(isLookFrozen(false, { key: '1,0' })).toBe(true);
  });

  it('allows look while walking', () => {
    expect(isLookFrozen(false, null)).toBe(false);
    expect(isLookFrozen(false, undefined)).toBe(false);
  });

  it('freezes look when both pause and arrival are set', () => {
    expect(isLookFrozen(true, { key: '0,0' })).toBe(true);
  });
});

describe('cinematicOwnsAmbientLights', () => {
  it('lets the arrival beat own lamps and floor runes', () => {
    expect(cinematicOwnsAmbientLights({ key: '0,0' })).toBe(true);
  });

  it('returns ambient flicker to the room loop afterward', () => {
    expect(cinematicOwnsAmbientLights(null)).toBe(false);
  });
});

describe('crimson arrival easing', () => {
  it('runs for the configured total duration', () => {
    expect(CRIMSON_TOTAL).toBe(CRIMSON_LOCK + CRIMSON_REVEAL);
  });

  it('reveals only after the lock phase', () => {
    expect(crimsonRevealT(CRIMSON_LOCK - 0.01)).toBe(0);
    expect(crimsonRevealT(CRIMSON_LOCK)).toBe(0);
    expect(crimsonRevealT(CRIMSON_LOCK + CRIMSON_REVEAL)).toBe(1);
  });

  it('swaps geometry once at the end of the lock', () => {
    expect(crimsonShouldTransform(CRIMSON_LOCK - 0.01, false)).toBe(false);
    expect(crimsonShouldTransform(CRIMSON_LOCK, false)).toBe(true);
    expect(crimsonShouldTransform(CRIMSON_LOCK, true)).toBe(false);
  });

  it('dims then restores light without oscillating below the lock floor', () => {
    const atLockEnd = crimsonLightMultiplier(CRIMSON_LOCK);
    const atStart = crimsonLightMultiplier(0);
    const atEnd = crimsonLightMultiplier(CRIMSON_TOTAL);
    expect(atStart).toBeCloseTo(1, 5);
    expect(atLockEnd).toBeCloseTo(0.72, 2);
    expect(atEnd).toBeCloseTo(1, 5);
    expect(crimsonLightMultiplier(CRIMSON_LOCK + CRIMSON_REVEAL * 0.5)).toBeGreaterThan(atLockEnd);
  });

  it('eases fog density toward the sealed chamber', () => {
    expect(crimsonFogDensity(0)).toBeCloseTo(0.04, 5);
    expect(crimsonFogDensity(1)).toBeCloseTo(0.028, 5);
  });

  it('settles room scale back to 1', () => {
    expect(crimsonRoomScale(0)).toBe(1);
    expect(crimsonRoomScale(0.01)).toBeGreaterThan(1);
    expect(crimsonRoomScale(1)).toBeCloseTo(1, 5);
  });

  it('ramps ember glow in after the swap', () => {
    expect(crimsonEmberIntensity(0)).toBe(0);
    expect(crimsonEmberIntensity(1)).toBe(32);
  });

  it('ramps rune spin with the reveal', () => {
    const start = crimsonRuneSpin(0, 0.01);
    const end = crimsonRuneSpin(CRIMSON_TOTAL, 1);
    expect(Math.abs(end.outer)).toBeGreaterThan(Math.abs(start.outer));
    expect(Math.abs(end.inner)).toBeGreaterThan(Math.abs(start.inner));
  });

  it('fades camera sway out by the end of the beat', () => {
    const early = crimsonCameraSway(0.4, crimsonTransitionU(0.4));
    const late = crimsonCameraSway(CRIMSON_TOTAL, 1);
    expect(Math.hypot(late.x, late.z)).toBeLessThan(Math.hypot(early.x, early.z));
  });
});
