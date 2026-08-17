// URL launch flags. `?touch` forces the phone HUD (also used by e2e).
// `?preview=` mounts an overlay without walking the 3D world.

import { getBookContent } from '../books/index.js';
import { getRoomData } from '../world/room-data.js';
import { revelationForProgress } from '../world/revelations.js';

export const PREVIEW_MODES = ['book', 'pause', 'ending', 'mystery', 'crimson'];

export function parseLaunchFlags(search = '') {
  const params = new URLSearchParams(
    search.startsWith('?') || search === '' ? search : `?${search}`
  );
  const preview = params.get('preview');
  return {
    touch: params.has('touch'),
    preview: PREVIEW_MODES.includes(preview) ? preview : null,
  };
}

export function originClueBook() {
  const origin = getRoomData(0, 0);
  const clue = [...origin.coherent.entries()].find(([, v]) => v.kind === 'clue');
  if (!clue) throw new Error('origin gallery is missing the clue book');
  return getBookContent(0, 0, clue[0]);
}

/** Initial App overlay state for a preview mode, or null for a normal launch. */
export function initialPreviewState(preview) {
  if (preview === 'book') {
    return { phase: 'playing', openBook: originClueBook() };
  }
  if (preview === 'pause') {
    return { phase: 'playing', menuOpen: true };
  }
  if (preview === 'ending') {
    return { phase: 'ended' };
  }
  if (preview === 'mystery') {
    return {
      phase: 'playing',
      mystery: { revelation: revelationForProgress(1), step: 1 },
    };
  }
  if (preview === 'crimson') {
    return { phase: 'playing', crimsonArriving: true };
  }
  return null;
}
