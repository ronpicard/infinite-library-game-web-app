/** Pause and the Crimson arrival both freeze look / click-to-lock. */
export function isLookFrozen(paused, inCrimsonTransition) {
  return Boolean(paused || inCrimsonTransition);
}

/**
 * During the arrival beat the cinematic owns lamp intensity and floor-rune
 * spin; the ambient room loop must not overwrite them.
 */
export function cinematicOwnsAmbientLights(inCrimsonTransition) {
  return Boolean(inCrimsonTransition);
}

/** Fog density inside the sealed chamber (gallery default is 0.04). */
export const CRIMSON_FOG_DENSITY = 0.028;
/** Seconds the chamber seals before the crimson room is revealed. */
export const CRIMSON_LOCK = 1.4;
/** Seconds the reveal eases fog, light, and scale into place afterward. */
export const CRIMSON_REVEAL = 2.2;
export const CRIMSON_TOTAL = CRIMSON_LOCK + CRIMSON_REVEAL;

export function easeOutCubic(t) {
  const x = Math.max(0, Math.min(1, t));
  return 1 - (1 - x) ** 3;
}

export function easeInOutCubic(t) {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/** Overall progress 0–1 across the full arrival beat. */
export function crimsonTransitionU(elapsed, lock = CRIMSON_LOCK, reveal = CRIMSON_REVEAL) {
  return easeInOutCubic(Math.min(1, elapsed / (lock + reveal)));
}

/** Reveal phase progress 0–1 after the lock finishes. */
export function crimsonRevealT(elapsed, lock = CRIMSON_LOCK, reveal = CRIMSON_REVEAL) {
  if (elapsed < lock) return 0;
  return Math.min(1, (elapsed - lock) / reveal);
}

/** When to swap in the crimson geometry — late in the lock once the room has dimmed. */
export function crimsonShouldTransform(elapsed, transformed, lock = CRIMSON_LOCK) {
  return !transformed && elapsed >= lock;
}

/**
 * Fog density during the beat: ease from gallery default toward the sealed
 * chamber haze.
 */
export function crimsonFogDensity(u, base = 0.04, crimson = CRIMSON_FOG_DENSITY) {
  return base + (crimson - base) * easeOutCubic(u);
}

/**
 * Main lamp multiplier: dim smoothly during lock, ease back to normal through
 * the reveal — no rapid flicker or sine strobe.
 */
export function crimsonLightMultiplier(elapsed, lock = CRIMSON_LOCK, reveal = CRIMSON_REVEAL) {
  if (elapsed < lock) {
    const lockT = easeInOutCubic(elapsed / lock);
    return 1 - 0.28 * lockT;
  }
  const revealT = crimsonRevealT(elapsed, lock, reveal);
  return 0.72 + 0.28 * easeOutCubic(revealT);
}

/** Subtle settle from a breath above 1.0 down to rest scale. */
export function crimsonRoomScale(revealT) {
  if (revealT <= 0) return 1;
  return 1.018 - 0.018 * easeOutCubic(revealT);
}

/** Low-frequency sway that fades out as the beat completes. */
export function crimsonCameraSway(elapsed, u) {
  const fade = 1 - easeOutCubic(u);
  const amp = 0.01 * fade;
  return {
    x: amp * Math.sin(elapsed * 1.9),
    z: amp * Math.cos(elapsed * 1.5) * 0.65,
  };
}

/** Ember glow around the pedestal ramps in after the swap. */
export function crimsonEmberIntensity(revealT, peak = 32) {
  if (revealT <= 0) return 0;
  return peak * easeOutCubic(revealT);
}

/** Rune spin rates during the reveal (rad/s). */
export function crimsonRuneSpin(_elapsed, revealT) {
  const ramp = easeOutCubic(revealT);
  return {
    outer: 0.6 + ramp * 1.6,
    inner: -(0.9 + ramp * 2.4),
  };
}
