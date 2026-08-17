// Library cats: solid, differently colored, wandering the gallery floor.
// They walk, sit, and meow. Deterministic per room from the room seed.

import * as THREE from 'three';
import { mulberry32, hashInts } from '../../lib/random.js';
import { HEX_INRADIUS, HEX_RADIUS, dirUnitVector } from '../world/hex.js';

// Match room-builder collision radii (avoid circular imports).
const RAIL_RADIUS = 1.78;
const DOOR_PASS_HALF = 0.92;
const COLUMN_RADIUS = 0.3;
const COLUMN_RING_RADIUS = HEX_RADIUS - 0.62;
const CAT_RADIUS = 0.14;

const CAT_COLORS = [
  0xc97830, // orange tabby
  0x5a5a5a, // grey
  0xf2ebe3, // white
  0x8b5a2b, // brown
  0x1c1c1c, // black
  0xc9956a, // ginger
  0x6b7b4a, // olive
  0xc9a0a0, // dusty rose
];

/** Keep a cat on walkable floor: outside the void, inside walls, around columns. */
export function clampCatFloor(x, z, roomData) {
  let relX = x;
  let relZ = z;

  const coreR = RAIL_RADIUS + CAT_RADIUS;
  const centerDist = Math.hypot(relX, relZ);
  if (centerDist < coreR && centerDist > 1e-4) {
    const push = coreR / centerDist;
    relX *= push;
    relZ *= push;
  }

  for (let d = 0; d < 6; d++) {
    const n = dirUnitVector(d);
    const along = relX * n.x + relZ * n.z;
    const isDoor = roomData.doors.includes(d);
    const limit = HEX_INRADIUS - (isDoor ? 0.28 : 0.95) - CAT_RADIUS;
    if (along <= limit) continue;
    const lateral = relX * -n.z + relZ * n.x;
    if (isDoor && Math.abs(lateral) < DOOR_PASS_HALF - CAT_RADIUS) continue;
    relX -= n.x * (along - limit);
    relZ -= n.z * (along - limit);
  }

  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    const cx = Math.cos(a) * COLUMN_RING_RADIUS;
    const cz = Math.sin(a) * COLUMN_RING_RADIUS;
    const dx = relX - cx;
    const dz = relZ - cz;
    const dist = Math.hypot(dx, dz);
    const colR = COLUMN_RADIUS + CAT_RADIUS;
    if (dist < colR && dist > 1e-4) {
      relX = cx + (dx / dist) * colR;
      relZ = cz + (dz / dist) * colR;
    }
  }

  return { x: relX, z: relZ };
}

function pickFloorPoint(rng, roomData) {
  for (let t = 0; t < 36; t++) {
    const a = rng() * Math.PI * 2;
    const r = RAIL_RADIUS + 0.4 + rng() * (HEX_INRADIUS - 1.35);
    const c = clampCatFloor(Math.cos(a) * r, Math.sin(a) * r, roomData);
    if (Math.hypot(c.x, c.z) > RAIL_RADIUS + CAT_RADIUS + 0.08) return c;
  }
  return clampCatFloor(2.4, 1.2, roomData);
}

/** Model faces local +X; rotate so +X aligns with movement (dx, dz). */
function yawForDirection(dx, dz) {
  return Math.atan2(dx, dz) - Math.PI / 2;
}

function buildLibraryCat(furColor) {
  const mat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.88 });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x2a2020, roughness: 0.7 });
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.17, 0.2), mat);
  body.position.y = 0.13;
  g.add(body);

  const head = new THREE.Group();
  head.position.set(0.21, 0.2, 0);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.13, 0.13), mat);
  head.add(skull);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.025), noseMat);
  nose.position.set(0.085, -0.01, 0);
  head.add(nose);
  const earL = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.075, 4), mat);
  earL.position.set(0.02, 0.085, 0.045);
  head.add(earL);
  const earR = earL.clone();
  earR.position.z = -0.045;
  head.add(earR);
  g.add(head);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.04), mat);
  tail.geometry.translate(-0.12, 0, 0);
  tail.position.set(-0.19, 0.17, 0);
  g.add(tail);

  const legs = [];
  for (const [lx, lz] of [
    [0.11, 0.07],
    [0.11, -0.07],
    [-0.09, 0.07],
    [-0.09, -0.07],
  ]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.045), mat);
    leg.position.set(lx, 0.055, lz);
    g.add(leg);
    legs.push(leg);
  }

  return { group: g, head, tail, legs, mat, noseMat };
}

function resetLegs(cat) {
  for (const leg of cat.legs) leg.position.y = 0.055;
}

function pickNextState(cat, roomData) {
  const roll = cat.rng();
  if (roll < 0.48) {
    cat.state = 'walk';
    cat.stateTimer = 3 + cat.rng() * 7;
    cat.target = pickFloorPoint(cat.rng, roomData);
  } else if (roll < 0.78) {
    cat.state = 'sit';
    cat.stateTimer = 2 + cat.rng() * 6;
  } else {
    cat.state = 'meow';
    cat.stateTimer = 0.65;
    cat.meowed = false;
  }
}

/** Spawn 1–2 cats for a gallery; skipped in the Crimson Hexagon. */
export function createRoomCats(roomData, rng, { crimson = false } = {}) {
  if (crimson) return [];
  const count = 1 + Math.floor(rng() * 2);
  const cats = [];
  for (let i = 0; i < count; i++) {
    const colorIdx = Math.floor(rng() * CAT_COLORS.length);
    const catRng = mulberry32(hashInts(roomData.seed, 0xca7, i));
    const visual = buildLibraryCat(CAT_COLORS[colorIdx]);
    const start = pickFloorPoint(catRng, roomData);
    cats.push({
      ...visual,
      x: start.x,
      z: start.z,
      yaw: catRng() * Math.PI * 2,
      state: 'sit',
      stateTimer: 1.5 + catRng() * 3,
      target: pickFloorPoint(catRng, roomData),
      walkSpeed: 0.5 + catRng() * 0.4,
      colorIdx,
      meowed: false,
      seed: catRng() * 1000,
      rng: catRng,
    });
  }
  return cats;
}

/** Advance cat AI and animation; calls onMeow once per meow state. */
export function updateRoomCats(cats, dt, elapsed, roomData, onMeow) {
  for (const cat of cats) {
    cat.stateTimer -= dt;

    if (cat.state === 'walk') {
      const dx = cat.target.x - cat.x;
      const dz = cat.target.z - cat.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.14 || cat.stateTimer <= 0) {
        pickNextState(cat, roomData);
        continue;
      }
      const step = Math.min(dist, cat.walkSpeed * dt);
      const prevX = cat.x;
      const prevZ = cat.z;
      const next = clampCatFloor(cat.x + (dx / dist) * step, cat.z + (dz / dist) * step, roomData);
      cat.x = next.x;
      cat.z = next.z;
      cat.yaw = yawForDirection(dx, dz);

      if (Math.hypot(cat.x - prevX, cat.z - prevZ) < step * 0.12) {
        pickNextState(cat, roomData);
        continue;
      }

      const phase = elapsed * 9 + cat.seed;
      cat.legs[0].position.y = 0.055 + Math.max(0, Math.sin(phase)) * 0.035;
      cat.legs[1].position.y = 0.055 + Math.max(0, Math.sin(phase + Math.PI)) * 0.035;
      cat.legs[2].position.y = 0.055 + Math.max(0, Math.sin(phase + Math.PI)) * 0.035;
      cat.legs[3].position.y = 0.055 + Math.max(0, Math.sin(phase)) * 0.035;
      cat.head.rotation.x = 0;
      cat.tail.rotation.z = Math.sin(elapsed * 3 + cat.seed) * 0.15;
    } else if (cat.state === 'sit') {
      resetLegs(cat);
      cat.head.rotation.x = 0;
      cat.tail.rotation.z = Math.sin(elapsed * 2.2 + cat.seed) * 0.4;
      if (cat.stateTimer <= 0) pickNextState(cat, roomData);
    } else if (cat.state === 'meow') {
      resetLegs(cat);
      cat.head.rotation.x = -0.4 + Math.sin(elapsed * 12 + cat.seed) * 0.08;
      cat.tail.rotation.z = Math.sin(elapsed * 5 + cat.seed) * 0.25;
      if (!cat.meowed) {
        cat.meowed = true;
        onMeow?.(cat.colorIdx);
      }
      if (cat.stateTimer <= 0) pickNextState(cat, roomData);
    }

    const grounded = clampCatFloor(cat.x, cat.z, roomData);
    cat.x = grounded.x;
    cat.z = grounded.z;
    cat.group.position.set(cat.x, 0, cat.z);
    cat.group.rotation.y = cat.yaw;
  }
}

export function disposeCats(cats) {
  for (const cat of cats) {
    cat.mat.dispose();
    cat.noseMat.dispose();
  }
}
