// Seeded floor and wall albedo patterns. Each gallery gets its own spec
// (family, scale, grout, contrast) so two rooms of the same architectural
// style still read as different stone.

import * as THREE from 'three';
import { hashInts, mulberry32 } from '../../lib/random.js';

export const FLOOR_FAMILIES = 8;
export const WALL_FAMILIES = 8;
export const PATTERN_SIZE = 256;

const FLOOR_SALT = 0xf100;
const WALL_SALT = 0xa11;

function fract(x) {
  return x - Math.floor(x);
}

function cellNoise(ix, iy, salt) {
  return hashInts(ix, iy, salt) / 4294967296;
}

/** Deterministic pattern parameters for a room surface. */
export function makePatternSpec(seed, surface) {
  const floor = surface === 'floor';
  const rng = mulberry32(hashInts(seed, floor ? FLOOR_SALT : WALL_SALT));
  const family = Math.floor(rng() * (floor ? FLOOR_FAMILIES : WALL_FAMILIES));
  const centered = floor && (family === 2 || family === 5 || family === 7);
  return {
    surface,
    family,
    scale: 3.5 + rng() * 7.5,
    grout: 0.035 + rng() * 0.07,
    contrast: 0.16 + rng() * 0.2,
    phase: rng() * Math.PI * 2,
    skew: rng() * 0.35,
    repeatU: centered ? 1 : 2 + Math.floor(rng() * 3),
    repeatV: centered ? 1 : 2 + Math.floor(rng() * 2),
  };
}

/**
 * Shade in [0, 1] at UV (u, v). Values sit high so the style color still
 * reads; grout and motif lines dip darker.
 */
export function patternShade(u, v, spec) {
  const uu = u + spec.skew * 0.15;
  const vv = v + spec.phase * 0.02;
  let s;
  switch (spec.family) {
    case 0:
      s = spec.surface === 'floor' ? hexTiles(uu, vv, spec) : bands(uu, vv, spec);
      break;
    case 1:
      s = spec.surface === 'floor' ? diamonds(uu, vv, spec) : ashlar(uu, vv, spec);
      break;
    case 2:
      s = spec.surface === 'floor' ? rings(uu, vv, spec) : panels(uu, vv, spec);
      break;
    case 3:
      s = spec.surface === 'floor' ? voronoi(uu, vv, spec) : glyphs(uu, vv, spec);
      break;
    case 4:
      s = spec.surface === 'floor' ? tesserae(uu, vv, spec) : crackle(uu, vv, spec);
      break;
    case 5:
      s = spec.surface === 'floor' ? radial(uu, vv, spec) : brick(uu, vv, spec);
      break;
    case 6:
      s = spec.surface === 'floor' ? slabs(uu, vv, spec) : lattice(uu, vv, spec);
      break;
    default:
      s = spec.surface === 'floor' ? compass(uu, vv, spec) : plaster(uu, vv, spec);
  }
  return Math.max(0.45, Math.min(1, s));
}

function groutMix(edge, spec, fill) {
  const g = spec.grout;
  if (edge < g) return 0.52 + (edge / g) * 0.08;
  return fill;
}

function hexTiles(u, v, spec) {
  const s = spec.scale;
  const x = u * s;
  const y = v * s * 1.1547;
  const q = x;
  const r = y - x * 0.5;
  const fq = Math.floor(q);
  const fr = Math.floor(r);
  const edge = Math.min(fract(q), fract(r), 1 - fract(q), 1 - fract(r));
  const fill = 0.74 + cellNoise(fq, fr, spec.family) * spec.contrast;
  return groutMix(edge, spec, fill);
}

function diamonds(u, v, spec) {
  const s = spec.scale;
  const x = (u + v) * s;
  const y = (u - v) * s;
  const edge = Math.min(fract(x), fract(y), 1 - fract(x), 1 - fract(y));
  const fill =
    0.73 + cellNoise(Math.floor(x), Math.floor(y), spec.family + 3) * spec.contrast;
  return groutMix(edge, spec, fill);
}

function rings(u, v, spec) {
  const r = Math.hypot(u - 0.5, v - 0.5) * spec.scale;
  const f = fract(r + spec.phase * 0.1);
  const edge = Math.min(f, 1 - f);
  const fill = 0.7 + fract(Math.floor(r) * 0.37) * spec.contrast;
  return groutMix(edge * 0.5, spec, fill);
}

function voronoi(u, v, spec) {
  const s = spec.scale * 0.55;
  const x = u * s;
  const y = v * s;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let best = 9;
  let best2 = 9;
  let id = 0;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = ix + ox;
      const cy = iy + oy;
      const px = cx + cellNoise(cx, cy, 11);
      const py = cy + cellNoise(cx, cy, 29);
      const d = Math.hypot(x - px, y - py);
      if (d < best) {
        best2 = best;
        best = d;
        id = cellNoise(cx, cy, 47);
      } else if (d < best2) {
        best2 = d;
      }
    }
  }
  if (best2 - best < spec.grout * 1.8) return 0.5;
  return 0.7 + id * spec.contrast;
}

function tesserae(u, v, spec) {
  const s = spec.scale * 1.8;
  const x = u * s;
  const y = v * s;
  const edge = Math.min(fract(x), fract(y), 1 - fract(x), 1 - fract(y));
  const fill =
    0.72 + cellNoise(Math.floor(x), Math.floor(y), spec.family + 9) * spec.contrast;
  return groutMix(edge, { ...spec, grout: spec.grout * 0.7 }, fill);
}

function radial(u, v, spec) {
  const dx = u - 0.5;
  const dy = v - 0.5;
  const a = (Math.atan2(dy, dx) + Math.PI + spec.phase) / (Math.PI * 2);
  const wedges = 6 + Math.floor(spec.scale % 6);
  const w = a * wedges;
  const edge = Math.min(fract(w), 1 - fract(w));
  const fill = 0.72 + fract(Math.floor(w) * 0.41) * spec.contrast;
  return groutMix(edge * 0.35, spec, fill);
}

function slabs(u, v, spec) {
  const s = spec.scale * 0.45;
  const x = u * s;
  const y = v * s;
  const edge = Math.min(fract(x), fract(y), 1 - fract(x), 1 - fract(y));
  const fill =
    0.74 + cellNoise(Math.floor(x), Math.floor(y), spec.family + 13) * spec.contrast;
  return groutMix(edge, spec, fill);
}

function compass(u, v, spec) {
  const dx = u - 0.5;
  const dy = v - 0.5;
  const r = Math.hypot(dx, dy);
  const a = Math.abs(Math.atan2(dy, dx));
  const spoke = Math.min(fract(a / (Math.PI / 6)), 1 - fract(a / (Math.PI / 6)));
  let s = rings(u, v, spec);
  if (r < 0.18 && spoke < 0.08) s *= 0.72;
  if (r < 0.04) s = 0.88;
  return s;
}

function bands(u, v, spec) {
  const y = v * spec.scale * 0.7;
  const edge = Math.min(fract(y), 1 - fract(y));
  const fill = 0.74 + fract(Math.floor(y) * 0.29) * spec.contrast;
  return groutMix(edge * 0.45, spec, fill);
}

function ashlar(u, v, spec) {
  const rows = v * spec.scale;
  const row = Math.floor(rows);
  const off = (row % 2) * 0.5;
  const cols = u * spec.scale * 0.7 + off;
  const edge = Math.min(
    fract(rows),
    1 - fract(rows),
    fract(cols),
    1 - fract(cols)
  );
  const fill = 0.73 + cellNoise(Math.floor(cols), row, spec.family) * spec.contrast;
  return groutMix(edge, spec, fill);
}

function panels(u, v, spec) {
  const x = u * spec.scale * 0.55;
  const edge = Math.min(fract(x), 1 - fract(x));
  const fill = 0.75 + fract(Math.floor(x) * 0.33) * spec.contrast;
  const rail = v < 0.08 || v > 0.92 ? 0.6 : fill;
  return groutMix(edge * 0.4, spec, rail);
}

function glyphs(u, v, spec) {
  const s = spec.scale * 1.1;
  const x = fract(u * s) - 0.5;
  const y = fract(v * s) - 0.5;
  const d = Math.hypot(x, y);
  const plus = Math.min(Math.abs(x), Math.abs(y));
  const stamp = d < 0.12 || (plus < 0.04 && Math.max(Math.abs(x), Math.abs(y)) < 0.22);
  const field = 0.8 - spec.contrast * 0.25;
  return stamp ? field - spec.contrast * 0.55 : field;
}

function crackle(u, v, spec) {
  const a = Math.sin((u * 17 + spec.phase) * spec.scale) * Math.sin((v * 13) * spec.scale);
  const b = Math.sin((u * 7 - v * 11 + spec.phase) * spec.scale * 0.6);
  const line = Math.min(Math.abs(a), Math.abs(b));
  if (line < spec.grout * 0.9) return 0.55;
  return 0.78 + a * spec.contrast * 0.15;
}

function brick(u, v, spec) {
  const rows = v * spec.scale * 1.1;
  const row = Math.floor(rows);
  const off = (row % 2) * 0.5;
  const cols = u * spec.scale * 0.65 + off;
  const edge = Math.min(
    fract(rows),
    1 - fract(rows),
    fract(cols),
    1 - fract(cols)
  );
  const fill = 0.72 + cellNoise(Math.floor(cols), row, 61) * spec.contrast;
  return groutMix(edge, spec, fill);
}

function lattice(u, v, spec) {
  const s = spec.scale;
  const x = (u + v) * s;
  const y = (u - v) * s;
  const edge = Math.min(fract(x), fract(y), 1 - fract(x), 1 - fract(y));
  const fill = 0.76 + spec.contrast * 0.2;
  return groutMix(edge * 0.55, spec, fill);
}

function plaster(u, v, spec) {
  const n =
    cellNoise(Math.floor(u * 48), Math.floor(v * 48), spec.family) * 0.08 +
    cellNoise(Math.floor(u * 12), Math.floor(v * 12), spec.family + 5) * spec.contrast;
  const stoneU = fract(u * spec.scale * 0.25 + spec.skew);
  const stoneV = fract(v * spec.scale * 0.2);
  const blob = Math.hypot(stoneU - 0.5, stoneV - 0.5);
  const fleck = blob < 0.12 ? -0.12 : 0;
  return 0.76 + n + fleck;
}

export function fillPatternPixels(pixels, size, spec) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = patternShade(x / size, y / size, spec);
      const v = Math.max(0, Math.min(255, Math.round(s * 255)));
      const i = (y * size + x) * 4;
      pixels[i] = v;
      pixels[i + 1] = v;
      pixels[i + 2] = v;
      pixels[i + 3] = 255;
    }
  }
}

/** Canvas albedo map for a room surface. Caller must dispose the texture. */
export function createSurfacePatternTexture(spec) {
  const size = PATTERN_SIZE;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const img = g.createImageData(size, size);
  fillPatternPixels(img.data, size, spec);
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(spec.repeatU, spec.repeatV);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
