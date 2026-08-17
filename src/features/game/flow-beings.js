// Tiny luminous beings that ride a slow current around each gallery,
// breathing toward open doorways so they look like they flow through.

import * as THREE from 'three';
import { HEX_INRADIUS, dirUnitVector } from '../world/hex.js';
import { RAIL_RADIUS } from './floor-clamp.js';

const COLORS = [0xc9e8ff, 0xffe6a8, 0xe4c8ff, 0xb8f0d8, 0xffd4c4];
const CRIMSON_COLORS = [0xff6a55, 0xffb070, 0xffdf9a];

const bodyGeo = new THREE.OctahedronGeometry(0.036, 0);
const wingGeo = (() => {
  const geo = new THREE.PlaneGeometry(0.07, 0.04);
  geo.translate(0.04, 0, 0);
  return geo;
})();

let glowTexture = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,240,210,0.95)');
  grad.addColorStop(0.4, 'rgba(255,210,150,0.3)');
  grad.addColorStop(1, 'rgba(255,210,150,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(cv);
  return glowTexture;
}

/** 0–1 pull toward the nearest open door at angle `theta`. */
export function doorFlowPull(theta, doors) {
  if (!doors.length) return 0;
  let best = 0;
  for (const d of doors) {
    const n = dirUnitVector(d);
    const doorTheta = Math.atan2(n.z, n.x);
    const diff = Math.atan2(Math.sin(theta - doorTheta), Math.cos(theta - doorTheta));
    const g = Math.exp(-diff * diff * 6.5);
    if (g > best) best = g;
  }
  return best;
}

/** Position on the gallery current. */
export function flowBeingPose(elapsed, being, doors) {
  const theta = elapsed * being.speed + being.phase;
  const pull = doorFlowPull(theta, doors);
  const outer = HEX_INRADIUS - 0.52;
  const radius = being.lane + (outer - being.lane) * pull;
  const y =
    being.height +
    Math.sin(elapsed * being.bob + being.phase) * 0.32 +
    pull * 0.25;
  return {
    x: Math.cos(theta) * radius,
    y,
    z: Math.sin(theta) * radius,
    yaw: theta + Math.PI / 2,
    flap: Math.sin(elapsed * 11 + being.phase) * 0.7,
    glow: 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(elapsed * 3.2 + being.phase)),
  };
}

function buildBeing(color) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const wingMat = mat.clone();
  wingMat.opacity = 0.55;
  wingMat.side = THREE.DoubleSide;

  const g = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, mat);
  g.add(body);

  const left = new THREE.Mesh(wingGeo, wingMat);
  const right = new THREE.Mesh(wingGeo, wingMat);
  right.scale.x = -1;
  g.add(left);
  g.add(right);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: getGlowTexture(),
      color,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.scale.setScalar(0.22);
  g.add(glow);

  return { group: g, left, right, glow, mat, wingMat };
}

/** Spawn a small school that shares one current around the gallery. */
export function createFlowBeings(roomData, rng, { crimson = false } = {}) {
  const count = 5 + Math.floor(rng() * 4);
  const palette = crimson ? CRIMSON_COLORS : COLORS;
  const beings = [];
  const baseSpeed = crimson ? 0.16 : 0.24;
  for (let i = 0; i < count; i++) {
    const color = palette[Math.floor(rng() * palette.length)];
    const visual = buildBeing(color);
    beings.push({
      ...visual,
      phase: (i / count) * Math.PI * 2 + rng() * 0.35,
      speed: baseSpeed + rng() * 0.08,
      lane: RAIL_RADIUS + 0.7 + rng() * 1.6,
      height: 1.15 + rng() * 1.6,
      bob: 1.1 + rng() * 0.9,
    });
  }
  return beings;
}

export function updateFlowBeings(beings, elapsed, doors) {
  for (const b of beings) {
    const pose = flowBeingPose(elapsed, b, doors);
    b.group.position.set(pose.x, pose.y, pose.z);
    b.group.rotation.y = pose.yaw;
    b.left.rotation.z = pose.flap;
    b.right.rotation.z = -pose.flap;
    b.glow.material.opacity = pose.glow;
    b.glow.scale.setScalar(0.16 + pose.glow * 0.14);
  }
}

export function disposeFlowBeings(beings) {
  for (const b of beings) {
    b.mat.dispose();
    b.wingMat.dispose();
    b.glow.material.dispose();
  }
}
