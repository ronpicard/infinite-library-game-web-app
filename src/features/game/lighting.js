/** Cheap lighting helpers: no extra lights, just weights and easing. */

export const LIGHT_BLEND_SECONDS = 0.6;
export const NEIGHBOR_LIGHT = 0.28;
export const FLICKER_DEPTH = 0.032;
export const LIGHT_FOLLOW = 9;
export const EXPOSURE_FOLLOW = 7;

/** Slow dual-sine flicker in a tight band so lamps breathe instead of strobe. */
export function lampFlickerFactor(elapsed, seedTag, flickerSpeed) {
  const fs = flickerSpeed;
  const a = Math.sin(elapsed * 3.6 * fs + seedTag);
  const b = Math.sin(elapsed * 1.55 * fs + seedTag * 2);
  return 1 + FLICKER_DEPTH * a * b;
}

/** Current room ramps to full; the room you left ramps down; others stay dim. */
export function roomLightWeight(key, currentKey, prevKey, blend) {
  const t = blend < 0 ? 0 : blend > 1 ? 1 : blend;
  if (key === currentKey) return NEIGHBOR_LIGHT + (1 - NEIGHBOR_LIGHT) * t;
  if (prevKey && key === prevKey) return NEIGHBOR_LIGHT + (1 - NEIGHBOR_LIGHT) * (1 - t);
  return NEIGHBOR_LIGHT;
}

export function advanceLightBlend(blend, dt, seconds = LIGHT_BLEND_SECONDS) {
  if (blend >= 1) return 1;
  return Math.min(1, blend + dt / seconds);
}

/** Exponential approach; rate is roughly "how many times it closes the gap per second". */
export function follow(current, target, dt, rate) {
  const k = 1 - Math.exp(-rate * dt);
  return current + (target - current) * k;
}
