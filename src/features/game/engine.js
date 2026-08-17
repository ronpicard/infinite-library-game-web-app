// The game engine: rendering, first-person controls, room streaming,
// collision, book interaction and quest progression. React talks to it
// through a small callback interface; it never touches React state itself.

import * as THREE from 'three';
import {
  HEX_INRADIUS,
  axialToWorld,
  worldToAxial,
  roomKey,
  neighbor,
  dirBetween,
  dirUnitVector,
  ROOM_HEIGHT,
} from '../world/hex.js';
import { getRoomData } from '../world/room-data.js';
import { createQuestState, advanceQuest } from '../world/quest.js';
import {
  buildRoom,
  DOOR_PASS_HALF,
  RAIL_RADIUS,
  COLUMN_RADIUS,
  COLUMN_RING_RADIUS,
  markedBookMat,
} from './room-builder.js';
import { updateRoomCats } from './library-cats.js';
import { cinematicOwnsAmbientLights, isLookFrozen } from './cinematic.js';

const EYE_HEIGHT = 1.65;
const PLAYER_RADIUS = 0.32;
const WALK_SPEED = 3.1;
const SPRINT_SPEED = 5.0;
const INTERACT_RANGE = 3.4;
const STEP_LENGTH = 1.25; // meters walked per footstep sound
const TOUCH_LOOK_SENSITIVITY = 0.0052;
const CRIMSON_LOCK = 1.0;
const CRIMSON_REVEAL = 1.6;
const CRIMSON_FOG = new THREE.Color(0x180608);
const BASE_FOG = new THREE.Color(0x0a0704);
/** Default is a touch brighter than the original 1.1 baseline. */
export const DEFAULT_BRIGHTNESS = 1.0;
const BASE_EXPOSURE = 1.28;

export function createEngine(canvas, callbacks, { touchMode = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = BASE_EXPOSURE;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0704);
  scene.fog = new THREE.FogExp2(0x0a0704, 0.052);
  scene.add(new THREE.AmbientLight(0x2a1e12, 2.2));

  const camera = new THREE.PerspectiveCamera(
    72,
    window.innerWidth / window.innerHeight,
    0.05,
    80
  );

  // ------------------------------------------------------------- state
  const spawn = axialToWorld(0, 0);
  const player = new THREE.Vector3(spawn.x, EYE_HEIGHT, spawn.z + 2.2);
  let yaw = 0; // spawn south of center, looking toward the void
  let pitch = 0;
  const keys = new Set();
  let locked = false;
  let paused = true; // splash screen up
  let disposed = false;

  const rooms = new Map(); // key -> handle from buildRoom
  let currentKey = null;
  let crimsonKey = null;
  let crimsonTransition = null; // { key, elapsed, transformed }
  const visited = new Set();
  const quest = createQuestState(0, 0);
  let won = false;

  let hovered = null; // { room, index } | { crimson: true } | null
  let facingDir = -1;
  const touchMove = { x: 0, z: 0 }; // virtual joystick vector
  let stepAccum = 0;
  let bobPhase = 0;
  let bobAmount = 0;
  let wonAt = null; // elapsed time when the crimson book was taken

  function inputActive() {
    return !paused && !crimsonTransition && (locked || touchMode);
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }

  const raycaster = new THREE.Raycaster();
  raycaster.far = INTERACT_RANGE;
  const tmpColor = new THREE.Color();
  const forward = new THREE.Vector3();

  // ------------------------------------------------------------- rooms
  function ensureRooms(q, r) {
    const wanted = new Set();
    if (crimsonKey || crimsonTransition) {
      wanted.add(crimsonKey || crimsonTransition.key);
    } else {
      wanted.add(roomKey(q, r));
      for (let d = 0; d < 6; d++) {
        const n = neighbor(q, r, d);
        wanted.add(roomKey(n.q, n.r));
      }
    }
    for (const [key, handle] of rooms) {
      if (!wanted.has(key)) {
        scene.remove(handle.group);
        handle.dispose();
        rooms.delete(key);
      }
    }
    for (const key of wanted) {
      if (!rooms.has(key)) {
        const [rq, rr] = key.split(',').map(Number);
        const handle = buildRoom(getRoomData(rq, rr), { crimson: key === crimsonKey });
        scene.add(handle.group);
        rooms.set(key, handle);
      }
    }
  }

  function rebuildAsCrimson(key) {
    crimsonKey = key;
    const old = rooms.get(key);
    if (old) {
      scene.remove(old.group);
      old.dispose();
      rooms.delete(key);
    }
    const [rq, rr] = key.split(',').map(Number);
    const handle = buildRoom(getRoomData(rq, rr), { crimson: true });
    scene.add(handle.group);
    rooms.set(key, handle);
  }

  function sealToSingleRoom(key) {
    for (const [k, handle] of rooms) {
      if (k !== key) {
        scene.remove(handle.group);
        handle.dispose();
        rooms.delete(k);
      }
    }
  }

  function startCrimsonTransition(key) {
    crimsonTransition = { key, elapsed: 0, transformed: false };
    sealToSingleRoom(key);
    callbacks.onCrimsonTransitionStart?.();
  }

  function updateCrimsonTransition(dt) {
    if (!crimsonTransition) return;
    crimsonTransition.elapsed += dt;
    const t = crimsonTransition.elapsed;
    const total = CRIMSON_LOCK + CRIMSON_REVEAL;
    const u = easeInOut(Math.min(1, t / total));

    tmpColor.copy(BASE_FOG).lerp(CRIMSON_FOG, u);
    scene.fog.color.copy(tmpColor);
    scene.background.copy(tmpColor);

    if (t >= CRIMSON_LOCK && !crimsonTransition.transformed) {
      crimsonTransition.transformed = true;
      rebuildAsCrimson(crimsonTransition.key);
      callbacks.onCrimsonReveal?.();
    }

    const handle = rooms.get(crimsonTransition.key);
    if (handle) {
      if (t >= CRIMSON_LOCK) {
        const revealT = Math.min(1, (t - CRIMSON_LOCK) / CRIMSON_REVEAL);
        const pulse = 1 + 0.04 * Math.sin(revealT * Math.PI * 6) * (1 - revealT);
        handle.group.scale.setScalar(pulse);
        handle.light.intensity =
          handle.baseIntensity * (1.2 + 0.8 * Math.sin(revealT * Math.PI * 4));
        handle.runeRing.rotation.z += dt * 2.5;
        handle.innerRing.rotation.z -= dt * 3.8;
      } else {
        const lockPulse = 0.5 + 0.5 * Math.sin(t * 14);
        handle.light.intensity = handle.baseIntensity * (0.7 + lockPulse * 0.5);
      }
    }

    if (t < CRIMSON_LOCK + CRIMSON_REVEAL * 0.85) {
      const shake = (1 - u) * 0.035 * Math.sin(t * 38);
      camera.position.x += shake;
      camera.position.z += shake * 0.6;
    }

    if (t >= total) {
      if (handle) handle.group.scale.setScalar(1);
      crimsonTransition = null;
      callbacks.onCrimsonTransitionEnd?.();
    }
  }

  function enterRoom(q, r) {
    if (crimsonTransition) return;
    const key = roomKey(q, r);
    const prevKey = currentKey;
    currentKey = key;
    ensureRooms(q, r);
    visited.add(key);

    if (prevKey && !won) {
      const [pq, pr] = prevKey.split(',').map(Number);
      const moveDir = dirBetween(pq, pr, q, r);
      const event = advanceQuest(quest, moveDir, q, r);
      if (event.type === 'arrived') startCrimsonTransition(key);
      if (event.type !== 'none') {
        callbacks.onQuestEvent({ ...event, progress: quest.progress });
      }
    }
    callbacks.onRoomEnter({ key, roomsVisited: visited.size, crimson: key === crimsonKey });
  }

  // ------------------------------------------------------------- input
  function onMouseMove(e) {
    if (!locked || isLookFrozen(paused, crimsonTransition)) return;
    yaw -= e.movementX * 0.0021;
    pitch -= e.movementY * 0.0021;
    pitch = Math.max(-1.45, Math.min(1.45, pitch));
  }

  function onKeyDown(e) {
    keys.add(e.code);
    if (e.code === 'KeyE' && inputActive() && hovered) {
      callbacks.onOpenBook(hovered);
    }
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onCanvasClick() {
    if (disposed || touchMode || isLookFrozen(paused, crimsonTransition)) return;
    if (!locked) {
      canvas.requestPointerLock();
    } else if (hovered) {
      callbacks.onOpenBook(hovered);
    }
  }

  // Touch: one finger dragging on the canvas looks around; a short tap
  // opens the book under the crosshair. The joystick lives in the DOM
  // above the canvas, so its touches never arrive here.
  let lookTouchId = null;
  let lastTouchX = 0;
  let lastTouchY = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  function onTouchStart(e) {
    if (isLookFrozen(paused, crimsonTransition) || lookTouchId !== null) return;
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lastTouchX = touchStartX = t.clientX;
    lastTouchY = touchStartY = t.clientY;
    touchStartTime = performance.now();
    e.preventDefault();
  }

  function onTouchMove(e) {
    if (isLookFrozen(paused, crimsonTransition) || lookTouchId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      yaw -= (t.clientX - lastTouchX) * TOUCH_LOOK_SENSITIVITY;
      pitch -= (t.clientY - lastTouchY) * TOUCH_LOOK_SENSITIVITY;
      pitch = Math.max(-1.45, Math.min(1.45, pitch));
      lastTouchX = t.clientX;
      lastTouchY = t.clientY;
    }
    e.preventDefault();
  }

  function onTouchEnd(e) {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      lookTouchId = null;
      const wasTap =
        performance.now() - touchStartTime < 350 &&
        Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY) < 12;
      if (wasTap && !isLookFrozen(paused, crimsonTransition) && hovered) {
        callbacks.onOpenBook(hovered);
      }
    }
  }

  function onLockChange() {
    locked = document.pointerLockElement === canvas;
    keys.clear();
    callbacks.onLockChange(locked);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('click', onCanvasClick);
  window.addEventListener('resize', onResize);
  if (touchMode) {
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
  }

  // ------------------------------------------------------------- physics
  function collide(pos, roomQ, roomR) {
    const center = axialToWorld(roomQ, roomR);
    let relX = pos.x - center.x;
    let relZ = pos.z - center.z;
    const keyHere = roomKey(roomQ, roomR);
    const room = rooms.get(keyHere);
    const isCrimson = keyHere === crimsonKey;
    const sealed =
      isCrimson ||
      (crimsonTransition && keyHere === crimsonTransition.key);
    const doors = sealed ? [] : room ? room.data.doors : getRoomData(roomQ, roomR).doors;

    // Central obstacle: void railing, or the pedestal in the Crimson Hexagon.
    const coreR = (isCrimson ? 0.75 : RAIL_RADIUS) + PLAYER_RADIUS;
    const centerDist = Math.hypot(relX, relZ);
    if (centerDist < coreR && centerDist > 1e-4) {
      const push = coreR / centerDist;
      relX *= push;
      relZ *= push;
    }

    for (let d = 0; d < 6; d++) {
      const n = dirUnitVector(d);
      const along = relX * n.x + relZ * n.z;
      const isDoor = doors.includes(d);
      // Shelves protrude ~0.9m; doorway collision stops short of the frame posts.
      const limit = HEX_INRADIUS - (isDoor ? 0.28 : 0.95) - PLAYER_RADIUS;
      if (along <= limit) continue;
      const lateral = relX * -n.z + relZ * n.x;
      if (isDoor && Math.abs(lateral) < DOOR_PASS_HALF - PLAYER_RADIUS) continue;
      relX -= n.x * (along - limit);
      relZ -= n.z * (along - limit);
    }

    // Columns at the hex vertices.
    const colR = COLUMN_RADIUS + PLAYER_RADIUS;
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k;
      const cx = Math.cos(a) * COLUMN_RING_RADIUS;
      const cz = Math.sin(a) * COLUMN_RING_RADIUS;
      const dx = relX - cx;
      const dz = relZ - cz;
      const dist = Math.hypot(dx, dz);
      if (dist < colR && dist > 1e-4) {
        relX = cx + (dx / dist) * colR;
        relZ = cz + (dz / dist) * colR;
      }
    }

    pos.x = center.x + relX;
    pos.z = center.z + relZ;
  }

  function updateMovement(dt) {
    if (!inputActive()) return;
    let mx = 0;
    let mz = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) mz += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) mz -= 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (touchMode && mx === 0 && mz === 0) {
      mx = touchMove.x;
      mz = touchMove.z;
    }
    if (mx === 0 && mz === 0) return;
    const len = Math.max(1, Math.hypot(mx, mz));
    const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? SPRINT_SPEED : WALK_SPEED;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // Ground-plane forward is (-sin yaw, -cos yaw); right is (cos yaw, -sin yaw).
    const prevX = player.x;
    const prevZ = player.z;
    player.x += ((-sin * mz + cos * mx) / len) * speed * dt;
    player.z += ((-cos * mz - sin * mx) / len) * speed * dt;

    const axial = worldToAxial(player.x, player.z);
    collide(player, axial.q, axial.r);

    const moved = Math.hypot(player.x - prevX, player.z - prevZ);
    stepAccum += moved;
    if (stepAccum >= STEP_LENGTH) {
      stepAccum = 0;
      callbacks.onFootstep();
    }
    // Gentle head bob while actually moving.
    if (moved > 0.0005) {
      bobPhase += dt * (speed > WALK_SPEED ? 9.5 : 7);
      bobAmount = Math.min(1, bobAmount + dt * 5);
    }
  }

  // ------------------------------------------------------------- hover
  const MARKED_BASE = [
    new THREE.Color(0xfff4dc),
    new THREE.Color(0xffe8a8),
    new THREE.Color(0xc8e8dc),
  ];

  function setHoverHighlight(target) {
    if (hovered && hovered.room && hovered.markedInstance !== undefined) {
      const h = rooms.get(hovered.room);
      if (h?.markedBooks) {
        const i = hovered.markedInstance;
        const kind = h.data.coherent.get(h.markedIndexMap[i])?.kind;
        const base =
          kind === 'intro' ? MARKED_BASE[1] : kind === 'aphorism' ? MARKED_BASE[2] : MARKED_BASE[0];
        h.markedBooks.setColorAt(i, base);
        h.markedBooks.instanceColor.needsUpdate = true;
      }
    }
    hovered = target;
    if (hovered && hovered.room && hovered.markedInstance !== undefined) {
      const h = rooms.get(hovered.room);
      if (h?.markedBooks) {
        const i = hovered.markedInstance;
        tmpColor.setRGB(1, 0.98, 0.88);
        h.markedBooks.setColorAt(i, tmpColor);
        h.markedBooks.instanceColor.needsUpdate = true;
      }
    }
    callbacks.onHover(hovered);
  }

  function updateHover() {
    if (!inputActive()) {
      if (hovered) setHoverHighlight(null);
      return;
    }
    camera.getWorldDirection(forward);
    raycaster.set(camera.position, forward);
    const targets = [];
    for (const h of rooms.values()) {
      if (h.markedBooks) targets.push(h.markedBooks);
      if (h.crimsonBook) targets.push(h.crimsonBook);
    }
    const hits = raycaster.intersectObjects(targets, false);
    let next = null;
    if (hits.length > 0) {
      const hit = hits[0];
      for (const [key, h] of rooms) {
        if (h.markedBooks === hit.object) {
          next = {
            room: key,
            markedInstance: hit.instanceId,
            index: h.markedIndexMap[hit.instanceId],
          };
          break;
        }
        if (h.crimsonBook === hit.object) {
          next = { crimson: true };
          break;
        }
      }
    }
    const same =
      (next === null && hovered === null) ||
      (next &&
        hovered &&
        next.crimson === hovered.crimson &&
        next.room === hovered.room &&
        next.markedInstance === hovered.markedInstance);
    if (!same) setHoverHighlight(next);
  }

  function updateFacing() {
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    let best = -1;
    let bestDot = -Infinity;
    for (let d = 0; d < 6; d++) {
      const n = dirUnitVector(d);
      const dot = fx * n.x + fz * n.z;
      if (dot > bestDot) {
        bestDot = dot;
        best = d;
      }
    }
    if (best !== facingDir) {
      facingDir = best;
      callbacks.onFacing(best);
    }
  }

  // ------------------------------------------------------------- loop
  const clock = new THREE.Clock();
  let elapsed = 0;

  function animate() {
    if (disposed) return;
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    if (crimsonTransition) {
      updateCrimsonTransition(dt);
    } else {
      updateMovement(dt);
    }

    const axial = worldToAxial(player.x, player.z);
    const key = roomKey(axial.q, axial.r);
    if (!crimsonTransition && key !== currentKey) enterRoom(axial.q, axial.r);

    camera.position.copy(player);
    bobAmount = Math.max(0, bobAmount - dt * 3);
    camera.position.y = player.y + Math.sin(bobPhase) * 0.035 * bobAmount;
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch, yaw, 0);

    updateHover();
    updateFacing();

    const cinematicLights = cinematicOwnsAmbientLights(crimsonTransition);
    for (const h of rooms.values()) {
      const f = h.data.seed % 97;
      const fs = h.data.flickerSpeed;
      // Lamp flicker, breathing at a per-room rate. Skip during arrival so
      // the cinematic pulse is not overwritten the same frame.
      if (!cinematicLights) {
        h.light.intensity =
          h.baseIntensity *
          (1 + 0.06 * Math.sin(elapsed * 7.3 * fs + f) * Math.sin(elapsed * 2.9 * fs + f * 2));
      }
      // Dust drift.
      const pos = h.dust.points.geometry.attributes.position;
      const { base, phase } = h.dust;
      for (let i = 0; i < phase.length; i++) {
        pos.array[i * 3] = base[i * 3] + 0.22 * Math.sin(elapsed * 0.16 + phase[i] * 1.7);
        pos.array[i * 3 + 1] = base[i * 3 + 1] + 0.3 * Math.sin(elapsed * 0.23 + phase[i]);
        pos.array[i * 3 + 2] = base[i * 3 + 2] + 0.22 * Math.cos(elapsed * 0.19 + phase[i]);
      }
      pos.needsUpdate = true;

      // Warding circles revolve (floor and ceiling in opposition); the void
      // shaft breathes; the doorway seals pulse slowly. Floor rings are driven
      // by the arrival cinematic while it owns the lights.
      if (!cinematicLights) {
        h.runeRing.rotation.z = elapsed * h.runeSpin;
        h.innerRing.rotation.z = elapsed * h.innerSpin;
      }
      h.ceilRing.rotation.z = -elapsed * h.runeSpin * 1.4;
      h.shaft.material.opacity = 0.035 + 0.025 * (1 + Math.sin(elapsed * 0.45 + f));
      for (const sig of h.sigils) {
        sig.material.opacity = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(elapsed * 0.6 + f));
        sig.rotation.z = Math.sin(elapsed * 0.35 + f) * 0.08;
      }

      // Column orbs breathe.
      for (const o of h.columnOrbs) {
        o.mesh.material.opacity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(elapsed * 1.4 + o.phase));
        o.mesh.scale.setScalar(0.85 + 0.25 * Math.sin(elapsed * 1.1 + o.phase));
      }

      // Ceiling star-motes twinkle.
      const spos = h.stars.points.geometry.attributes.position;
      for (let i = 0; i < h.stars.phase.length; i++) {
        spos.array[i * 3 + 1] =
          h.stars.base[i * 3 + 1] + 0.05 * Math.sin(elapsed * 0.8 + h.stars.phase[i]);
      }
      spos.needsUpdate = true;
      h.stars.points.material.opacity = 0.28 + 0.18 * Math.sin(elapsed * 1.1 + f);

      // Sparkles orbit the marked volumes.
      if (h.sparkles && h.sparkleData.length > 0) {
        const sp = h.sparkles.geometry.attributes.position;
        for (let i = 0; i < h.sparkleData.length; i++) {
          const sd = h.sparkleData[i];
          const orbit = elapsed * 1.8 + sd.phase;
          sp.array[i * 3] = sd.bx + Math.cos(orbit) * sd.radius;
          sp.array[i * 3 + 1] = sd.by + 0.06 * Math.sin(elapsed * 2.2 + sd.phase);
          sp.array[i * 3 + 2] = sd.bz + Math.sin(orbit) * sd.radius;
        }
        sp.needsUpdate = true;
        h.sparkles.material.opacity = 0.45 + 0.35 * Math.sin(elapsed * 2.6 + f);
        h.sparkles.material.size = 0.1 + 0.04 * Math.sin(elapsed * 3.4 + f * 2);
      }

      // The wisp wanders a slow lissajous path around the gallery.
      const w = h.wispSeed;
      h.wisp.position.set(
        Math.sin(elapsed * 0.21 + w) * 3.4,
        2.1 + Math.sin(elapsed * 0.34 + w * 2) * 1.1,
        Math.sin(elapsed * 0.27 + w * 3) * 3.4
      );
      h.wisp.material.opacity = 0.45 + 0.25 * Math.sin(elapsed * 1.7 + w);

      // Moths flutter around the lamps.
      for (const m of h.moths) {
        const a = elapsed * m.speed + m.phase;
        const wobble = Math.sin(elapsed * 1.9 + m.phase * 3) * 0.25;
        m.group.position.set(
          m.anchor.x + Math.cos(a) * (m.radius + wobble),
          m.anchor.y + Math.sin(elapsed * 1.3 + m.phase) * 0.28,
          m.anchor.z + Math.sin(a) * (m.radius + wobble)
        );
        m.group.rotation.y = -a;
        const flap = 0.25 + Math.abs(Math.sin(elapsed * m.flap + m.phase)) * 0.85;
        m.left.rotation.z = flap;
        m.right.rotation.z = -flap;
      }

      // Glyph motes spiral up through the void.
      const gpos = h.glyphs.points.geometry.attributes.position;
      for (let i = 0; i < h.glyphs.data.length; i++) {
        const gd = h.glyphs.data[i];
        const y = (gd.y + elapsed * gd.speed) % 5.4;
        const a = gd.angle + elapsed * gd.spin;
        gpos.array[i * 3] = Math.cos(a) * gd.radius;
        gpos.array[i * 3 + 1] = y - 0.2;
        gpos.array[i * 3 + 2] = Math.sin(a) * gd.radius;
      }
      gpos.needsUpdate = true;

      // Lamp halos swell softly.
      for (let i = 0; i < h.halos.length; i++) {
        h.halos[i].scale.setScalar(1.4 + 0.18 * Math.sin(elapsed * 1.3 + f + i * 2.1));
      }

      // Marked volumes pulse with ember light; ribbons sway.
      if (h.markedBooks) {
        markedBookMat.emissiveIntensity = 0.9 + 0.55 * Math.sin(elapsed * 1.7 + f);
        if (h.markedRibbons) {
          h.markedRibbons.rotation.z = Math.sin(elapsed * 1.2 + f) * 0.04;
        }
      }

      // Library cats: walk, sit, meow on the gallery floor.
      if (h.cats?.length) {
        const roomKeyHere = roomKey(h.data.q, h.data.r);
        updateRoomCats(h.cats, dt, elapsed, h.data, (colorIdx) => {
          if (roomKeyHere === currentKey) callbacks.onCatMeow?.(colorIdx);
        });
      }

      // Owl: head turns, blinks via scale.
      if (h.owl) {
        h.owl.head.rotation.y = Math.sin(elapsed * 0.55 + f) * 0.5;
        const blink = Math.sin(elapsed * 0.35 + f * 2);
        h.owl.head.scale.y = blink > 0.92 ? 0.08 : 1;
      }

      // Beetle crawls the void railing.
      if (h.beetle) {
        const a = elapsed * h.beetle.speed + h.beetle.phase;
        h.beetle.group.position.set(
          Math.cos(a) * RAIL_RADIUS,
          0.58 + Math.sin(elapsed * 3 + f) * 0.02,
          Math.sin(a) * RAIL_RADIUS
        );
        h.beetle.group.rotation.y = -a + Math.PI / 2;
      }

      // Torn pages drift upward and spin.
      for (const p of h.pages) {
        p.mesh.position.y += p.drift * dt;
        if (p.mesh.position.y > ROOM_HEIGHT + 0.5) p.mesh.position.y = 0.6;
        p.mesh.rotation.y += p.spin * dt;
        p.mesh.rotation.x = Math.sin(elapsed * p.spin + p.phase) * 0.35;
        p.mesh.material.opacity = 0.22 + 0.18 * (0.5 + 0.5 * Math.sin(elapsed + p.phase));
      }

      if (h.crimsonBook) {
        if (wonAt !== null) {
          // The book ascends once taken.
          const t = Math.min(elapsed - wonAt, 2.2);
          h.crimsonBook.rotation.y = elapsed * (0.4 + t * 1.6);
          h.crimsonBook.position.y = 1.22 + t * 0.9 + 0.06 * Math.sin(elapsed * 1.1);
          const s = 1 + t * 0.25;
          h.crimsonBook.scale.setScalar(s);
          if (h.ember) h.ember.intensity = 14 + t * 30;
        } else {
          h.crimsonBook.rotation.y = elapsed * 0.4;
          h.crimsonBook.position.y = 1.22 + 0.06 * Math.sin(elapsed * 1.1);
        }
      }
    }

    renderer.render(scene, camera);
  }

  // ------------------------------------------------------------- api
  enterRoom(0, 0);
  animate();

  // Automation hook for testing; only exists with ?debug in the URL.
  if (new URLSearchParams(window.location.search).has('debug')) {
    window.__babel = {
      look(y, p) {
        yaw = y;
        pitch = p;
      },
      teleport(q, r, ox = 0, oz = 0) {
        const c = axialToWorld(q, r);
        player.x = c.x + ox;
        player.z = c.z + oz;
      },
      move(dx, dz) {
        player.x += dx;
        player.z += dz;
        const a = worldToAxial(player.x, player.z);
        collide(player, a.q, a.r);
        return [player.x, player.z];
      },
      state() {
        return {
          currentKey,
          progress: quest.progress,
          expectedDir: quest.expectedDir,
          crimsonKey,
          visited: visited.size,
          loadedRooms: rooms.size,
        };
      },
      openBook(index) {
        callbacks.onOpenBook({ room: currentKey, index });
      },
      coherentIndices() {
        const [q, r] = currentKey.split(',').map(Number);
        return [...getRoomData(q, r).coherent.entries()].map(([i, v]) => [i, v.kind]);
      },
      openCrimson() {
        callbacks.onOpenBook({ crimson: true });
      },
      rooms,
      scene,
      camera,
    };
  }

  return {
    requestLock() {
      if (!touchMode) canvas.requestPointerLock();
    },
    setPaused(value) {
      paused = value;
      if (paused) {
        keys.clear();
        touchMove.x = 0;
        touchMove.z = 0;
        lookTouchId = null;
      }
    },
    /** Brightness multiplier; 1 = default (slightly brighter than the original look). */
    setBrightness(value) {
      const b = Math.max(0.4, Math.min(1.6, value));
      renderer.toneMappingExposure = BASE_EXPOSURE * b;
    },
    /** Virtual joystick input: x strafe, z forward, each in [-1, 1]. */
    setMoveInput(x, z) {
      touchMove.x = x;
      touchMove.z = z;
    },
    /** Open the book currently under the crosshair (mobile READ button). */
    interact() {
      if (!paused && hovered) callbacks.onOpenBook(hovered);
    },
    markWon() {
      won = true;
      wonAt = elapsed;
    },
    getQuestProgress() {
      return quest.progress;
    },
    dispose() {
      disposed = true;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerlockchange', onLockChange);
      canvas.removeEventListener('click', onCanvasClick);
      window.removeEventListener('resize', onResize);
      if (touchMode) {
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
        canvas.removeEventListener('touchcancel', onTouchEnd);
      }
      for (const h of rooms.values()) {
        scene.remove(h.group);
        h.dispose();
      }
      rooms.clear();
      renderer.dispose();
    },
  };
}
