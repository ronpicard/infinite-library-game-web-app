import { describe, expect, it } from 'vitest';
import { PATH_LENGTH } from './quest.js';
import { PATH_REVELATIONS, mysteryProgressLabel, revelationForProgress } from './revelations.js';

describe('revelationForProgress', () => {
  it('returns a titled beat for each in-progress step', () => {
    for (let step = 1; step < PATH_LENGTH; step++) {
      const beat = revelationForProgress(step);
      expect(beat).toEqual(PATH_REVELATIONS[step]);
      expect(beat.title).toBeTruthy();
      expect(beat.eyebrow).toBeTruthy();
      expect(beat.lines.length).toBeGreaterThan(0);
    }
  });

  it('returns null before the path starts and after arrival', () => {
    expect(revelationForProgress(0)).toBeNull();
    expect(revelationForProgress(PATH_LENGTH)).toBeNull();
    expect(revelationForProgress(99)).toBeNull();
  });
});

describe('PATH_REVELATIONS', () => {
  it('covers the four in-progress steps with unique titles', () => {
    const keys = Object.keys(PATH_REVELATIONS).map(Number).sort((a, b) => a - b);
    expect(keys).toEqual([1, 2, 3, 4]);
    const titles = keys.map((k) => PATH_REVELATIONS[k].title);
    expect(new Set(titles).size).toBe(4);
    for (const beat of Object.values(PATH_REVELATIONS)) {
      expect(beat.eyebrow.length).toBeGreaterThan(0);
      expect(beat.lines.every((line) => line.length > 0)).toBe(true);
    }
  });
});

describe('mysteryProgressLabel', () => {
  it('counts against the five-step path, matching the HUD dots', () => {
    expect(PATH_LENGTH).toBe(5);
    expect(mysteryProgressLabel(1)).toBe('1 of 5');
    expect(mysteryProgressLabel(4, PATH_LENGTH)).toBe('4 of 5');
    expect(mysteryProgressLabel(1, PATH_LENGTH - 1)).not.toBe(mysteryProgressLabel(1));
  });
});
