// Shared floor collision for the player and cats. Doorways use a wide gap
// plus rounded jambs so you slide through instead of catching on the posts.

import { HEX_INRADIUS, HEX_RADIUS, dirUnitVector } from '../world/hex.js';

export const RAIL_RADIUS = 1.78;
export const COLUMN_RADIUS = 0.3;
export const COLUMN_RING_RADIUS = HEX_RADIUS - 0.62;

/** Visual hole in the wall, center to jamb. */
export const DOOR_HALF_WIDTH = 1.18;
/** Clear half-width at the inner face of the posts (collision + cats). */
export const DOOR_PASS_HALF = 1.06;
/** Door side-wall inset from the hex edge; keeps the camera off the mesh. */
export const DOOR_WALL_INSET = 0.38;
export const SHELF_WALL_INSET = 0.95;
/** Soft radius at each post so the opening is a rounded slot, not a sharp L. */
export const DOOR_JAMB_RADIUS = 0.18;

function applyWallAxes(n, along, lateral) {
  return {
    x: n.x * along - n.z * lateral,
    z: n.z * along + n.x * lateral,
  };
}

/**
 * Keep a disk of `radius` on walkable floor: outside the void, inside walls,
 * through rounded doorways, around columns.
 */
export function clampHexFloor(relX, relZ, { doors, radius, coreRadius }) {
  let x = relX;
  let z = relZ;

  const coreR = coreRadius + radius;
  const centerDist = Math.hypot(x, z);
  if (centerDist < coreR && centerDist > 1e-4) {
    const push = coreR / centerDist;
    x *= push;
    z *= push;
  }

  const doorSet = doors;
  for (let d = 0; d < 6; d++) {
    const n = dirUnitVector(d);
    let along = x * n.x + z * n.z;
    let lateral = x * -n.z + z * n.x;
    const isDoor = doorSet.includes(d);

    if (isDoor) {
      const jambAlong = HEX_INRADIUS - DOOR_WALL_INSET;
      const jambLat = DOOR_PASS_HALF;
      const jR = radius + DOOR_JAMB_RADIUS;
      const absLat = Math.abs(lateral);
      const sign = lateral < 0 ? -1 : 1;
      const da = along - jambAlong;
      const dl = absLat - jambLat;
      const jdist = Math.hypot(da, dl);
      if (jdist < jR && jdist > 1e-4) {
        const s = jR / jdist;
        along = jambAlong + da * s;
        lateral = sign * (jambLat + dl * s);
      }

      const gap = DOOR_PASS_HALF - radius;
      if (Math.abs(lateral) > gap) {
        const limit = HEX_INRADIUS - DOOR_WALL_INSET - radius;
        if (along > limit) along = limit;
      }
    } else {
      const limit = HEX_INRADIUS - SHELF_WALL_INSET - radius;
      if (along > limit) along = limit;
    }

    const p = applyWallAxes(n, along, lateral);
    x = p.x;
    z = p.z;
  }

  const colR = COLUMN_RADIUS + radius;
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    const cx = Math.cos(a) * COLUMN_RING_RADIUS;
    const cz = Math.sin(a) * COLUMN_RING_RADIUS;
    const dx = x - cx;
    const dz = z - cz;
    const dist = Math.hypot(dx, dz);
    if (dist < colR && dist > 1e-4) {
      x = cx + (dx / dist) * colR;
      z = cz + (dz / dist) * colR;
    }
  }

  return { x, z };
}
