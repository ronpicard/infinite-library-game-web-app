import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../lib/random.js';
import { HEX_INRADIUS } from '../world/hex.js';
import { getRoomData } from '../world/room-data.js';
import { clampCatFloor, createRoomCats, disposeCats } from './library-cats.js';

const RAIL_RADIUS = 1.78;
const CAT_RADIUS = 0.14;

describe('clampCatFloor', () => {
  const room = getRoomData(0, 0);

  it('pushes a cat out of the central void', () => {
    const pos = clampCatFloor(0.01, 0, room);
    expect(Math.hypot(pos.x, pos.z)).toBeGreaterThanOrEqual(RAIL_RADIUS + CAT_RADIUS - 1e-6);
  });

  it('keeps a mid-floor point walkable and finite', () => {
    const pos = clampCatFloor(2.4, 1.2, room);
    expect(Number.isFinite(pos.x)).toBe(true);
    expect(Number.isFinite(pos.z)).toBe(true);
    expect(Math.hypot(pos.x, pos.z)).toBeGreaterThan(RAIL_RADIUS);
    expect(Math.hypot(pos.x, pos.z)).toBeLessThan(HEX_INRADIUS);
  });

  it('pulls a point far outside the hex back onto the floor', () => {
    const pos = clampCatFloor(40, 0, room);
    expect(Math.hypot(pos.x, pos.z)).toBeLessThan(HEX_INRADIUS);
  });

  it('is idempotent on an already-clamped point', () => {
    const once = clampCatFloor(2.1, -0.8, room);
    const twice = clampCatFloor(once.x, once.z, room);
    expect(twice.x).toBeCloseTo(once.x);
    expect(twice.z).toBeCloseTo(once.z);
  });
});

describe('createRoomCats and disposeCats', () => {
  it('skips the Crimson Hexagon', () => {
    const cats = createRoomCats(getRoomData(0, 0), mulberry32(1), { crimson: true });
    expect(cats).toEqual([]);
  });

  it('spawns one or two cats and disposes their unique resources', () => {
    const cats = createRoomCats(getRoomData(0, 0), mulberry32(1));
    expect(cats.length).toBeGreaterThanOrEqual(1);
    expect(cats.length).toBeLessThanOrEqual(2);

    const geos = new Set();
    cats[0].group.traverse((obj) => {
      if (obj.geometry) geos.add(obj.geometry);
    });
    let geoDisposed = 0;
    let matDisposed = 0;
    for (const geo of geos) geo.addEventListener('dispose', () => { geoDisposed += 1; });
    cats[0].mat.addEventListener('dispose', () => { matDisposed += 1; });
    cats[0].noseMat.addEventListener('dispose', () => { matDisposed += 1; });

    disposeCats(cats);
    expect(matDisposed).toBe(2);
    expect(geoDisposed).toBe(geos.size);
  });
});
