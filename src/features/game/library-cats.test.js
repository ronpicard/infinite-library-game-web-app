import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../lib/random.js';
import { HEX_INRADIUS } from '../world/hex.js';
import { getRoomData } from '../world/room-data.js';
import { RAIL_RADIUS } from './floor-clamp.js';
import { clampCatFloor, createRoomCats, disposeCats, updateRoomCats } from './library-cats.js';

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

  it('spawns the same count for the same seed', () => {
    const room = getRoomData(0, 0);
    const a = createRoomCats(room, mulberry32(99));
    const b = createRoomCats(room, mulberry32(99));
    expect(a).toHaveLength(b.length);
    expect(a[0].colorIdx).toBe(b[0].colorIdx);
  });
});

describe('updateRoomCats', () => {
  it('fires onMeow once when a cat is already meowing', () => {
    const room = getRoomData(0, 0);
    const cats = createRoomCats(room, mulberry32(1));
    const cat = cats[0];
    cat.state = 'meow';
    cat.stateTimer = 0.4;
    cat.meowed = false;
    let meows = 0;
    updateRoomCats(cats, 0.016, 0, room, () => {
      meows += 1;
    });
    updateRoomCats(cats, 0.016, 0.016, room, () => {
      meows += 1;
    });
    expect(meows).toBe(1);
  });

  it('advances a walking cat toward its target', () => {
    const room = getRoomData(0, 0);
    const cats = createRoomCats(room, mulberry32(1));
    const cat = cats[0];
    cat.state = 'walk';
    cat.stateTimer = 8;
    cat.x = 2.2;
    cat.z = 0.4;
    cat.target = { x: 3.2, z: 0.4 };
    const startX = cat.x;
    updateRoomCats(cats, 0.2, 1, room);
    expect(cat.x).toBeGreaterThan(startX);
  });
});
