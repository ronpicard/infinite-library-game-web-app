// Deterministic room contents. Everything a room is — its doors, its books,
// which books are coherent — derives from its (q, r, FLOOR) coordinates.

import { hashInts, mulberry32 } from '../../lib/random.js';
import { DIRECTIONS, FLOOR, neighbor, oppositeDir } from './hex.js';

export const WORLD_SEED = 0xba8e1;

const DOOR_PROBABILITY = 0.42;

export function roomSeed(q, r) {
  return hashInts(WORLD_SEED, q, r, FLOOR);
}

/**
 * A wall between two rooms is open iff a symmetric hash of the edge says so.
 * The origin room is special-cased so the game always starts with two doors.
 */
export function isDoorOpen(q, r, dirIndex) {
  const n = neighbor(q, r, dirIndex);
  if (q === 0 && r === 0) return dirIndex === 0 || dirIndex === 3;
  if (n.q === 0 && n.r === 0) {
    const fromOrigin = oppositeDir(dirIndex);
    return fromOrigin === 0 || fromOrigin === 3;
  }
  // Canonical edge key: order the two rooms so both sides hash identically.
  const first = q < n.q || (q === n.q && r < n.r);
  const [aq, ar, bq, br] = first ? [q, r, n.q, n.r] : [n.q, n.r, q, r];
  const h = hashInts(WORLD_SEED ^ 0xd00e, aq, ar, hashInts(bq, br, FLOOR));
  return h / 4294967296 < DOOR_PROBABILITY;
}

export function openDoors(q, r) {
  const doors = [];
  for (let i = 0; i < DIRECTIONS.length; i++) {
    if (isDoorOpen(q, r, i)) doors.push(i);
  }
  return doors;
}

/**
 * Full deterministic description of a room used by the renderer and by the
 * book system. Cheap enough to recompute on demand.
 */
export function getRoomData(q, r) {
  const seed = roomSeed(q, r);
  const rng = mulberry32(seed);
  const doors = openDoors(q, r);
  const shelfWalls = [];
  for (let i = 0; i < 6; i++) {
    if (!doors.includes(i)) shelfWalls.push(i);
  }

  // Shelf layout varies per room: 3-5 rows, 20-27 volumes per row, with
  // deterministic gaps and the occasional volume left lying flat.
  const rows = 3 + Math.floor(rng() * 3);
  const perRow = 20 + Math.floor(rng() * 8);
  const bookCount = shelfWalls.length * rows * perRow;

  const missing = new Set();
  const flat = new Set();
  for (let i = 0; i < bookCount; i++) {
    const roll = rng();
    if (roll < 0.045) missing.add(i);
    else if (roll < 0.075) flat.add(i);
  }

  const pickPresent = () => {
    let idx = Math.floor(rng() * bookCount);
    while (missing.has(idx) || flat.has(idx)) idx = (idx + 1) % bookCount;
    return idx;
  };

  // Coherent books: exactly one clue book per room (the quest must be
  // completable from anywhere), plus 0-2 aphorism books. Rare against
  // ~250-450 gibberish volumes.
  const coherent = new Map();
  if (bookCount > 0) {
    coherent.set(pickPresent(), { kind: 'clue' });
    const aphorismCount = rng() < 0.7 ? 1 : rng() < 0.5 ? 2 : 0;
    for (let i = 0; i < aphorismCount; i++) {
      const idx = pickPresent();
      if (!coherent.has(idx)) {
        coherent.set(idx, { kind: 'aphorism', variant: hashInts(seed, 7, idx) });
      }
    }
    // The origin room always carries the letter that sets the goal.
    if (q === 0 && r === 0) {
      let idx = pickPresent();
      while (coherent.has(idx) || missing.has(idx) || flat.has(idx)) {
        idx = (idx + 1) % bookCount;
      }
      coherent.set(idx, { kind: 'intro' });
    }
  }

  return {
    q,
    r,
    seed,
    doors,
    shelfWalls,
    rows,
    perRow,
    bookCount,
    missing,
    flat,
    coherent,
    lampJitter: 0.85 + rng() * 0.3,
    // Small per-room drift so no two galleries share an exact palette.
    hueJitter: (rng() - 0.5) * 0.05,
    lightJitter: (rng() - 0.5) * 0.04,
    flickerSpeed: 0.7 + rng() * 1.1,
    dustCount: 80 + Math.floor(rng() * 80),
  };
}
