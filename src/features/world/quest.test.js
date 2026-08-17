import { describe, expect, it } from 'vitest';
import { DIRECTION_NAMES, neighbor, oppositeDir } from './hex.js';
import { isDoorOpen, openDoors } from './room-data.js';
import {
  PATH_LENGTH,
  advanceQuest,
  computePath,
  createQuestState,
  pathDirectionNames,
  stepDirection,
} from './quest.js';

function walkPath(startQ, startR, dirs, state) {
  let cur = { q: startQ, r: startR };
  let last = null;
  for (const d of dirs) {
    cur = neighbor(cur.q, cur.r, d);
    last = advanceQuest(state, d, cur.q, cur.r);
  }
  return { cur, last };
}

describe('computePath', () => {
  it('is five walkable open-door steps from the origin', () => {
    const path = computePath(0, 0);
    expect(path).toHaveLength(PATH_LENGTH);
    let cur = { q: 0, r: 0 };
    for (const d of path) {
      expect(isDoorOpen(cur.q, cur.r, d)).toBe(true);
      cur = neighbor(cur.q, cur.r, d);
    }
  });

  it('is five walkable steps from every sampled open room', () => {
    for (let q = -12; q <= 12; q += 2) {
      for (let r = -12; r <= 12; r += 2) {
        if (openDoors(q, r).length === 0) continue;
        const path = computePath(q, r);
        expect(path).toHaveLength(PATH_LENGTH);
        let cur = { q, r };
        for (const d of path) {
          expect(isDoorOpen(cur.q, cur.r, d)).toBe(true);
          cur = neighbor(cur.q, cur.r, d);
        }
      }
    }
  });

  it('names each step with the poetic compass', () => {
    const names = pathDirectionNames(0, 0);
    expect(names).toEqual(computePath(0, 0).map((d) => DIRECTION_NAMES[d]));
  });
});

describe('createQuestState', () => {
  it('starts at the first step of that room\'s clue path', () => {
    const state = createQuestState(0, 0);
    expect(state.progress).toBe(0);
    expect(state.complete).toBe(false);
    expect(state.expectedDir).toBe(computePath(0, 0)[0]);
    expect(state.expectedDir).toBe(stepDirection(0, 0, 0, null));
  });
});

describe('stepDirection', () => {
  it('returns -1 and an empty path in a sealed room', () => {
    let sealed = null;
    for (let q = -20; q <= 20 && !sealed; q++) {
      for (let r = -20; r <= 20 && !sealed; r++) {
        if (openDoors(q, r).length === 0) sealed = { q, r };
      }
    }
    expect(sealed).not.toBeNull();
    expect(stepDirection(sealed.q, sealed.r, 0, null)).toBe(-1);
    expect(computePath(sealed.q, sealed.r)).toEqual([]);
  });

  it('does not reverse the previous step unless the room is a dead end', () => {
    for (let q = -8; q <= 8; q++) {
      for (let r = -8; r <= 8; r++) {
        const doors = openDoors(q, r);
        if (doors.length < 2) continue;
        for (const entry of doors) {
          expect(stepDirection(q, r, 1, entry)).not.toBe(oppositeDir(entry));
        }
      }
    }
  });
});

describe('advanceQuest', () => {
  it('emits advanced for each of the first four steps, then arrived', () => {
    const state = createQuestState(0, 0);
    const path = computePath(0, 0);
    let cur = { q: 0, r: 0 };
    const types = [];
    for (const d of path) {
      cur = neighbor(cur.q, cur.r, d);
      types.push(advanceQuest(state, d, cur.q, cur.r).type);
    }
    expect(types).toEqual(['advanced', 'advanced', 'advanced', 'advanced', 'arrived']);
    expect(state.progress).toBe(PATH_LENGTH);
  });

  it('completes after walking the origin clue path', () => {
    const state = createQuestState(0, 0);
    const { last } = walkPath(0, 0, computePath(0, 0), state);
    expect(last?.type).toBe('arrived');
    expect(state.complete).toBe(true);
    expect(state.progress).toBe(PATH_LENGTH);
  });

  it('ignores further moves once complete', () => {
    const state = createQuestState(0, 0);
    walkPath(0, 0, computePath(0, 0), state);
    expect(advanceQuest(state, 0, 0, 0)).toEqual({ type: 'none' });
  });

  it('reports none and stays at zero on a wrong first step', () => {
    const state = createQuestState(0, 0);
    const path = computePath(0, 0);
    const wrong = openDoors(0, 0).find((d) => d !== path[0]);
    expect(wrong).toBeDefined();
    const n = neighbor(0, 0, wrong);
    expect(advanceQuest(state, wrong, n.q, n.r)).toEqual({ type: 'none' });
    expect(state.progress).toBe(0);
    expect(state.expectedDir).toBe(stepDirection(n.q, n.r, 0, null));
    expect(state.expectedDir).toBe(computePath(n.q, n.r)[0]);
  });

  it('reports lost and resets after a wrong step mid-path', () => {
    const state = createQuestState(0, 0);
    const path = computePath(0, 0);
    const afterFirst = neighbor(0, 0, path[0]);
    expect(advanceQuest(state, path[0], afterFirst.q, afterFirst.r)).toEqual({
      type: 'advanced',
      progress: 1,
    });

    const wrong = openDoors(afterFirst.q, afterFirst.r).find((d) => d !== path[1]);
    expect(wrong).toBeDefined();
    const n = neighbor(afterFirst.q, afterFirst.r, wrong);
    expect(advanceQuest(state, wrong, n.q, n.r)).toEqual({ type: 'lost' });
    expect(state.progress).toBe(0);
    expect(state.complete).toBe(false);
    expect(state.expectedDir).toBe(stepDirection(n.q, n.r, 0, null));
  });
});
