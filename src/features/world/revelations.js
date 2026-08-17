// One-shot mystery revelations unlocked by quest progress.
// Each step of the path speaks once per session; a path reset never repeats them.

import { PATH_LENGTH } from './quest.js';

/** @type {Record<number, { eyebrow: string, title: string, lines: string[] }>} */
export const PATH_REVELATIONS = {
  1: {
    eyebrow: 'First gallery',
    title: 'Something notices',
    lines: [
      'The shelves do not rearrange — and yet the room behind you feels less certain than it was.',
      'As if the Library has begun to keep a private record of your footsteps.',
    ],
  },
  2: {
    eyebrow: 'Second gallery',
    title: 'A borrowed memory',
    lines: [
      'You recall a catalogue you never opened: a name crossed out in red ink, a hexagon drawn in the margin.',
      'The recollection arrives complete, as though it had been waiting for the correct door.',
    ],
  },
  3: {
    eyebrow: 'Third gallery',
    title: 'The lamps lean closer',
    lines: [
      'Somewhere above the void, a voice practices your name in a language of dust.',
      'It does not call you. It is only learning the shape of the word.',
    ],
  },
  4: {
    eyebrow: 'Fourth gallery',
    title: 'Near enough to burn',
    lines: [
      'The air thickens with the smell of old paper catching light.',
      'One more true step, and the Library will no longer pretend these rooms are ordinary.',
    ],
  },
};

/** Revelation for a progress step, or null if none. */
export function revelationForProgress(progress) {
  return PATH_REVELATIONS[progress] ?? null;
}

/** Cutscene counter: "1 of 5", matching the HUD path dots. */
export function mysteryProgressLabel(step, of = PATH_LENGTH) {
  return `${step} of ${of}`;
}
