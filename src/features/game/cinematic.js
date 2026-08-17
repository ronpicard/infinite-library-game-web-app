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
