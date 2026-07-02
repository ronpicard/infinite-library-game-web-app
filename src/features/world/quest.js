// The search for the Crimson Hexagon.
//
// From any room, a deterministic function picks the "next step" among that
// room's OPEN doors, so the five-step path a clue book describes is always
// walkable. Follow five steps in a row and the room you arrive in becomes
// the Crimson Hexagon. A wrong step dissolves the path; the clue book of
// whatever room you stand in always describes the fresh path from there.

import { hashInts } from '../../lib/random.js';
import { DIRECTION_NAMES, neighbor, oppositeDir } from './hex.js';
import { openDoors, WORLD_SEED } from './room-data.js';

export const PATH_LENGTH = 5;
const STEP_SALT = 0xc1ce;

/**
 * The prescribed direction for step `stepIndex` of a chain passing through
 * room (q, r). `entryDir` is how the chain entered this room (null at the
 * start); we avoid sending the seeker straight back where it came from
 * unless the room is a dead end.
 */
export function stepDirection(q, r, stepIndex, entryDir) {
  const doors = openDoors(q, r);
  if (doors.length === 0) return -1; // sealed room; unreachable in practice
  let candidates = doors;
  if (entryDir !== null) {
    const back = oppositeDir(entryDir);
    const filtered = doors.filter((d) => d !== back);
    if (filtered.length > 0) candidates = filtered;
  }
  const h = hashInts(WORLD_SEED ^ STEP_SALT, hashInts(q, r), stepIndex);
  return candidates[h % candidates.length];
}

/** The full five-step path beginning at (q, r), as direction indices. */
export function computePath(q, r) {
  const dirs = [];
  let cur = { q, r };
  let entry = null;
  for (let k = 0; k < PATH_LENGTH; k++) {
    const d = stepDirection(cur.q, cur.r, k, entry);
    if (d < 0) break;
    dirs.push(d);
    cur = neighbor(cur.q, cur.r, d);
    entry = d;
  }
  return dirs;
}

export function pathDirectionNames(q, r) {
  return computePath(q, r).map((d) => DIRECTION_NAMES[d]);
}

export function createQuestState(startQ, startR) {
  return {
    progress: 0,
    expectedDir: stepDirection(startQ, startR, 0, null),
    complete: false,
  };
}

/**
 * Advance the quest after the player moves in direction `moveDir` and
 * arrives in room (q, r). Returns an event describing what happened.
 */
export function advanceQuest(state, moveDir, q, r) {
  if (state.complete) return { type: 'none' };
  if (moveDir === state.expectedDir) {
    state.progress += 1;
    if (state.progress >= PATH_LENGTH) {
      state.complete = true;
      return { type: 'arrived' };
    }
    state.expectedDir = stepDirection(q, r, state.progress, moveDir);
    return { type: 'advanced', progress: state.progress };
  }
  const hadProgress = state.progress > 0;
  state.progress = 0;
  state.expectedDir = stepDirection(q, r, 0, null);
  return hadProgress ? { type: 'lost' } : { type: 'none' };
}
