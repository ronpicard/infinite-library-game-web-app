import { describe, expect, it } from 'vitest';
import { getRoomData } from '../world/room-data.js';
import { pathDirectionNames } from '../world/quest.js';
import {
  getBookContent,
  getCrimsonBookContent,
  gibberishPage,
  gibberishTitle,
} from './text.js';

describe('gibberishTitle and gibberishPage', () => {
  it('are deterministic for a seed', () => {
    expect(gibberishTitle(42)).toBe(gibberishTitle(42));
    expect(gibberishPage(42)).toBe(gibberishPage(42));
  });

  it('title-cases a few alphabet words', () => {
    expect(gibberishTitle(99)).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)*$/);
  });

  it('fills a page with letters, commas, periods, and spaces', () => {
    const page = gibberishPage(7, 400);
    expect(page.length).toBeGreaterThan(300);
    expect(page).toMatch(/^[abcdefghijklmnopqrstuvyz,.\s]+$/);
  });
});

describe('getBookContent', () => {
  it('returns identical content for the same volume', () => {
    const a = getBookContent(3, 5, 10);
    const b = getBookContent(3, 5, 10);
    expect(a).toEqual(b);
  });

  it('returns gibberish for an unmarked index', () => {
    const room = getRoomData(3, 5);
    let idx = 0;
    while (room.coherent.has(idx)) idx += 1;
    const book = getBookContent(3, 5, idx);
    expect(book.kind).toBe('gibberish');
    expect(book.title).toBeTruthy();
    expect(book.body.length).toBeGreaterThan(100);
  });

  it('writes a clue that names the path from that gallery', () => {
    const origin = getRoomData(0, 0);
    const clueIdx = [...origin.coherent.entries()].find(([, v]) => v.kind === 'clue')[0];
    const book = getBookContent(0, 0, clueIdx);
    expect(book.kind).toBe('clue');
    expect(book.title).toBe('An Account of the Way');
    expect(book.body.toLowerCase()).toContain('crimson');
    for (const name of pathDirectionNames(0, 0)) {
      expect(book.body).toContain(name);
    }
  });
});

describe('getCrimsonBookContent', () => {
  it('returns the unique true book', () => {
    const book = getCrimsonBookContent();
    expect(book.kind).toBe('crimson');
    expect(book.title).toBe('The Book of Sand and Certainty');
    expect(book.body).toMatch(/THE LIBRARY IS COMPLETE/);
  });
});
