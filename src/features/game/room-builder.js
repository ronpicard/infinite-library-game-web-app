// Builds the THREE.Group for a single hexagonal gallery from its
// deterministic room data. Each room draws one of several "ancient library"
// styles from its seed: palettes, columns, cornices, beams and floor mosaics
// differ, but geometry and materials are module-level singletons shared by
// every room. Only per-room instance buffers are created and disposed as
// rooms stream in and out.

import * as THREE from 'three';
import { hashInts, mulberry32 } from '../../lib/random.js';
import {
  HEX_RADIUS,
  HEX_INRADIUS,
  ROOM_HEIGHT,
  dirUnitVector,
  axialToWorld,
} from '../world/hex.js';

export const DOOR_HALF_WIDTH = 1.1;
export const DOOR_HEIGHT = 3.4;
export const VOID_RADIUS = 1.5;
export const RAIL_RADIUS = 1.78;
export const COLUMN_RADIUS = 0.3;
export const COLUMN_RING_RADIUS = HEX_RADIUS - 0.62;
const WALL_T = 0.3;
const WALL_LEN = HEX_RADIUS + 0.45; // slight overlap hides corner seams
const SHELF_SPAN = 5.6;
const BOOK_DEPTH = 0.42;

// ------------------------------------------------------------ ancient styles
const STYLE_DEFS = [
  {
    id: 'oak-hall',
    wall: 0x5a4531,
    trim: 0x2f2114,
    floor: 0x453424,
    ceiling: 0x362a1c,
    shelf: 0x33241a,
    column: 0x3d2c1b,
    accent: 0x584327,
    lampColor: 0xffb877,
    lampIntensity: 42,
    beams: true,
    lampSpots: [[-2.4, 0], [2.4, 0]],
  },
  {
    id: 'sandstone-vault',
    wall: 0x8a7047,
    trim: 0x66502f,
    floor: 0x74603e,
    ceiling: 0x5e4b30,
    shelf: 0x4a3722,
    column: 0x93794f,
    accent: 0x6e5738,
    lampColor: 0xff9a52,
    lampIntensity: 38,
    beams: false,
    lampSpots: [[0, -2.7], [2.35, 1.35], [-2.35, 1.35]],
  },
  {
    id: 'marble-rotunda',
    wall: 0x8c8878,
    trim: 0x57523f,
    floor: 0x3a372f,
    ceiling: 0x6e6a5c,
    shelf: 0x3f3a30,
    column: 0x9a9585,
    accent: 0x615030,
    lampColor: 0xffd9a6,
    lampIntensity: 46,
    beams: false,
    lampSpots: [[-2.4, 0], [2.4, 0]],
  },
  {
    id: 'basalt-archive',
    wall: 0x46464e,
    trim: 0x2c2c33,
    floor: 0x33333a,
    ceiling: 0x2a2a30,
    shelf: 0x2b2320,
    column: 0x3a3a42,
    accent: 0x6a5c32,
    lampColor: 0xffc182,
    lampIntensity: 34,
    beams: false,
    lampSpots: [[0, -2.7], [2.35, 1.35], [-2.35, 1.35]],
  },
  {
    id: 'cedar-scriptorium',
    wall: 0x6b4630,
    trim: 0x3a2417,
    floor: 0x50392a,
    ceiling: 0x42301f,
    shelf: 0x38261a,
    column: 0x4d3220,
    accent: 0x435c3a,
    lampColor: 0xffa763,
    lampIntensity: 40,
    beams: true,
    lampSpots: [[-2.4, 0], [2.4, 0]],
  },
];

const CRIMSON_STYLE = {
  id: 'crimson',
  wall: 0x2c2226,
  trim: 0x1a1214,
  floor: 0x241a1c,
  ceiling: 0x1c1416,
  shelf: 0x1e1512,
  column: 0x241b1e,
  accent: 0x5c1c22,
  lampColor: 0xff2028,
  lampIntensity: 60,
  beams: false,
  lampSpots: [],
};

// Subtle plaster/stone speckle shared by every wall and floor material.
const noiseTexture = (() => {
  const size = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 222 + Math.floor(Math.random() * 33);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
})();

function makeStyleMaterials(def) {
  const std = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, map: noiseTexture, ...extra });
  return {
    def,
    wall: std(def.wall),
    trim: std(def.trim, { map: null, roughness: 0.8 }),
    floor: std(def.floor, { roughness: 1 }),
    ceiling: std(def.ceiling, { map: null, roughness: 1 }),
    shelf: std(def.shelf, { map: null, roughness: 0.85 }),
    column: std(def.column, { roughness: 0.9 }),
    accent: std(def.accent, { map: null, roughness: 0.9 }),
    lamp: new THREE.MeshStandardMaterial({
      color: 0x201205,
      emissive: def.lampColor,
      emissiveIntensity: 2.4,
    }),
  };
}

const styleMats = STYLE_DEFS.map(makeStyleMaterials);
const crimsonMats = makeStyleMaterials(CRIMSON_STYLE);

export function styleIndexForSeed(seed) {
  return hashInts(seed, 0x571e) % STYLE_DEFS.length;
}

// ---------------------------------------------------------- shared materials
const mats = {
  book: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
  rail: new THREE.MeshStandardMaterial({
    color: 0x241a12,
    roughness: 0.5,
    metalness: 0.55,
  }),
  ghost: new THREE.MeshBasicMaterial({ color: 0x171008 }),
  ghostFloor: new THREE.MeshBasicMaterial({ color: 0x2a1d10, side: THREE.DoubleSide }),
  ghostLamp: new THREE.MeshBasicMaterial({ color: 0xc98a48 }),
  pedestal: new THREE.MeshStandardMaterial({ color: 0x2a1214, roughness: 0.6 }),
  crimsonBook: new THREE.MeshStandardMaterial({
    color: 0x1a0204,
    emissive: 0xff1626,
    emissiveIntensity: 2.6,
    roughness: 0.4,
  }),
  crimsonSpines: new THREE.MeshStandardMaterial({ color: 0x1a0608, roughness: 0.95 }),
};

// ---------------------------------------------------------------- geometries
const box = new THREE.BoxGeometry(1, 1, 1);
const lampSphere = new THREE.SphereGeometry(0.22, 16, 12);
const railBaluster = new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6);
const railTop = new THREE.TorusGeometry(RAIL_RADIUS, 0.05, 8, 36);
const pedestalGeo = new THREE.CylinderGeometry(0.42, 0.55, 1.1, 20);
const crimsonBookGeo = new THREE.BoxGeometry(0.5, 0.12, 0.68);
const columnGeo = new THREE.CylinderGeometry(COLUMN_RADIUS, COLUMN_RADIUS * 1.12, ROOM_HEIGHT, 10);
const mosaicGeo = new THREE.RingGeometry(RAIL_RADIUS + 0.45, RAIL_RADIUS + 1.35, 48, 1);

function hexShape(withHole) {
  const shape = new THREE.Shape();
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    const x = Math.cos(a) * HEX_RADIUS;
    const y = Math.sin(a) * HEX_RADIUS;
    if (k === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  if (withHole) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, VOID_RADIUS, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return shape;
}

const hexWithHoleGeo = new THREE.ShapeGeometry(hexShape(true), 24);
const hexSolidGeo = new THREE.ShapeGeometry(hexShape(false), 6);

// Shelf band: books live between these heights; row positions depend on
// how many rows this particular room has.
const SHELF_BOTTOM = 0.55;
const SHELF_TOP = 4.45;

function shelfRowYs(rows) {
  const step = (SHELF_TOP - SHELF_BOTTOM) / rows;
  return Array.from({ length: rows }, (_, k) => SHELF_BOTTOM + k * step);
}

// ------------------------------------------------------------------- helpers
function tangentOf(n) {
  return { x: -n.z, z: n.x };
}

function addBox(group, material, w, h, t, cx, cy, cz, yaw) {
  const m = new THREE.Mesh(box, material);
  m.scale.set(w, h, t);
  m.position.set(cx, cy, cz);
  m.rotation.y = yaw;
  group.add(m);
  return m;
}

function wallTransform(dirIndex) {
  const n = dirUnitVector(dirIndex);
  const t = tangentOf(n);
  const yaw = Math.atan2(n.x, n.z);
  return { n, t, yaw };
}

/** Place a box on wall `dirIndex`: offsets are (tangent, height, normal). */
function addWallBox(group, material, dirIndex, w, h, depth, tanOff, y, normalDist) {
  const { n, t, yaw } = wallTransform(dirIndex);
  const cx = n.x * normalDist + t.x * tanOff;
  const cz = n.z * normalDist + t.z * tanOff;
  return addBox(group, material, w, h, depth, cx, y, cz, yaw);
}

function buildSolidWall(group, sm, dirIndex) {
  addWallBox(group, sm.wall, dirIndex, WALL_LEN, ROOM_HEIGHT, WALL_T, 0, ROOM_HEIGHT / 2, HEX_INRADIUS + WALL_T / 2);
}

function buildDoorway(group, sm, dirIndex) {
  const sideW = (WALL_LEN - DOOR_HALF_WIDTH * 2) / 2;
  const off = DOOR_HALF_WIDTH + sideW / 2;
  const nd = HEX_INRADIUS + WALL_T / 2;
  addWallBox(group, sm.wall, dirIndex, sideW, ROOM_HEIGHT, WALL_T, off, ROOM_HEIGHT / 2, nd);
  addWallBox(group, sm.wall, dirIndex, sideW, ROOM_HEIGHT, WALL_T, -off, ROOM_HEIGHT / 2, nd);
  const lintelH = ROOM_HEIGHT - DOOR_HEIGHT;
  addWallBox(group, sm.wall, dirIndex, DOOR_HALF_WIDTH * 2, lintelH, WALL_T, 0, DOOR_HEIGHT + lintelH / 2, nd);
  // Stone/wood door frame: posts, a stepped lintel and a keystone.
  addWallBox(group, sm.trim, dirIndex, 0.22, DOOR_HEIGHT, 0.55, DOOR_HALF_WIDTH + 0.05, DOOR_HEIGHT / 2, nd);
  addWallBox(group, sm.trim, dirIndex, 0.22, DOOR_HEIGHT, 0.55, -(DOOR_HALF_WIDTH + 0.05), DOOR_HEIGHT / 2, nd);
  addWallBox(group, sm.trim, dirIndex, DOOR_HALF_WIDTH * 2 + 0.55, 0.24, 0.55, 0, DOOR_HEIGHT + 0.1, nd);
  addWallBox(group, sm.accent, dirIndex, 0.4, 0.34, 0.58, 0, DOOR_HEIGHT + 0.12, nd);
}

function buildShelfFrame(group, sm, dirIndex, rowYs) {
  buildSolidWall(group, sm, dirIndex);
  const nd = HEX_INRADIUS - 0.3;
  addWallBox(group, sm.shelf, dirIndex, 0.12, 4.5, 0.62, SHELF_SPAN / 2 + 0.1, 2.25, nd);
  addWallBox(group, sm.shelf, dirIndex, 0.12, 4.5, 0.62, -(SHELF_SPAN / 2 + 0.1), 2.25, nd);
  for (const y0 of rowYs) {
    addWallBox(group, sm.shelf, dirIndex, SHELF_SPAN + 0.2, 0.07, 0.62, 0, y0 - 0.05, nd);
  }
  addWallBox(group, sm.shelf, dirIndex, SHELF_SPAN + 0.2, 0.07, 0.62, 0, SHELF_TOP + 0.05, nd);
  // Carved top rail above the shelf unit.
  addWallBox(group, sm.trim, dirIndex, SHELF_SPAN + 0.4, 0.16, 0.7, 0, 4.62, nd);
}

function buildColumns(group, sm) {
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    const x = Math.cos(a) * COLUMN_RING_RADIUS;
    const z = Math.sin(a) * COLUMN_RING_RADIUS;
    const col = new THREE.Mesh(columnGeo, sm.column);
    col.position.set(x, ROOM_HEIGHT / 2, z);
    group.add(col);
    // Base and capital.
    addBox(group, sm.trim, 0.72, 0.22, 0.72, x, 0.11, z, a);
    addBox(group, sm.trim, 0.66, 0.18, 0.66, x, ROOM_HEIGHT - 0.34, z, a);
  }
}

function buildCornice(group, sm) {
  for (let k = 0; k < 6; k++) {
    addWallBox(group, sm.trim, k, WALL_LEN - 0.3, 0.22, 0.42, 0, ROOM_HEIGHT - 0.28, HEX_INRADIUS - 0.12);
  }
}

/** Hexagonal ring of ceiling beams linking the columns (wood styles). */
function buildBeams(group, sm) {
  const beamRadius = COLUMN_RING_RADIUS * Math.cos(Math.PI / 6);
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    const cx = Math.cos(a) * beamRadius;
    const cz = Math.sin(a) * beamRadius;
    addBox(group, sm.trim, COLUMN_RING_RADIUS, 0.3, 0.26, cx, ROOM_HEIGHT - 0.6, cz, -a + Math.PI / 2);
  }
}

const IVORY = new THREE.Color(0xd9cba6);
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();
const tmpColor = new THREE.Color();

function spineColor(rng, out) {
  const roll = rng();
  if (roll < 0.45) out.setHSL(0.05 + rng() * 0.05, 0.3 + rng() * 0.25, 0.16 + rng() * 0.1);
  else if (roll < 0.7) out.setHSL(0.02 + rng() * 0.02, 0.45 + rng() * 0.2, 0.14 + rng() * 0.08);
  else if (roll < 0.88) out.setHSL(0.11 + rng() * 0.04, 0.3 + rng() * 0.2, 0.17 + rng() * 0.08);
  else out.setHSL(0.58 + rng() * 0.05, 0.15 + rng() * 0.15, 0.16 + rng() * 0.08);
  return out;
}

/**
 * One InstancedMesh holding every present book in the room. Book identity
 * (the index used by the text system) is
 * index = wallSlot * rows * perRow + row * perRow + col;
 * gaps are skipped, so `bookIndexMap[instanceId]` recovers the identity.
 */
function buildBooks(roomData, darkVariant) {
  const { rows, perRow, missing, flat } = roomData;
  const presentCount = roomData.bookCount - missing.size;
  const mesh = new THREE.InstancedMesh(
    box,
    darkVariant ? mats.crimsonSpines : mats.book,
    presentCount
  );
  mesh.frustumCulled = false;
  const baseColors = new Float32Array(presentCount * 3);
  const bookIndexMap = new Array(presentCount);
  const coherentInstances = [];
  const rng = mulberry32(roomData.seed ^ 0xb0b0);
  const pitch = SHELF_SPAN / perRow;
  const rowYs = shelfRowYs(rows);
  const rowStep = (SHELF_TOP - SHELF_BOTTOM) / rows;
  const maxH = Math.min(0.9, rowStep - 0.22);
  const euler = new THREE.Euler();

  let i = 0;
  for (let w = 0; w < roomData.shelfWalls.length; w++) {
    const dirIndex = roomData.shelfWalls[w];
    const { n, t, yaw } = wallTransform(dirIndex);
    const nd = HEX_INRADIUS - 0.3 - BOOK_DEPTH / 2 + 0.06;
    for (let row = 0; row < rows; row++) {
      const y0 = rowYs[row];
      for (let col = 0; col < perRow; col++) {
        const index = w * rows * perRow + row * perRow + col;
        // Keep the rng call count identical for every slot so gaps don't
        // reshuffle the appearance of every book after them.
        const jitter = rng();
        const hRoll = rng();
        const wRoll = rng();
        const leanRoll = rng();
        const leanAmt = rng();
        if (missing.has(index)) continue;
        const isFlat = flat.has(index);
        const tanOff = -SHELF_SPAN / 2 + pitch * (col + 0.5) + (jitter - 0.5) * 0.03;
        const h = maxH * (0.72 + hRoll * 0.28);
        const spineW = pitch * (0.68 + wRoll * 0.24);
        if (isFlat) {
          // A volume left lying on the shelf.
          tmpPos.set(n.x * nd + t.x * tanOff, y0 + 0.05, n.z * nd + t.z * tanOff);
          euler.set(0, yaw + (leanAmt - 0.5) * 0.5, 0);
          tmpQuat.setFromEuler(euler);
          tmpScale.set(h * 0.75, spineW * 1.1, BOOK_DEPTH * 1.05);
        } else {
          const lean = leanRoll < 0.08 ? (leanAmt - 0.5) * 0.14 : 0;
          tmpPos.set(n.x * nd + t.x * tanOff, y0 + h / 2, n.z * nd + t.z * tanOff);
          euler.set(0, yaw, lean);
          tmpQuat.setFromEuler(euler);
          tmpScale.set(spineW, h, BOOK_DEPTH * (0.85 + jitter * 0.15));
        }
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
        mesh.setMatrixAt(i, tmpMatrix);
        const isCoherent = !darkVariant && roomData.coherent.has(index);
        if (isCoherent) {
          tmpColor.copy(IVORY);
          coherentInstances.push(i);
        } else {
          spineColor(rng, tmpColor);
        }
        if (darkVariant) tmpColor.multiplyScalar(0.25);
        mesh.setColorAt(i, tmpColor);
        baseColors[i * 3] = tmpColor.r;
        baseColors[i * 3 + 1] = tmpColor.g;
        baseColors[i * 3 + 2] = tmpColor.b;
        bookIndexMap[i] = index;
        i += 1;
      }
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return { mesh, baseColors, bookIndexMap, coherentInstances };
}

/** Dim silhouette of a gallery, placed above and below the void. */
function buildGhostRoom(yOffset) {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(hexWithHoleGeo, mats.ghostFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.04; // avoid z-fighting with the real ceiling plane
  g.add(floor);
  const ring = new THREE.Mesh(railTop, mats.ghost);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.02;
  g.add(ring);
  for (let k = 0; k < 6; k++) {
    addWallBox(g, mats.ghost, k, WALL_LEN, ROOM_HEIGHT, WALL_T, 0, ROOM_HEIGHT / 2, HEX_INRADIUS + WALL_T / 2);
    addWallBox(g, mats.ghost, k, SHELF_SPAN, 4.4, 0.6, 0, 2.25, HEX_INRADIUS - 0.35);
  }
  for (const sx of [-2.4, 2.4]) {
    const lampDot = new THREE.Mesh(lampSphere, mats.ghostLamp);
    lampDot.position.set(sx, ROOM_HEIGHT - 0.5, 0);
    g.add(lampDot);
  }
  g.position.y = yOffset;
  return g;
}

// ------------------------------------------------------- arcane decorations
// A band of invented glyphs drawn in a circle; mapped onto a flat ring that
// slowly revolves around the void like a warding circle.
const runeRingTexture = (() => {
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.translate(size / 2, size / 2);
  g.strokeStyle = 'rgba(255, 214, 160, 0.9)';
  g.lineWidth = 3;
  const radius = size * 0.42;
  const glyphs = 42;
  for (let k = 0; k < glyphs; k++) {
    const a = (k / glyphs) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.translate(radius, 0);
    g.rotate(Math.PI / 2);
    // Random little stroke clusters read as script from a distance.
    const strokes = 2 + Math.floor(Math.random() * 3);
    for (let s = 0; s < strokes; s++) {
      g.beginPath();
      const x0 = (Math.random() - 0.5) * 14;
      const y0 = (Math.random() - 0.5) * 16;
      g.moveTo(x0, y0);
      if (Math.random() < 0.4) {
        g.arc(x0, y0, 3 + Math.random() * 4, 0, Math.PI * (0.5 + Math.random()));
      } else {
        g.lineTo(x0 + (Math.random() - 0.5) * 16, y0 + (Math.random() - 0.5) * 18);
      }
      g.stroke();
    }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  return tex;
})();

const runeRingGeo = new THREE.RingGeometry(RAIL_RADIUS + 0.5, RAIL_RADIUS + 1.15, 48, 1);
const runeRingMat = new THREE.MeshBasicMaterial({
  map: runeRingTexture,
  transparent: true,
  opacity: 0.34,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  color: 0xffc98a,
});
const runeRingMatCrimson = runeRingMat.clone();
runeRingMatCrimson.color.set(0xff2a33);
runeRingMatCrimson.opacity = 0.5;

// A single hand-drawn glyph used for the motes that rise through the void.
const glyphTexture = (() => {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.strokeStyle = 'rgba(255, 224, 180, 1)';
  g.lineWidth = 4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(20, 46);
  g.lineTo(32, 14);
  g.lineTo(44, 46);
  g.moveTo(24, 34);
  g.lineTo(40, 34);
  g.moveTo(32, 46);
  g.arc(32, 50, 6, -Math.PI, 0);
  g.stroke();
  return new THREE.CanvasTexture(cv);
})();

// Soft halo for lamps.
const haloTexture = (() => {
  const size = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,214,160,0.9)');
  grad.addColorStop(0.35, 'rgba(255,190,120,0.28)');
  grad.addColorStop(1, 'rgba(255,190,120,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
})();

const haloMat = new THREE.SpriteMaterial({
  map: haloTexture,
  transparent: true,
  opacity: 0.5,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const shaftGeo = new THREE.CylinderGeometry(
  VOID_RADIUS * 0.92,
  VOID_RADIUS * 0.92,
  ROOM_HEIGHT,
  24,
  1,
  true
);

/** Glyph motes slowly spiraling up through the void shaft. */
function buildGlyphs(rng, crimson) {
  const count = 12;
  const positions = new Float32Array(count * 3);
  const data = [];
  for (let i = 0; i < count; i++) {
    data.push({
      angle: rng() * Math.PI * 2,
      radius: 0.35 + rng() * 0.95,
      y: rng() * ROOM_HEIGHT,
      speed: 0.14 + rng() * 0.22,
      spin: 0.15 + rng() * 0.3,
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: glyphTexture,
    color: crimson ? 0xff4a4a : 0xffd9a0,
    size: 0.16,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, data };
}

// Soft circular sprite so motes don't render as hard squares.
const dustTexture = (() => {
  const size = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,230,190,1)');
  grad.addColorStop(0.4, 'rgba(255,230,190,0.45)');
  grad.addColorStop(1, 'rgba(255,230,190,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(cv);
})();

function buildDust(rng, count) {
  const positions = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const rad = 0.6 + rng() * 4.9;
    base[i * 3] = Math.cos(a) * rad;
    base[i * 3 + 1] = 0.4 + rng() * 4.0;
    base[i * 3 + 2] = Math.sin(a) * rad;
    phase[i] = rng() * Math.PI * 2;
  }
  positions.set(base);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffdca8,
    size: 0.05,
    map: dustTexture,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, base, phase };
}

/**
 * Build a full gallery. Returns handles the engine needs for interaction,
 * animation and disposal.
 */
export function buildRoom(roomData, { crimson = false } = {}) {
  const group = new THREE.Group();
  const center = axialToWorld(roomData.q, roomData.r);
  group.position.set(center.x, 0, center.z);

  const base = crimson ? crimsonMats : styleMats[styleIndexForSeed(roomData.seed)];
  const def = base.def;

  // Per-room palette drift: clone the tintable materials and nudge their hue
  // and lightness so no two galleries feel identical. Cloned materials share
  // textures and are disposed with the room.
  const tinted = [];
  const tint = (mat) => {
    const m = mat.clone();
    m.color.offsetHSL(roomData.hueJitter, 0, roomData.lightJitter);
    tinted.push(m);
    return m;
  };
  const sm = {
    ...base,
    wall: tint(base.wall),
    floor: tint(base.floor),
    column: tint(base.column),
    accent: tint(base.accent),
  };

  const floor = new THREE.Mesh(crimson ? hexSolidGeo : hexWithHoleGeo, sm.floor);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const ceiling = new THREE.Mesh(crimson ? hexSolidGeo : hexWithHoleGeo, sm.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  group.add(ceiling);

  const rowYs = shelfRowYs(roomData.rows);
  for (let k = 0; k < 6; k++) {
    if (roomData.doors.includes(k)) buildDoorway(group, sm, k);
    else buildShelfFrame(group, sm, k, rowYs);
  }

  buildColumns(group, sm);
  buildCornice(group, sm);
  if (def.beams) buildBeams(group, sm);

  if (!crimson) {
    // Worn mosaic band around the void.
    const mosaic = new THREE.Mesh(mosaicGeo, sm.accent);
    mosaic.rotation.x = -Math.PI / 2;
    mosaic.position.y = 0.015;
    group.add(mosaic);
  }

  const rng = mulberry32(roomData.seed ^ 0xd057);

  // Warding circle of glyphs revolving around the void.
  const runeRing = new THREE.Mesh(runeRingGeo, crimson ? runeRingMatCrimson : runeRingMat);
  runeRing.rotation.x = -Math.PI / 2;
  runeRing.position.y = 0.03;
  group.add(runeRing);
  const runeSpin = (rng() < 0.5 ? 1 : -1) * (0.03 + rng() * 0.05);

  // Faint light shaft in the void, and glyph motes drifting up through it.
  const shaftMat = new THREE.MeshBasicMaterial({
    color: crimson ? 0xff2a33 : 0xffc98a,
    transparent: true,
    opacity: 0.045,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shaft = new THREE.Mesh(shaftGeo, shaftMat);
  shaft.position.y = ROOM_HEIGHT / 2;
  group.add(shaft);

  const glyphs = buildGlyphs(rng, crimson);
  group.add(glyphs.points);

  const { mesh: books, baseColors, bookIndexMap, coherentInstances } = buildBooks(
    roomData,
    crimson
  );
  group.add(books);

  let crimsonBook = null;
  let ember = null;
  const halos = [];
  let light;
  if (crimson) {
    const pedestal = new THREE.Mesh(pedestalGeo, mats.pedestal);
    pedestal.position.y = 0.55;
    group.add(pedestal);
    crimsonBook = new THREE.Mesh(crimsonBookGeo, mats.crimsonBook);
    crimsonBook.position.y = 1.22;
    crimsonBook.rotation.y = 0.6;
    group.add(crimsonBook);
    light = new THREE.PointLight(0xff2028, 60, 24, 2);
    light.position.set(0, 3.4, 0);
    group.add(light);
    ember = new THREE.PointLight(0xff5533, 14, 8, 2);
    ember.position.set(0, 1.8, 0);
    group.add(ember);
  } else {
    // Open railing around the void: balusters + a top ring.
    const balusters = 16;
    for (let k = 0; k < balusters; k++) {
      const a = (k / balusters) * Math.PI * 2;
      const b = new THREE.Mesh(railBaluster, mats.rail);
      b.position.set(Math.cos(a) * RAIL_RADIUS, 0.5, Math.sin(a) * RAIL_RADIUS);
      group.add(b);
    }
    const top = new THREE.Mesh(railTop, mats.rail);
    top.rotation.x = Math.PI / 2;
    top.position.y = 1.02;
    group.add(top);

    for (const [sx, sz] of def.lampSpots) {
      const lamp = new THREE.Mesh(lampSphere, sm.lamp);
      lamp.position.set(sx, ROOM_HEIGHT - 0.55, sz);
      group.add(lamp);
      const halo = new THREE.Sprite(haloMat);
      halo.position.set(sx, ROOM_HEIGHT - 0.55, sz);
      halo.scale.setScalar(1.5);
      group.add(halo);
      halos.push(halo);
    }
    light = new THREE.PointLight(def.lampColor, def.lampIntensity * roomData.lampJitter, 26, 2);
    light.color.offsetHSL(roomData.hueJitter * 0.6, 0, 0);
    light.position.set(0, 3.7, 0);
    group.add(light);

    group.add(buildGhostRoom(-ROOM_HEIGHT));
    group.add(buildGhostRoom(ROOM_HEIGHT));
  }

  const dust = buildDust(rng, roomData.dustCount);
  group.add(dust.points);

  return {
    group,
    books,
    baseColors,
    bookIndexMap,
    coherentInstances,
    dust,
    glyphs,
    runeRing,
    runeSpin,
    shaft,
    halos,
    light,
    ember,
    baseIntensity: light.intensity,
    crimsonBook,
    data: roomData,
    dispose() {
      books.dispose();
      dust.points.geometry.dispose();
      dust.points.material.dispose();
      glyphs.points.geometry.dispose();
      glyphs.points.material.dispose();
      shaftMat.dispose();
      for (const m of tinted) m.dispose();
    },
  };
}
