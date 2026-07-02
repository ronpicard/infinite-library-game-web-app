// Book content generation. Titles and pages are pure functions of a seed,
// so every volume reads the same on every visit.

import { hashInts, mulberry32 } from '../../lib/random.js';
import { getRoomData } from '../world/room-data.js';
import { pathDirectionNames, PATH_LENGTH } from '../world/quest.js';

// Borges gives the Library twenty-two letters, the comma and the period.
const ALPHABET = 'abcdefghijklmnopqrstuvyz';

const APHORISMS = [
  'The lamp does not ask what it illuminates.',
  'Every gallery believes itself the center; every center is a rumor.',
  'A shelf remembers the hand longer than the hand remembers the shelf.',
  'What cannot be found has merely not been lost correctly.',
  'The dust is patient. It has read everything.',
  'To walk in one direction forever is also a kind of prayer.',
  'Somewhere a book describes this exact moment, and gets it wrong.',
  'The librarians grew old counting doors. The doors did not count them.',
  'Meaning is the rarest element. It decays into letters.',
  'Do not pity the gibberish. It is speech awaiting its language.',
  'Two mirrors face each other in every void: above, below, neither first.',
  'He who finds one true sentence has already been paid for his life.',
  'The stairs go up and the stairs go down and both arrive here.',
  'A door refused is a wall earned.',
  'Order is only the name we give to the corridor we happened to take.',
  'The Library does not end. The reader does. This is the arrangement.',
  'Whole shelves argue about a word no one alive has spoken.',
  'Listen: even the echoes here are quotations.',
];

const CLUE_OPENINGS = [
  'I was a cataloguer of impossible rooms, and this page is my confession.',
  'Ninety years I walked, and the walking wrote this book through me.',
  'Whoever reads this stands where I once stood, under the same tired lamp.',
  'This volume is legible. That alone should frighten you into attention.',
];

const CLUE_CLOSINGS = [
  'Falter once and the way dissolves; stand still, and this page will tell it again.',
  'Step wrongly and the path forgets you. Return to any legible book and begin anew.',
  'The Library forgives error with erasure. Lose the thread, and seek a pale spine again.',
];

function seededRng(seed) {
  return mulberry32(seed >>> 0);
}

function gibberishWord(rng, min = 2, max = 9) {
  const len = min + Math.floor(rng() * (max - min + 1));
  let w = '';
  for (let i = 0; i < len; i++) w += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return w;
}

export function gibberishTitle(seed) {
  const rng = seededRng(seed);
  const words = 1 + Math.floor(rng() * 3);
  const parts = [];
  for (let i = 0; i < words; i++) {
    const w = gibberishWord(rng, 3, 9);
    parts.push(w.charAt(0).toUpperCase() + w.slice(1));
  }
  return parts.join(' ');
}

export function gibberishPage(seed, chars = 1300) {
  const rng = seededRng(seed);
  let out = '';
  let sinceBreak = 0;
  while (out.length < chars) {
    out += gibberishWord(rng);
    sinceBreak += 1;
    const roll = rng();
    if (roll < 0.08) out += ',';
    else if (roll < 0.12) out += '.';
    if (roll < 0.03 && sinceBreak > 20) {
      out += '\n\n';
      sinceBreak = 0;
    } else {
      out += ' ';
    }
  }
  return out.trim();
}

function clueBody(seed, q, r) {
  const rng = seededRng(seed);
  const names = pathDirectionNames(q, r);
  const opening = CLUE_OPENINGS[Math.floor(rng() * CLUE_OPENINGS.length)];
  const closing = CLUE_CLOSINGS[Math.floor(rng() * CLUE_CLOSINGS.length)];
  const steps = names
    .map((n, i) => `${ORDINALS[i]}, pass toward ${n};`)
    .join('\n');
  return (
    `${opening}\n\n` +
    `There is a hexagon that burns crimson, and in it one perfect book. ` +
    `From the gallery where you now read, the way is ${names.length === PATH_LENGTH ? 'five galleries' : 'short'}, and it is this:\n\n` +
    `${steps}\n\n` +
    `and there the lamps will turn to embers.\n\n${closing}`
  );
}

const ORDINALS = ['First', 'Then', 'Third', 'Fourth', 'Last'];

const INTRO_BODY =
  'To the one who opens this instead of any of the trillion others: it was not chance.\n\n' +
  'The old librarians spoke of the Crimson Hexagon — a gallery lit red, holding a single ' +
  'book that is entirely true. Every other volume in every other room is noise, or nearly so.\n\n' +
  'But the Library leaves a trail for the patient. Among the endless dark spines are pale ones, ' +
  'and the pale spines remember language. Find them. They will name the way, gallery by gallery, ' +
  'in the old compass of this place: dust and lamp, water and ash, frost and the red wind. ' +
  'Face a doorway and the compass will whisper its name to you.\n\n' +
  'Walk the way without error. Five thresholds, and the light will change.';

const CRIMSON_TITLE = 'The Book of Sand and Certainty';
const CRIMSON_BODY =
  'You expect revelation. The page gives you an inventory.\n\n' +
  'It lists a lamp, this lamp. A layer of dust, disturbed twice — once by you, once long ago. ' +
  'It lists your route, gallery by gallery, and the exact books you opened, and the moment you ' +
  'nearly turned back. It lists this sentence, and your reading of it.\n\n' +
  'The last line is brief:\n\n' +
  'THE LIBRARY IS COMPLETE. IT WAS NEVER MISSING ANYTHING BUT A READER.\n\n' +
  'Behind you, very softly, every lamp in every gallery you will never visit goes on burning anyway.';

/**
 * Content for the book at `index` in room (q, r).
 * Returns { title, body, kind } with kind in
 * 'gibberish' | 'aphorism' | 'clue' | 'intro'.
 */
export function getBookContent(q, r, index) {
  const room = getRoomData(q, r);
  const seed = hashInts(room.seed, 0xb00c, index);
  const special = room.coherent.get(index);

  if (!special) {
    return { title: gibberishTitle(seed), body: gibberishPage(seed ^ 0x51), kind: 'gibberish' };
  }
  if (special.kind === 'clue') {
    return { title: 'An Account of the Way', body: clueBody(seed, q, r), kind: 'clue' };
  }
  if (special.kind === 'intro') {
    return { title: 'A Letter Left on Purpose', body: INTRO_BODY, kind: 'intro' };
  }
  const aphorism = APHORISMS[special.variant % APHORISMS.length];
  // An aphorism book is one legible sentence adrift in noise.
  const before = gibberishPage(seed ^ 0xa1, 380);
  const after = gibberishPage(seed ^ 0xa2, 380);
  return {
    title: gibberishTitle(seed ^ 0xa3),
    body: `${before}\n\n${aphorism}\n\n${after}`,
    kind: 'aphorism',
  };
}

export function getCrimsonBookContent() {
  return { title: CRIMSON_TITLE, body: CRIMSON_BODY, kind: 'crimson' };
}
