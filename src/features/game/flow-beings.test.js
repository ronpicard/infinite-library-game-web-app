import { describe, expect, it } from 'vitest';
import { HEX_INRADIUS } from '../world/hex.js';
import { dirUnitVector } from '../world/hex.js';
import { doorFlowPull, flowBeingPose } from './flow-beings.js';

describe('doorFlowPull', () => {
  it('is strongest facing an open door and weakest opposite it', () => {
    const n = dirUnitVector(0);
    const toward = Math.atan2(n.z, n.x);
    expect(doorFlowPull(toward, [0])).toBeGreaterThan(0.8);
    expect(doorFlowPull(toward + Math.PI, [0])).toBeLessThan(0.1);
    expect(doorFlowPull(toward, [])).toBe(0);
  });

  it('prefers the nearer of two open doors', () => {
    const n0 = dirUnitVector(0);
    const toward0 = Math.atan2(n0.z, n0.x);
    expect(doorFlowPull(toward0, [0, 3])).toBeCloseTo(doorFlowPull(toward0, [0]));
    expect(doorFlowPull(toward0, [0, 3])).toBeGreaterThan(doorFlowPull(toward0, [3]));
  });
});

describe('flowBeingPose', () => {
  const being = { phase: 0, speed: 0.25, lane: 3, height: 1.6, bob: 1.2 };

  it('stays in the gallery and rises toward a door', () => {
    const n = dirUnitVector(0);
    const toward = Math.atan2(n.z, n.x);
    const elapsed = toward / being.speed;
    const atDoor = flowBeingPose(elapsed, being, [0]);
    const away = flowBeingPose(elapsed, being, []);
    expect(Math.hypot(atDoor.x, atDoor.z)).toBeGreaterThan(Math.hypot(away.x, away.z));
    expect(Math.hypot(atDoor.x, atDoor.z)).toBeLessThan(HEX_INRADIUS);
    expect(atDoor.y).toBeGreaterThan(0.5);
    expect(atDoor.y).toBeLessThan(4.5);
  });

  it('is deterministic', () => {
    const a = flowBeingPose(4.2, being, [0, 3]);
    const b = flowBeingPose(4.2, being, [0, 3]);
    expect(a).toEqual(b);
    expect(a).toEqual(
      expect.objectContaining({
        yaw: expect.any(Number),
        flap: expect.any(Number),
        glow: expect.any(Number),
      })
    );
  });
});
