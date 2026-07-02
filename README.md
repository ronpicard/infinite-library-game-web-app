# The Library of Babel

A 3D first-person exploration game inspired by Jorge Luis Borges' short story,
built with React and Three.js.

You wake in an infinite grid of hexagonal galleries. Every wall is shelved with
books, and almost every book is seeded gibberish — but a rare few are legible,
and the legible ones remember the way to the **Crimson Hexagon**: a red-lit
gallery holding one perfect book on a pedestal.

## How to play

- **Click** the splash screen to enter, then move with **WASD** (hold **Shift**
  to hurry) and look with the **mouse** (pointer lock).
- Aim at a book and press **E** (or click) to open it; **ESC** returns it.
- **ESC** while walking opens the pause menu (resume or restart the search).
- **On phones and tablets** the game switches to touch controls: a virtual
  joystick to walk, drag anywhere to look, tap a book (or the READ button)
  to open it, and a pause button in the corner.
- Search the shelves for **pale ivory spines** — they are the legible books.
  A clue book lists five galleries to walk, by the Library's compass
  (*the rising dust, the burning lamp, the sleeping water, the falling ash,
  the silent frost, the red wind*). The HUD shows which direction you face.
- Walk the five thresholds without error and the next gallery burns crimson.
  A wrong turn dissolves the path — any clue book in the room you stand in
  will name a fresh one.
- The HUD tracks galleries visited, books opened, and legible fragments found.

## The world

- Rooms are generated as you walk and despawned behind you; only ~7 galleries
  are ever loaded.
- Each gallery is built in one of five ancient styles drawn from its seed —
  oak hall, sandstone vault, marble rotunda, basalt archive, cedar
  scriptorium — with columns, cornices, beams and worn floor mosaics.
- Sound is synthesized live with Tone.js: a low drone, distant echoes,
  footsteps, page rustles, and quiet cues when the path holds or crumbles.
- Every room is a pure function of its coordinates: backtrack and the same
  shelves hold the same books with the same text.
- The void at the center of each gallery looks onto identical floors above and
  below (mirrored geometry and fog — the Library is taller than it renders).

## Development

```bash
npm install
npm run dev      # local dev server
npm run verify   # deterministic-world sanity checks (door symmetry, quest completability)
npm run build    # production build in dist/
```

## Deploying to GitHub Pages

The Vite config uses `base: './'`, so the build works from any repo path.

- **Automatic:** push to `main`. The included workflow
  (`.github/workflows/deploy.yml`) builds and publishes to Pages.
  In the repository settings, set **Pages → Source** to **GitHub Actions**.
- **Manual:** `npm run build`, then publish the `dist/` folder however you like.

## Stack

React 19 · Three.js · Tone.js · Vite
