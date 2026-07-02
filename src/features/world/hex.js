// Flat-top hexagonal grid math (axial coordinates, Red Blob Games layout).
// World plane is x/z; y is vertical.

export const HEX_RADIUS = 7; // center to vertex
export const HEX_INRADIUS = (HEX_RADIUS * Math.sqrt(3)) / 2; // center to edge
export const ROOM_HEIGHT = 5;
export const FLOOR = 0; // single explorable floor; part of every seed

// Axial neighbor offsets. Index i and (i + 3) % 6 are opposites.
export const DIRECTIONS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

// Poetic compass used by clue books and the HUD, one name per direction.
export const DIRECTION_NAMES = [
  'the rising dust',
  'the burning lamp',
  'the sleeping water',
  'the falling ash',
  'the silent frost',
  'the red wind',
];

export function oppositeDir(i) {
  return (i + 3) % 6;
}

export function neighbor(q, r, dirIndex) {
  const d = DIRECTIONS[dirIndex];
  return { q: q + d.q, r: r + d.r };
}

export function roomKey(q, r) {
  return `${q},${r}`;
}

export function axialToWorld(q, r) {
  return {
    x: HEX_RADIUS * 1.5 * q,
    z: HEX_RADIUS * ((Math.sqrt(3) / 2) * q + Math.sqrt(3) * r),
  };
}

/** Unit x/z vector pointing from a room's center toward neighbor dirIndex. */
export function dirUnitVector(dirIndex) {
  const d = DIRECTIONS[dirIndex];
  const w = axialToWorld(d.q, d.r);
  const len = Math.hypot(w.x, w.z);
  return { x: w.x / len, z: w.z / len };
}

export function worldToAxial(x, z) {
  const qf = ((2 / 3) * x) / HEX_RADIUS;
  const rf = ((-1 / 3) * x + (Math.sqrt(3) / 3) * z) / HEX_RADIUS;
  return cubeRound(qf, rf);
}

function cubeRound(qf, rf) {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  let s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

/** Direction index that moves from room A to adjacent room B, or -1. */
export function dirBetween(aq, ar, bq, br) {
  for (let i = 0; i < 6; i++) {
    const d = DIRECTIONS[i];
    if (aq + d.q === bq && ar + d.r === br) return i;
  }
  return -1;
}
