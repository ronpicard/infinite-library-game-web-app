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
} from '../world/hex.js';
import { getRoomData } from '../world/room-data.js';
import { createQuestState, advanceQuest } from '../world/quest.js';
import {
  buildRoom,
  DOOR_HALF_WIDTH,
  RAIL_RADIUS,
  COLUMN_RADIUS,
  COLUMN_RING_RADIUS,
} from './room-builder.js';

const EYE_HEIGHT = 1.65;
const PLAYER_RADIUS = 0.32;
const WALK_SPEED = 3.1;
const SPRINT_SPEED = 5.0;
const INTERACT_RANGE = 3.4;
const STEP_LENGTH = 1.25; // meters walked per footstep sound
const TOUCH_LOOK_SENSITIVITY = 0.0052;

export function createEngine(canvas, callbacks, { touchMode = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

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
    return !paused && (locked || touchMode);
  }

  const raycaster = new THREE.Raycaster();
  raycaster.far = INTERACT_RANGE;
  const tmpColor = new THREE.Color();
  const forward = new THREE.Vector3();

  // ------------------------------------------------------------- rooms
  function ensureRooms(q, r) {
    const wanted = new Set([roomKey(q, r)]);
    for (let d = 0; d < 6; d++) {
      const n = neighbor(q, r, d);
      wanted.add(roomKey(n.q, n.r));
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

  function enterRoom(q, r) {
    const key = roomKey(q, r);
    const prevKey = currentKey;
    currentKey = key;
    ensureRooms(q, r);
    visited.add(key);

    if (prevKey && !won) {
      const [pq, pr] = prevKey.split(',').map(Number);
      const moveDir = dirBetween(pq, pr, q, r);
      const event = advanceQuest(quest, moveDir, q, r);
      if (event.type === 'arrived') rebuildAsCrimson(key);
      if (event.type !== 'none') {
        callbacks.onQuestEvent({ ...event, progress: quest.progress });
      }
    }
    callbacks.onRoomEnter({ key, roomsVisited: visited.size, crimson: key === crimsonKey });
  }

  // ------------------------------------------------------------- input
  function onMouseMove(e) {
    if (!locked || paused) return;
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
    if (paused || disposed || touchMode) return;
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
    if (paused || lookTouchId !== null) return;
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lastTouchX = touchStartX = t.clientX;
    lastTouchY = touchStartY = t.clientY;
    touchStartTime = performance.now();
    e.preventDefault();
  }

  function onTouchMove(e) {
    if (paused || lookTouchId === null) return;
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
      if (wasTap && !paused && hovered) callbacks.onOpenBook(hovered);
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
    const room = rooms.get(roomKey(roomQ, roomR));
    const doors = room ? room.data.doors : getRoomData(roomQ, roomR).doors;
    const isCrimson = roomKey(roomQ, roomR) === crimsonKey;

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
      // Shelves protrude ~0.9m from shelf walls; doorway walls are thin.
      const limit = HEX_INRADIUS - (isDoor ? 0.05 : 0.95) - PLAYER_RADIUS;
      if (along <= limit) continue;
      const lateral = relX * -n.z + relZ * n.x;
      if (isDoor && Math.abs(lateral) < DOOR_HALF_WIDTH - PLAYER_RADIUS) continue;
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
  function setHoverHighlight(target) {
    if (hovered && hovered.room) {
      const h = rooms.get(hovered.room);
      if (h) {
        const i = hovered.instance;
        tmpColor.setRGB(
          h.baseColors[i * 3],
          h.baseColors[i * 3 + 1],
          h.baseColors[i * 3 + 2]
        );
        h.books.setColorAt(i, tmpColor);
        h.books.instanceColor.needsUpdate = true;
      }
    }
    hovered = target;
    if (hovered && hovered.room) {
      const h = rooms.get(hovered.room);
      if (h) {
        const i = hovered.instance;
        tmpColor.setRGB(
          Math.min(1, h.baseColors[i * 3] * 2.6 + 0.12),
          Math.min(1, h.baseColors[i * 3 + 1] * 2.6 + 0.12),
          Math.min(1, h.baseColors[i * 3 + 2] * 2.6 + 0.12)
        );
        h.books.setColorAt(i, tmpColor);
        h.books.instanceColor.needsUpdate = true;
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
      targets.push(h.books);
      if (h.crimsonBook) targets.push(h.crimsonBook);
    }
    const hits = raycaster.intersectObjects(targets, false);
    let next = null;
    if (hits.length > 0) {
      const hit = hits[0];
      if (hit.object.isInstancedMesh) {
        for (const [key, h] of rooms) {
          if (h.books === hit.object) {
            next = {
              room: key,
              instance: hit.instanceId,
              index: h.bookIndexMap[hit.instanceId],
            };
            break;
          }
        }
      } else {
        next = { crimson: true };
      }
    }
    const same =
      (next === null && hovered === null) ||
      (next &&
        hovered &&
        next.crimson === hovered.crimson &&
        next.room === hovered.room &&
        next.instance === hovered.instance);
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

    updateMovement(dt);

    const axial = worldToAxial(player.x, player.z);
    const key = roomKey(axial.q, axial.r);
    if (key !== currentKey) enterRoom(axial.q, axial.r);

    camera.position.copy(player);
    bobAmount = Math.max(0, bobAmount - dt * 3);
    camera.position.y = player.y + Math.sin(bobPhase) * 0.035 * bobAmount;
    camera.rotation.order = 'YXZ';
    camera.rotation.set(pitch, yaw, 0);

    updateHover();
    updateFacing();

    for (const h of rooms.values()) {
      const f = h.data.seed % 97;
      const fs = h.data.flickerSpeed;
      // Lamp flicker, breathing at a per-room rate.
      h.light.intensity =
        h.baseIntensity *
        (1 + 0.06 * Math.sin(elapsed * 7.3 * fs + f) * Math.sin(elapsed * 2.9 * fs + f * 2));
      // Dust drift.
      const pos = h.dust.points.geometry.attributes.position;
      const { base, phase } = h.dust;
      for (let i = 0; i < phase.length; i++) {
        pos.array[i * 3] = base[i * 3] + 0.22 * Math.sin(elapsed * 0.16 + phase[i] * 1.7);
        pos.array[i * 3 + 1] = base[i * 3 + 1] + 0.3 * Math.sin(elapsed * 0.23 + phase[i]);
        pos.array[i * 3 + 2] = base[i * 3 + 2] + 0.22 * Math.cos(elapsed * 0.19 + phase[i]);
      }
      pos.needsUpdate = true;

      // Warding circle revolves; the void shaft breathes.
      h.runeRing.rotation.z = elapsed * h.runeSpin;
      h.shaft.material.opacity = 0.035 + 0.02 * (1 + Math.sin(elapsed * 0.45 + f));

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

      // Legible books shimmer — the pale spines pulse like slow breathing.
      if (h.coherentInstances.length > 0) {
        let changed = false;
        for (const inst of h.coherentInstances) {
          if (hovered && hovered.room && hovered.instance === inst) continue;
          const glow = 0.86 + 0.2 * Math.sin(elapsed * 1.9 + inst * 1.3);
          tmpColor.setRGB(
            Math.min(1, h.baseColors[inst * 3] * glow),
            Math.min(1, h.baseColors[inst * 3 + 1] * glow),
            Math.min(1, h.baseColors[inst * 3 + 2] * glow)
          );
          h.books.setColorAt(inst, tmpColor);
          changed = true;
        }
        if (changed) h.books.instanceColor.needsUpdate = true;
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
