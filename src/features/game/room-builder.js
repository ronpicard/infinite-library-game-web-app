// Builds the THREE.Group for a single hexagonal gallery from its
// deterministic room data. Each room draws one of several "ancient library"
// styles from its seed: palettes, columns, cornices, beams, and unique
// floor/wall patterns. Shared geometries stay module-level; per-room
// materials, instance buffers and pattern textures are disposed as rooms
// stream out.

import * as THREE from 'three';
import { hashInts, mulberry32 } from '../../lib/random.js';
import {
  HEX_RADIUS,
  HEX_INRADIUS,
  ROOM_HEIGHT,
  dirUnitVector,
  axialToWorld,
} from '../world/hex.js';
import { createRoomCats, disposeCats } from './library-cats.js';
import { createFlowBeings, disposeFlowBeings } from './flow-beings.js';
import { createSurfacePatternTexture, makePatternSpec } from './surface-pattern.js';
import {
  COLUMN_RADIUS,
  COLUMN_RING_RADIUS,
  DOOR_FRAME_ND,
  DOOR_FRAME_THICKNESS,
  DOOR_HALF_WIDTH,
  DOOR_HEIGHT,
  DOOR_PASS_HALF,
  DOOR_SILL,
  RAIL_RADIUS,
} from './floor-clamp.js';

export {
  DOOR_HALF_WIDTH,
  DOOR_PASS_HALF,
  DOOR_HEIGHT,
  RAIL_RADIUS,
  COLUMN_RADIUS,
  COLUMN_RING_RADIUS,
} from './floor-clamp.js';

export const VOID_RADIUS = 1.5;
/** Wall and column bases sit above the floor plane so box bottom faces do not z-fight. */
const WALL_FLOOR_GAP = 0.05;
const WALL_T = 0.3;
/** Solid shelf walls stay slightly inset; door frames use DOOR_FRAME_ND instead. */
const WALL_ND = HEX_INRADIUS - WALL_T / 2 - 0.02;
const WALL_LEN = HEX_RADIUS + 0.45; // slight overlap hides corner seams
const SHELF_SPAN = 5.6;
const BOOK_DEPTH = 0.42;

// ------------------------------------------------------------ ancient styles
const STYLE_DEFS = [
  {
    id: 'oak-hall',
    wall: 0x6e5640,
    trim: 0x2f2114,
    floor: 0x5c4632,
    ceiling: 0x362a1c,
    shelf: 0x33241a,
    column: 0x3d2c1b,
    accent: 0x584327,
    lampColor: 0xffb877,
    lampIntensity: 50,
    beams: true,
    lampSpots: [[-2.4, 0], [2.4, 0]],
  },
  {
    id: 'sandstone-vault',
    wall: 0x9a7e54,
    trim: 0x66502f,
    floor: 0x86704a,
    ceiling: 0x5e4b30,
    shelf: 0x4a3722,
    column: 0x93794f,
    accent: 0x6e5738,
    lampColor: 0xff9a52,
    lampIntensity: 46,
    beams: false,
    lampSpots: [[0, -2.7], [2.35, 1.35], [-2.35, 1.35]],
  },
  {
    id: 'marble-rotunda',
    wall: 0x9a9686,
    trim: 0x57523f,
    floor: 0x4e4a40,
    ceiling: 0x6e6a5c,
    shelf: 0x3f3a30,
    column: 0x9a9585,
    accent: 0x615030,
    lampColor: 0xffd9a6,
    lampIntensity: 54,
    beams: false,
    lampSpots: [[-2.4, 0], [2.4, 0]],
  },
  {
    id: 'basalt-archive',
    wall: 0x5c5c66,
    trim: 0x2c2c33,
    floor: 0x4a4a54,
    ceiling: 0x2a2a30,
    shelf: 0x2b2320,
    column: 0x3a3a42,
    accent: 0x6a5c32,
    lampColor: 0xffc182,
    lampIntensity: 50,
    beams: false,
    lampSpots: [[0, -2.7], [2.35, 1.35], [-2.35, 1.35]],
  },
  {
    id: 'cedar-scriptorium',
    wall: 0x7a5340,
    trim: 0x3a2417,
    floor: 0x624632,
    ceiling: 0x42301f,
    shelf: 0x38261a,
    column: 0x4d3220,
    accent: 0x435c3a,
    lampColor: 0xffa763,
    lampIntensity: 48,
    beams: true,
    lampSpots: [[-2.4, 0], [2.4, 0]],
  },
];

const CRIMSON_STYLE = {
  id: 'crimson',
  wall: 0x503840,
  trim: 0x2a1c20,
  floor: 0x443038,
  ceiling: 0x2c2024,
  shelf: 0x2a2018,
  column: 0x34282c,
  accent: 0x7a2830,
  lampColor: 0xff4850,
  lampIntensity: 82,
  beams: false,
  lampSpots: [[-2.4, 0], [2.4, 0]],
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
    wall: std(def.wall, { map: null }),
    trim: std(def.trim, { map: null, roughness: 0.8 }),
    floor: std(def.floor, {
      map: null,
      roughness: 1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
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
  // Lift any segment whose bottom would sit on the floor — otherwise the
  // horizontal bottom face coplanars with the floor mesh and z-fights,
  // especially visible as black speckle at door jambs.
  let cy = y;
  let bh = h;
  const bottom = y - h / 2;
  if (bottom < WALL_FLOOR_GAP + 0.01) {
    bh = h - WALL_FLOOR_GAP;
    cy = WALL_FLOOR_GAP + bh / 2;
  }
  return addBox(group, material, w, bh, depth, cx, cy, cz, yaw);
}

function buildSolidWall(group, sm, dirIndex) {
  addWallBox(group, sm.wall, dirIndex, WALL_LEN, ROOM_HEIGHT, WALL_T, 0, ROOM_HEIGHT / 2, WALL_ND);
}

function buildDoorway(group, sm, dirIndex) {
  const sideW = (WALL_LEN - DOOR_HALF_WIDTH * 2) / 2;
  const off = DOOR_HALF_WIDTH + sideW / 2;
  const nd = DOOR_FRAME_ND;
  const ft = DOOR_FRAME_THICKNESS;
  addWallBox(group, sm.wall, dirIndex, sideW, ROOM_HEIGHT, ft, off, ROOM_HEIGHT / 2, nd);
  addWallBox(group, sm.wall, dirIndex, sideW, ROOM_HEIGHT, ft, -off, ROOM_HEIGHT / 2, nd);
  const lintelH = ROOM_HEIGHT - DOOR_HEIGHT;
  addWallBox(group, sm.wall, dirIndex, DOOR_HALF_WIDTH * 2, lintelH, ft, 0, DOOR_HEIGHT + lintelH / 2, nd);
  // Jambs sit flush with the opening edge so no void shows through as black
  // vertical stripes on the sides.
  const jambW = 0.14;
  const jambD = ft + 0.02;
  const jambTan = DOOR_HALF_WIDTH - jambW / 2;
  const jambH = DOOR_HEIGHT - WALL_FLOOR_GAP;
  addWallBox(group, sm.trim, dirIndex, jambW, jambH, jambD, jambTan, WALL_FLOOR_GAP + jambH / 2, nd);
  addWallBox(group, sm.trim, dirIndex, jambW, jambH, jambD, -jambTan, WALL_FLOOR_GAP + jambH / 2, nd);
  addWallBox(group, sm.trim, dirIndex, DOOR_HALF_WIDTH * 2 + 0.16, 0.12, jambD, 0, DOOR_SILL + 0.06, nd);
  addWallBox(group, sm.accent, dirIndex, 0.32, 0.22, 0.24, 0, DOOR_HEIGHT + 0.08, nd);
  // Flat threshold across the opening hides the floor seam between adjacent
  // galleries and covers the lifted jamb corners.
  const thH = 0.055;
  addWallBox(
    group,
    sm.floor,
    dirIndex,
    DOOR_HALF_WIDTH * 2 + 0.28,
    thH,
    0.52,
    0,
    thH / 2 + 0.006,
    nd - 0.05
  );
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
    col.position.set(x, WALL_FLOOR_GAP + ROOM_HEIGHT / 2, z);
    group.add(col);
    // Base and capital.
    addBox(group, sm.trim, 0.72, 0.22, 0.72, x, WALL_FLOOR_GAP + 0.11, z, a);
    addBox(group, sm.trim, 0.66, 0.18, 0.66, x, ROOM_HEIGHT - 0.34, z, a);
  }
}

function buildCornice(group, sm, doors) {
  for (let k = 0; k < 6; k++) {
    const nd = HEX_INRADIUS - 0.12;
    const y = ROOM_HEIGHT - 0.28;
    if (doors.includes(k)) {
      const sideW = (WALL_LEN - 0.3 - DOOR_HALF_WIDTH * 2) / 2;
      const off = DOOR_HALF_WIDTH + sideW / 2 + 0.08;
      addWallBox(group, sm.trim, k, sideW, 0.22, 0.42, off, y, nd);
      addWallBox(group, sm.trim, k, sideW, 0.22, 0.42, -off, y, nd);
    } else {
      addWallBox(group, sm.trim, k, WALL_LEN - 0.3, 0.22, 0.42, 0, y, nd);
    }
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

const IVORY = new THREE.Color(0xfff4dc);
const MARKED_EMISSIVE = {
  clue: new THREE.Color(0xff8844),
};
const markedBookMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xff9944,
  emissiveIntensity: 1.45,
  roughness: 0.35,
  metalness: 0.08,
});
export { markedBookMat };
const ribbonGeo = new THREE.PlaneGeometry(0.06, 0.28);
const ribbonMat = new THREE.MeshBasicMaterial({
  color: 0xff6644,
  transparent: true,
  opacity: 0.95,
  side: THREE.DoubleSide,
  depthWrite: false,
});
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
  const rng = mulberry32(roomData.seed ^ 0xb0b0);
  const pitch = SHELF_SPAN / perRow;
  const rowYs = shelfRowYs(rows);
  const rowStep = (SHELF_TOP - SHELF_BOTTOM) / rows;
  const maxH = Math.min(0.9, rowStep - 0.22);
  const euler = new THREE.Euler();
  const markedEntries = []; // readable volumes: protrude from the shelf

  let i = 0;
  for (let w = 0; w < roomData.shelfWalls.length; w++) {
    const dirIndex = roomData.shelfWalls[w];
    const { n, t, yaw } = wallTransform(dirIndex);
    const nd = HEX_INRADIUS - 0.3 - BOOK_DEPTH / 2 + 0.06;
    for (let row = 0; row < rows; row++) {
      const y0 = rowYs[row];
      for (let col = 0; col < perRow; col++) {
        const index = w * rows * perRow + row * perRow + col;
        const jitter = rng();
        const hRoll = rng();
        const wRoll = rng();
        const leanRoll = rng();
        const leanAmt = rng();
        if (missing.has(index)) continue;
        const isFlat = flat.has(index);
        const isMarked = !darkVariant && roomData.readable.has(index);
        const tanOff = -SHELF_SPAN / 2 + pitch * (col + 0.5) + (jitter - 0.5) * 0.03;
        const h = maxH * (0.72 + hRoll * 0.28);
        const spineW = pitch * (0.68 + wRoll * 0.24);
        const protrude = isMarked ? 0.2 : 0;
        const ndUse = nd - protrude;
        if (isFlat) {
          tmpPos.set(n.x * ndUse + t.x * tanOff, y0 + 0.05, n.z * ndUse + t.z * tanOff);
          euler.set(0, yaw + (leanAmt - 0.5) * 0.5, 0);
          tmpQuat.setFromEuler(euler);
          tmpScale.set(h * 0.75, spineW * 1.1, BOOK_DEPTH * 1.05);
        } else {
          const lean = leanRoll < 0.08 ? (leanAmt - 0.5) * 0.14 : 0;
          tmpPos.set(n.x * ndUse + t.x * tanOff, y0 + h / 2, n.z * ndUse + t.z * tanOff);
          euler.set(0, yaw, lean);
          tmpQuat.setFromEuler(euler);
          const scaleBoost = isMarked ? 1.28 : 1;
          tmpScale.set(spineW * scaleBoost, h * scaleBoost, BOOK_DEPTH * (0.85 + jitter * 0.15));
        }
        tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
        mesh.setMatrixAt(i, tmpMatrix);
        spineColor(rng, tmpColor);
        if (darkVariant) tmpColor.multiplyScalar(0.25);
        mesh.setColorAt(i, tmpColor);
        baseColors[i * 3] = tmpColor.r;
        baseColors[i * 3 + 1] = tmpColor.g;
        baseColors[i * 3 + 2] = tmpColor.b;
        bookIndexMap[i] = index;
        if (isMarked) {
          const kind = roomData.coherent.get(index)?.kind ?? 'clue';
          markedEntries.push({
            index,
            kind,
            matrix: tmpMatrix.clone(),
            ribbonY: isFlat ? y0 + 0.22 : y0 + h + 0.08,
            ribbonPos: tmpPos.clone(),
            normal: n,
            yaw,
          });
        }
        i += 1;
      }
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  const marked = buildMarkedVolumes(markedEntries, darkVariant);
  return { mesh, baseColors, bookIndexMap, marked };
}

/** Glowing marked spines + silk ribbons — the only volumes you can open. */
function buildMarkedVolumes(entries, darkVariant) {
  if (entries.length === 0 || darkVariant) {
    return { mesh: null, indexMap: [], ribbons: null, positions: [], kinds: [] };
  }
  const count = entries.length;
  const markedMesh = new THREE.InstancedMesh(box, markedBookMat, count);
  markedMesh.frustumCulled = false;
  const indexMap = [];
  const kinds = [];
  const positions = [];
  const emissiveColors = [];

  for (let i = 0; i < count; i++) {
    const e = entries[i];
    markedMesh.setMatrixAt(i, e.matrix);
    indexMap.push(e.index);
    kinds.push(e.kind);
    markedMesh.setColorAt(i, IVORY);
    emissiveColors.push(MARKED_EMISSIVE.clue);
    positions.push(e.ribbonPos.x, e.ribbonPos.y + 0.12, e.ribbonPos.z);
  }
  markedMesh.instanceMatrix.needsUpdate = true;
  markedMesh.instanceColor.needsUpdate = true;

  const ribbons = new THREE.InstancedMesh(ribbonGeo, ribbonMat, count);
  ribbons.frustumCulled = false;
  for (let i = 0; i < count; i++) {
    const e = entries[i];
    tmpPos.copy(e.ribbonPos);
    tmpPos.y = e.ribbonY;
    tmpQuat.setFromEuler(new THREE.Euler(0, e.yaw, 0));
    tmpScale.set(1, 1, 1);
    tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
    ribbons.setMatrixAt(i, tmpMatrix);
  }
  ribbons.instanceMatrix.needsUpdate = true;

  return { mesh: markedMesh, indexMap, ribbons, positions, kinds, emissiveColors };
}

// A closed cylinder that plugs the void a short distance past the ceiling and
// floor, viewed from inside (BackSide). Fog is disabled so it stays pitch
// black regardless of distance, giving the shaft a quick fade to darkness.
const VOID_CAP_LENGTH = 6;
const voidCapGeo = new THREE.CylinderGeometry(
  VOID_RADIUS * 0.99,
  VOID_RADIUS * 0.99,
  VOID_CAP_LENGTH,
  24,
  1,
  false
);
const voidCapMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  side: THREE.BackSide,
  fog: false,
});

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
  color: 0xb8a0ff,
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
    color: crimson ? 0xff4a4a : 0xc8b8ff,
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

// A circular seal with inner strokes, hung glowing above every doorway.
const sigilTexture = (() => {
  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  // Soft halo behind the linework so the seal reads as a glow from afar.
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 120);
  grad.addColorStop(0, 'rgba(255, 220, 170, 0.55)');
  grad.addColorStop(1, 'rgba(255, 220, 170, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(255, 230, 190, 1)';
  g.lineWidth = 9;
  g.beginPath();
  g.arc(128, 128, 104, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 6;
  g.beginPath();
  g.arc(128, 128, 80, 0, Math.PI * 2);
  g.stroke();
  // Inner sigil: a triangle over a crossed bar, like a bookbinder's mark.
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(128, 60);
  g.lineTo(180, 176);
  g.lineTo(76, 176);
  g.closePath();
  g.moveTo(92, 128);
  g.lineTo(164, 128);
  g.moveTo(128, 176);
  g.lineTo(128, 208);
  g.stroke();
  return new THREE.CanvasTexture(cv);
})();

const sigilGeo = new THREE.PlaneGeometry(1.5, 1.5);

// Moth: two wing quads hinged at the body so they can flap.
const mothWingGeo = (() => {
  const geo = new THREE.PlaneGeometry(0.16, 0.09);
  geo.translate(0.09, 0, 0); // hinge at the inner edge
  return geo;
})();
const mothBodyGeo = new THREE.BoxGeometry(0.025, 0.025, 0.09);
const mothMat = new THREE.MeshBasicMaterial({
  color: 0xe8d9b0,
  transparent: true,
  opacity: 0.85,
  side: THREE.DoubleSide,
});

function buildMoth() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(mothBodyGeo, mothMat);
  g.add(body);
  const left = new THREE.Mesh(mothWingGeo, mothMat);
  const right = new THREE.Mesh(mothWingGeo, mothMat);
  right.scale.x = -1;
  g.add(left);
  g.add(right);
  return { group: g, left, right };
}

// Spectral creatures that haunt the galleries (owl, beetle — not on shelves).
const spiritMat = new THREE.MeshBasicMaterial({
  color: 0xd8cbb0,
  transparent: true,
  opacity: 0.5,
  side: THREE.DoubleSide,
});

/** Drop per-creature geos/mats; skip shared spiritMat. */
function disposeCreature(group) {
  const seenGeo = new Set();
  const seenMat = new Set([spiritMat]);
  group.traverse((obj) => {
    if (obj.geometry && !seenGeo.has(obj.geometry)) {
      seenGeo.add(obj.geometry);
      obj.geometry.dispose();
    }
    const mats = obj.material
      ? Array.isArray(obj.material)
        ? obj.material
        : [obj.material]
      : [];
    for (const m of mats) {
      if (!m || seenMat.has(m)) continue;
      seenMat.add(m);
      m.dispose();
    }
  });
}

function buildOwl() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), spiritMat);
  g.add(body);
  const head = new THREE.Group();
  head.position.y = 0.12;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), spiritMat);
  head.add(face);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), eyeMat);
  eyeL.position.set(0.05, 0.02, 0.06);
  head.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.z = -0.06;
  head.add(eyeR);
  g.add(head);
  const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.2), spiritMat);
  wingL.position.set(-0.1, 0, 0.12);
  wingL.rotation.y = 0.3;
  g.add(wingL);
  const wingR = wingL.clone();
  wingR.position.z = -0.12;
  wingR.rotation.y = -0.3;
  g.add(wingR);
  return { group: g, head };
}

function buildBeetle() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), spiritMat);
  shell.scale.set(1.4, 0.7, 1);
  g.add(shell);
  const legMat = new THREE.MeshBasicMaterial({ color: 0xa89880, transparent: true, opacity: 0.45 });
  for (let k = 0; k < 6; k++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, 0.08), legMat);
    const a = (k / 6) * Math.PI * 2;
    leg.position.set(Math.cos(a) * 0.07, -0.02, Math.sin(a) * 0.07);
    leg.rotation.y = a;
    g.add(leg);
  }
  return { group: g };
}

const pageGeo = new THREE.PlaneGeometry(0.22, 0.3);
const pageMat = new THREE.MeshBasicMaterial({
  color: 0xf0e4c8,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
  depthWrite: false,
});

function buildFloatingPages(rng, count) {
  const pages = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(pageGeo, pageMat);
    mesh.position.set(
      (rng() - 0.5) * 5,
      0.8 + rng() * 3.2,
      (rng() - 0.5) * 5
    );
    mesh.rotation.set(rng() * 0.5, rng() * Math.PI * 2, rng() * 0.3);
    pages.push({
      mesh,
      phase: rng() * Math.PI * 2,
      drift: 0.12 + rng() * 0.18,
      spin: 0.2 + rng() * 0.4,
    });
  }
  return pages;
}

const innerRuneGeo = new THREE.RingGeometry(RAIL_RADIUS + 0.15, RAIL_RADIUS + 0.55, 36, 1);
const orbGeo = new THREE.SphereGeometry(0.08, 8, 6);
const orbMat = new THREE.MeshBasicMaterial({
  color: 0xffc98a,
  transparent: true,
  opacity: 0.55,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

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

  const wallSpec = makePatternSpec(roomData.seed, 'wall');
  const floorSpec = makePatternSpec(roomData.seed, 'floor');
  const wallTex = createSurfacePatternTexture(wallSpec);
  const floorTex = createSurfacePatternTexture(floorSpec);

  // Per-room palette drift plus unique floor/wall maps. Cloned materials
  // and their pattern textures are disposed with the room.
  const tinted = [];
  const tint = (mat, map) => {
    const m = mat.clone();
    m.color.offsetHSL(roomData.hueJitter, 0, roomData.lightJitter);
    if (map) {
      m.map = map;
      m.needsUpdate = true;
    }
    tinted.push(m);
    return m;
  };
  const sm = {
    ...base,
    wall: tint(base.wall, wallTex),
    floor: tint(base.floor, floorTex),
    column: tint(base.column),
    accent: tint(base.accent),
  };

  const floor = new THREE.Mesh(crimson ? hexSolidGeo : hexWithHoleGeo, sm.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.014;
  group.add(floor);
  const ceiling = new THREE.Mesh(crimson ? hexSolidGeo : hexWithHoleGeo, sm.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  group.add(ceiling);

  const rowYs = shelfRowYs(roomData.rows);
  for (let k = 0; k < 6; k++) {
    if (!crimson && roomData.doors.includes(k)) buildDoorway(group, sm, k);
    else buildShelfFrame(group, sm, k, rowYs);
  }

  buildColumns(group, sm);
  buildCornice(group, sm, crimson ? [] : roomData.doors);
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

  // Inner warding ring, counter-rotating faster.
  const innerRing = new THREE.Mesh(innerRuneGeo, crimson ? runeRingMatCrimson : runeRingMat);
  innerRing.rotation.x = -Math.PI / 2;
  innerRing.position.y = 0.05;
  group.add(innerRing);
  const innerSpin = -runeSpin * 2.2;

  // Glowing orbs atop each column.
  const columnOrbs = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    const orb = new THREE.Mesh(orbGeo, orbMat.clone());
    orb.position.set(
      Math.cos(a) * COLUMN_RING_RADIUS,
      ROOM_HEIGHT - 0.35,
      Math.sin(a) * COLUMN_RING_RADIUS
    );
    group.add(orb);
    columnOrbs.push({ mesh: orb, phase: rng() * Math.PI * 2 });
  }

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

  // Mirrored warding circle on the ceiling, spinning against the floor one.
  const ceilRing = new THREE.Mesh(runeRingGeo, crimson ? runeRingMatCrimson : runeRingMat);
  ceilRing.rotation.x = Math.PI / 2;
  ceilRing.position.y = ROOM_HEIGHT - 0.03;
  group.add(ceilRing);

  // Glowing seals above every doorway.
  const sigils = [];
  const sigilMat = new THREE.MeshBasicMaterial({
    map: sigilTexture,
    color: crimson ? 0xff2a33 : 0xb8a0ff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const d of roomData.doors) {
    const { n, yaw } = wallTransform(d);
    const dist = HEX_INRADIUS - 0.08;
    const sigil = new THREE.Mesh(sigilGeo, sigilMat);
    sigil.position.set(n.x * dist, 4.15, n.z * dist);
    sigil.rotation.y = yaw + Math.PI;
    group.add(sigil);
    sigils.push(sigil);
  }

  // Faint star-motes twinkling just under the ceiling.
  const starCount = 22;
  const starBase = new Float32Array(starCount * 3);
  const starPhase = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const a = rng() * Math.PI * 2;
    const rad = 1.2 + rng() * 4.2;
    starBase[i * 3] = Math.cos(a) * rad;
    starBase[i * 3 + 1] = ROOM_HEIGHT - 0.45 - rng() * 0.7;
    starBase[i * 3 + 2] = Math.sin(a) * rad;
    starPhase[i] = rng() * Math.PI * 2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starBase.slice(), 3));
  const starMat = new THREE.PointsMaterial({
    map: dustTexture,
    color: crimson ? 0xff6a6a : 0xcfe0ff,
    size: 0.06,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  group.add(stars);

  const { mesh: books, baseColors, bookIndexMap, marked } = buildBooks(roomData, crimson);
  group.add(books);
  if (marked.mesh) {
    group.add(marked.mesh);
    group.add(marked.ribbons);
  }

  // Tiny sparkles orbiting the marked volumes.
  let sparkles = null;
  let sparkleData = [];
  if (marked.positions.length > 0) {
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(marked.positions), 3)
    );
    const sparkMat = new THREE.PointsMaterial({
      map: dustTexture,
      color: 0xffe9b0,
      size: 0.12,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    sparkles = new THREE.Points(sparkGeo, sparkMat);
    sparkles.frustumCulled = false;
    group.add(sparkles);
    for (let s = 0; s < marked.positions.length / 3; s++) {
      sparkleData.push({
        phase: rng() * Math.PI * 2,
        radius: 0.12 + rng() * 0.08,
        bx: marked.positions[s * 3],
        by: marked.positions[s * 3 + 1],
        bz: marked.positions[s * 3 + 2],
      });
    }
  }

  // A wandering wisp of lamplight.
  const wispMat = new THREE.SpriteMaterial({
    map: haloTexture,
    color: crimson ? 0xff4444 : 0xffd9a0,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const wisp = new THREE.Sprite(wispMat);
  wisp.scale.setScalar(0.4);
  group.add(wisp);
  const wispSeed = rng() * Math.PI * 2;

  // A pair of spectral moths circling the lamps.
  const moths = [];
  const mothAnchors =
    def.lampSpots.length > 0
      ? def.lampSpots.map(([sx, sz]) => ({ x: sx, y: ROOM_HEIGHT - 0.7, z: sz }))
      : [{ x: 0, y: 2.6, z: 0 }];
  for (let m = 0; m < 2; m++) {
    const moth = buildMoth();
    moths.push({
      ...moth,
      anchor: mothAnchors[m % mothAnchors.length],
      phase: rng() * Math.PI * 2,
      speed: 0.5 + rng() * 0.5,
      radius: 0.55 + rng() * 0.4,
      flap: 9 + rng() * 5,
    });
    group.add(moth.group);
  }

  // Solid library cats wandering the floor (1–2 per room, varied colors).
  const cats = createRoomCats(roomData, rng, { crimson });
  for (const cat of cats) group.add(cat.group);

  const flowBeings = createFlowBeings(roomData, rng, { crimson });
  for (const b of flowBeings) group.add(b.group);

  // Owl on a random column capital.
  let owl = null;
  if (!crimson) {
    const col = Math.floor(rng() * 6);
    const a = (Math.PI / 3) * col;
    owl = buildOwl();
    owl.group.position.set(
      Math.cos(a) * COLUMN_RING_RADIUS,
      ROOM_HEIGHT - 0.55,
      Math.sin(a) * COLUMN_RING_RADIUS
    );
    owl.group.rotation.y = a + Math.PI;
    group.add(owl.group);
  }

  // Beetle crawling the void railing.
  let beetle = null;
  if (!crimson) {
    beetle = buildBeetle();
    beetle.phase = rng() * Math.PI * 2;
    beetle.speed = 0.25 + rng() * 0.2;
    group.add(beetle.group);
  }

  // Torn pages drifting upward like ash.
  const pages = crimson ? [] : buildFloatingPages(rng, 2 + Math.floor(rng() * 2));
  for (const p of pages) group.add(p.mesh);

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
    for (const [sx, sz] of def.lampSpots) {
      const lamp = new THREE.Mesh(lampSphere, sm.lamp);
      lamp.position.set(sx, ROOM_HEIGHT - 0.55, sz);
      group.add(lamp);
      const halo = new THREE.Sprite(haloMat);
      halo.position.set(sx, ROOM_HEIGHT - 0.55, sz);
      halo.scale.setScalar(1.6);
      group.add(halo);
      halos.push(halo);
    }
    light = new THREE.PointLight(0xff3840, 88, 30, 1.8);
    light.position.set(0, 3.6, 0);
    group.add(light);
    ember = new THREE.PointLight(0xff6644, 0, 14, 1.8);
    ember.position.set(0, 1.85, 0);
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

    const capAbove = new THREE.Mesh(voidCapGeo, voidCapMat);
    capAbove.position.y = ROOM_HEIGHT + VOID_CAP_LENGTH / 2 + 0.02;
    group.add(capAbove);
    const capBelow = new THREE.Mesh(voidCapGeo, voidCapMat);
    capBelow.position.y = -VOID_CAP_LENGTH / 2 - 0.02;
    group.add(capBelow);
  }

  const dust = buildDust(rng, roomData.dustCount);
  group.add(dust.points);

  return {
    group,
    books,
    markedBooks: marked.mesh,
    markedIndexMap: marked.indexMap,
    markedRibbons: marked.ribbons,
    markedEmissive: marked.emissiveColors ?? [],
    baseColors,
    bookIndexMap,
    dust,
    glyphs,
    runeRing,
    innerRing,
    runeSpin,
    innerSpin,
    ceilRing,
    columnOrbs,
    sigils,
    stars: { points: stars, base: starBase, phase: starPhase },
    sparkles,
    sparkleData,
    wisp,
    wispSeed,
    moths,
    cats,
    flowBeings,
    owl,
    beetle,
    pages,
    shaft,
    halos,
    light,
    ember,
    baseIntensity: light.intensity,
    crimsonBook,
    data: roomData,
    dispose() {
      books.dispose();
      marked.mesh?.dispose();
      marked.ribbons?.dispose();
      dust.points.geometry.dispose();
      dust.points.material.dispose();
      glyphs.points.geometry.dispose();
      glyphs.points.material.dispose();
      stars.geometry.dispose();
      starMat.dispose();
      if (sparkles) {
        sparkles.geometry.dispose();
        sparkles.material.dispose();
      }
      sigilMat.dispose();
      wispMat.dispose();
      shaftMat.dispose();
      for (const o of columnOrbs) o.mesh.material.dispose();
      disposeCats(cats);
      disposeFlowBeings(flowBeings);
      if (owl) disposeCreature(owl.group);
      if (beetle) disposeCreature(beetle.group);
      for (const m of tinted) m.dispose();
      wallTex.dispose();
      floorTex.dispose();
    },
  };
}
