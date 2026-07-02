// Deterministic hashing + PRNG utilities. Everything in the world derives
// from these so that revisited rooms are always identical.

const GOLDEN = 0x9e3779b9;

/** Mix up to four integers into a well-distributed uint32. */
export function hashInts(a, b = 0, c = 0, d = 0) {
  let h = 0x811c9dc5 >>> 0;
  for (const v of [a, b, c, d]) {
    let x = (v | 0) + GOLDEN;
    x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
    x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
    x ^= x >>> 15;
    h = (Math.imul(h ^ x, 0x01000193) + GOLDEN) >>> 0;
  }
  return h >>> 0;
}

/** Small fast seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one element of an array using a hash value. */
export function pickHashed(arr, hash) {
  return arr[hash % arr.length];
}
