# Changelog

## [Unreleased]

### Added

- Library cats (one or two per gallery) that walk, sit, and meow; they are absent from the Crimson Hexagon.
- Crimson Hexagon arrival: neighboring rooms despawn, a title overlay appears, and the lamps turn to embers.
- Pause-menu brightness control.
- Gallery life and atmosphere: owl on a column, moths around the lamps, beetle on the void railing, wandering wisp, drifting pages, and sparkles orbiting marked volumes.
- Tiny luminous beings (five to eight per gallery) that flow around the room and drift toward open doorways.
- Unique seeded patterns on each gallery's floor and walls (tiles, flagstone, brick, glyphs, and the like).

### Changed

- Only marked volumes (pale glowing spines with silk ribbons) can be opened.
- Exactly one readable clue book per gallery — the only volume you can open.
- Audio uses sine and triangle tones only (no noise generators); page turns are plucked notes, and cats meow.
- Ancient gallery palettes are vibrant purple and blue (amethyst, lapis, indigo, midnight, cobalt) instead of oak and sandstone.
- Default brightness is higher (pause slider starts at 152).

### Fixed

- Marked volumes no longer lose their shared material when a neighboring gallery streams out.
- Crimson arrival lamp pulse is no longer overwritten by the ambient flicker the same frame.
- Touch look is frozen during the arrival cinematic, matching mouse look.
- Double-clicking Enter the Library no longer starts two audio graphs.
- Cat, owl, and beetle geometries are disposed when a gallery unloads.
- Path revelation cutscenes count "N of 5", matching the HUD.
- Taking the Crimson book opens the ending overlay immediately; it no longer shows "click to walk again" first.
- Doorways are wider, with inset posts and rounded jamb collision so walking through no longer clips the frames.
- Gallery lamps crossfade between rooms and flicker more softly; brightness changes ease instead of jumping.
- Door frames no longer overlap into the passage: each gallery builds a half-thickness frame on the outer edge band, posts sit above a raised sill, and the floor threshold stays clear.
