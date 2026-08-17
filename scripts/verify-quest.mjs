// Sanity checks for the deterministic world: door symmetry, clue-path
// walkability from many rooms, and quest-state consistency with clue books.

import { neighbor, oppositeDir, DIRECTIONS } from '../src/features/world/hex.js';
import { isDoorOpen, openDoors, getRoomData } from '../src/features/world/room-data.js';
import {
  computePath,
  stepDirection,
  createQuestState,
  advanceQuest,
  PATH_LENGTH,
} from '../src/features/world/quest.js';
import { getBookContent } from '../src/features/books/text.js';

let failures = 0;
function check(cond, msg) {
  if (!cond) {
    failures += 1;
    console.error('FAIL:', msg);
  }
}

// 1. Door symmetry: A->B open iff B->A open.
for (let q = -20; q <= 20; q += 3) {
  for (let r = -20; r <= 20; r += 3) {
    for (let d = 0; d < 6; d++) {
      const n = neighbor(q, r, d);
      check(
        isDoorOpen(q, r, d) === isDoorOpen(n.q, n.r, oppositeDir(d)),
        `door asymmetry at ${q},${r} dir ${d}`
      );
    }
  }
}

// 2. Every sampled room's clue path is 5 steps and every step passes an
//    open door, ending in a well-defined room.
let sealed = 0;
let sampled = 0;
for (let q = -30; q <= 30; q += 2) {
  for (let r = -30; r <= 30; r += 2) {
    sampled += 1;
    const doors = openDoors(q, r);
    if (doors.length === 0) {
      sealed += 1;
      continue; // sealed rooms can never be stood in, so no path needed
    }
    const path = computePath(q, r);
    check(path.length === PATH_LENGTH, `short path from ${q},${r}: ${path.length}`);
    let cur = { q, r };
    for (const d of path) {
      check(isDoorOpen(cur.q, cur.r, d), `path uses closed door at ${cur.q},${cur.r} dir ${d}`);
      cur = neighbor(cur.q, cur.r, d);
    }
  }
}
console.log(`sealed rooms: ${sealed}/${sampled} (${((100 * sealed) / sampled).toFixed(1)}%)`);

// 3. Walking the clue path from the origin advances the quest to completion.
{
  const state = createQuestState(0, 0);
  const path = computePath(0, 0);
  let cur = { q: 0, r: 0 };
  let lastEvent = null;
  for (const d of path) {
    cur = neighbor(cur.q, cur.r, d);
    lastEvent = advanceQuest(state, d, cur.q, cur.r);
  }
  check(lastEvent?.type === 'arrived', `quest did not complete: ${lastEvent?.type}`);
  check(state.complete, 'quest state not complete');
}

// 4. A wrong step resets, and the current room's clue book agrees with the
//    fresh expected direction.
{
  const state = createQuestState(0, 0);
  const path = computePath(0, 0);
  const wrong = openDoors(0, 0).find((d) => d !== path[0]);
  if (wrong !== undefined) {
    const n = neighbor(0, 0, wrong);
    advanceQuest(state, wrong, n.q, n.r);
    check(state.progress === 0, 'progress should reset on wrong move');
    check(
      state.expectedDir === stepDirection(n.q, n.r, 0, null),
      'expected dir mismatch after reset'
    );
    check(
      state.expectedDir === computePath(n.q, n.r)[0],
      'clue path first step mismatch after reset'
    );
  }
}

// 5. Determinism + content: same room yields identical data twice; clue and
//    intro books exist where promised.
{
  const a = getRoomData(4, -2);
  const b = getRoomData(4, -2);
  check(a.seed === b.seed && a.bookCount === b.bookCount, 'room data not deterministic');
  check(JSON.stringify([...a.coherent.keys()]) === JSON.stringify([...b.coherent.keys()]),
    'coherent indices not deterministic');

  const origin = getRoomData(0, 0);
  const kinds = [...origin.coherent.values()].map((v) => v.kind);
  check(kinds.includes('clue'), 'origin missing clue book');

  const clueIdx = [...origin.coherent.entries()].find(([, v]) => v.kind === 'clue')[0];
  const clue = getBookContent(0, 0, clueIdx);
  check(clue.kind === 'clue' && clue.body.includes('crimson'), 'clue book body malformed');
  const g1 = getBookContent(3, 5, 10);
  const g2 = getBookContent(3, 5, 10);
  check(g1.body === g2.body, 'gibberish not deterministic');
  console.log('\n--- sample clue book (origin) ---\n' + clue.body + '\n');
}

// 6. Direction count sanity: average doors per room.
{
  let total = 0;
  let n = 0;
  for (let q = -15; q <= 15; q++) {
    for (let r = -15; r <= 15; r++) {
      total += openDoors(q, r).length;
      n += 1;
    }
  }
  console.log(`average doors per room: ${(total / n).toFixed(2)}`);
}

if (failures === 0) console.log('ALL CHECKS PASSED');
else {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
