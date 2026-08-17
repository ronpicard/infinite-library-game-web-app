import { describe, expect, it } from 'vitest';
import { HEX_INRADIUS } from '../world/hex.js';
import { dirUnitVector } from '../world/hex.js';
import { getRoomData } from '../world/room-data.js';
import {
  DOOR_PASS_HALF,
  DOOR_WALL_INSET,
  RAIL_RADIUS,
  SHELF_WALL_INSET,
  clampHexFloor,
} from './floor-clamp.js';

const PLAYER_RADIUS = 0.32;

function clampPlayer(x, z, doors) {
  return clampHexFloor(x, z, { doors, radius: PLAYER_RADIUS, coreRadius: RAIL_RADIUS });
}

describe('clampHexFloor doorways', () => {
  const origin = getRoomData(0, 0);

  it('lets the player stand in the origin doorway without catching a wall', () => {
    const n = dirUnitVector(0);
    const along = HEX_INRADIUS - 0.12;
    const pos = clampPlayer(n.x * along, n.z * along, origin.doors);
    const got = pos.x * n.x + pos.z * n.z;
    expect(got).toBeGreaterThan(HEX_INRADIUS - DOOR_WALL_INSET - PLAYER_RADIUS);
    expect(Math.abs(pos.x * -n.z + pos.z * n.x)).toBeLessThan(DOOR_PASS_HALF - PLAYER_RADIUS);
  });

  it('slides around a jamb instead of snapping back into the room', () => {
    const n = dirUnitVector(0);
    const t = { x: -n.z, z: n.x };
    const along = HEX_INRADIUS - DOOR_WALL_INSET + 0.04;
    const lat = DOOR_PASS_HALF - 0.05;
    const pos = clampPlayer(n.x * along + t.x * lat, n.z * along + t.z * lat, origin.doors);
    const gotAlong = pos.x * n.x + pos.z * n.z;
    expect(gotAlong).toBeGreaterThan(HEX_INRADIUS - SHELF_WALL_INSET);
    expect(Number.isFinite(pos.x)).toBe(true);
  });

  it('still stops the player at a shelved wall', () => {
    const n = dirUnitVector(1);
    const pos = clampPlayer(n.x * HEX_INRADIUS, n.z * HEX_INRADIUS, origin.doors);
    const got = pos.x * n.x + pos.z * n.z;
    expect(got).toBeLessThanOrEqual(HEX_INRADIUS - SHELF_WALL_INSET - PLAYER_RADIUS + 1e-6);
  });
});
