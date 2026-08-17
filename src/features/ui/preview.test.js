import { describe, expect, it } from 'vitest';
import { PATH_REVELATIONS } from '../world/revelations.js';
import {
  PREVIEW_MODES,
  initialPreviewState,
  originClueBook,
  parseLaunchFlags,
} from './preview.js';

describe('parseLaunchFlags', () => {
  it('defaults to a normal desktop launch', () => {
    expect(parseLaunchFlags('')).toEqual({ touch: false, preview: null });
    expect(parseLaunchFlags('?')).toEqual({ touch: false, preview: null });
  });

  it('reads ?touch and a known ?preview=', () => {
    expect(parseLaunchFlags('?touch')).toEqual({ touch: true, preview: null });
    expect(parseLaunchFlags('touch&preview=pause')).toEqual({
      touch: true,
      preview: 'pause',
    });
    expect(parseLaunchFlags('?preview=book&touch')).toEqual({
      touch: true,
      preview: 'book',
    });
  });

  it('ignores unknown preview names', () => {
    expect(parseLaunchFlags('?preview=debug')).toEqual({ touch: false, preview: null });
    expect(parseLaunchFlags('?preview=')).toEqual({ touch: false, preview: null });
  });

  it('accepts every advertised preview mode', () => {
    for (const mode of PREVIEW_MODES) {
      expect(parseLaunchFlags(`?preview=${mode}`).preview).toBe(mode);
    }
  });
});

describe('initialPreviewState', () => {
  it('returns null when no preview is set', () => {
    expect(initialPreviewState(null)).toBeNull();
    expect(initialPreviewState('nope')).toBeNull();
  });

  it('opens the origin clue book', () => {
    const state = initialPreviewState('book');
    const book = originClueBook();
    expect(state).toEqual({ phase: 'playing', openBook: book });
    expect(book.kind).toBe('clue');
    expect(book.title).toBe('An Account of the Way');
  });

  it('opens pause while already playing', () => {
    expect(initialPreviewState('pause')).toEqual({ phase: 'playing', menuOpen: true });
  });

  it('skips to the ending overlay', () => {
    expect(initialPreviewState('ending')).toEqual({ phase: 'ended' });
  });

  it('mounts the first path revelation', () => {
    expect(initialPreviewState('mystery')).toEqual({
      phase: 'playing',
      mystery: { revelation: PATH_REVELATIONS[1], step: 1 },
    });
  });

  it('mounts the crimson arrival title card', () => {
    expect(initialPreviewState('crimson')).toEqual({
      phase: 'playing',
      crimsonArriving: true,
    });
  });
});
