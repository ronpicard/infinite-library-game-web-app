import { describe, expect, it } from 'vitest';
import { cinematicOwnsAmbientLights, isLookFrozen } from './cinematic.js';

describe('isLookFrozen', () => {
  it('freezes look while paused', () => {
    expect(isLookFrozen(true, null)).toBe(true);
  });

  it('freezes look during the crimson arrival', () => {
    expect(isLookFrozen(false, { key: '1,0' })).toBe(true);
  });

  it('allows look while walking', () => {
    expect(isLookFrozen(false, null)).toBe(false);
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
