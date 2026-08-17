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
- Aim at a marked volume and press **E** (or click) to open it; **ESC** returns
  it.
- **ESC** while walking opens the pause menu: resume, restart, brightness, and
  volume (or mute).
- **On phones and tablets** the game switches to touch controls: a virtual
  joystick to walk, drag anywhere to look, tap a book (or the READ button)
  to open it, and a pause button in the corner.
- Search the shelves for **marked volumes** — pale glowing spines with crimson
  silk ribbons and a faint orbit of sparkles: one clue book per gallery.
  Unmarked books cannot be opened.
- A clue book lists five galleries to walk, by the Library's compass
  (*the rising dust, the burning lamp, the sleeping water, the falling ash,
  the silent frost, the red wind*). The HUD shows which direction you face.
- Walk the five thresholds without error and the doors seal: neighboring
  galleries vanish, and the chamber becomes the Crimson Hexagon. A wrong turn
  dissolves the path — any clue book in the room you stand in will name a
  fresh one.
- The HUD tracks galleries visited, books opened, and legible fragments found.

## The world

- Rooms are generated as you walk and despawned behind you; only the current
  gallery and its six neighbors are loaded. Arriving at the Crimson Hexagon
  seals you into that single chamber.
- Each gallery is built in one of five ancient styles drawn from its seed —
  oak hall, sandstone vault, marble rotunda, basalt archive, cedar
  scriptorium — with columns, cornices, beams, and a unique floor and wall
  pattern. Ancient glyphs — the rune ring around the void, the doorway
  sigils, and the motes drifting up the light shaft — burn in vibrant purple
  and blue against the warm lamplight.
- Library cats wander the floor (one or two per gallery, never in the Crimson
  Hexagon): they walk, sit, and meow. Tiny luminous beings ride a slow current
  around each gallery and drift toward open doorways. Owls watch from column
  capitals; moths circle the lamps; a beetle crawls the void railing; torn
  pages drift upward like ash.
- Sound is synthesized live with Tone.js (sine and triangle tones, no noise
  generators): a low drone, distant echoes, footsteps, page turns, cat meows,
  and quiet cues when the path holds, crumbles, or the lamps turn to embers.
- Every room is a pure function of its coordinates: backtrack and the same
  shelves hold the same books with the same text.
- The void at the center of each gallery looks onto identical floors above and
  below (mirrored geometry and fog — the Library is taller than it renders).

## Development

```bash
npm install
npx playwright install chromium   # once, for overlay/smoke tests
npm run dev      # local dev server
npm test         # unit tests (Vitest)
npm run test:e2e # overlay + smoke tests (Playwright)
npm run verify   # deterministic-world sanity checks (door symmetry, quest completability)
npm run build    # production build in dist/
```

Requires Node 20 or newer.

Feature folders live under `src/features/`: `game` (engine, room mesh, cats),
`world` (hex grid, room data, quest path), `books` (seeded text), `audio`
(Tone.js), and `ui` (splash, HUD, pause, overlays).

## Deploying to GitHub Pages

The Vite config uses `base: './'`, so the build works from any repo path.

- **Automatic:** push to `main`. The included workflow
  (`.github/workflows/deploy.yml`) builds and publishes to Pages.
  In the repository settings, set **Pages → Source** to **GitHub Actions**.
- **Manual:** `npm run build`, then publish the `dist/` folder however you like.

## Stack

React 19 · Three.js · Tone.js · Vite

## License

MIT. See [LICENSE](LICENSE).
