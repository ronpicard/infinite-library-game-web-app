# Changelog

## [Unreleased]

### Added

- Library cats (one or two per gallery) that walk, sit, and meow; they are absent from the Crimson Hexagon.
- Crimson Hexagon arrival: neighboring rooms despawn, a title overlay appears, and the lamps turn to embers.
- Pause-menu brightness control.
- Gallery life and atmosphere: owl on a column, moths around the lamps, beetle on the void railing, wandering wisp, drifting pages, and sparkles orbiting marked volumes.
- Tiny luminous beings (five to eight per gallery) that flow around the room and drift toward open doorways.

### Changed

- Only marked volumes (pale glowing spines with silk ribbons) can be opened.
- Typically one or two readable books per gallery (a clue plus an optional aphorism); the origin room also holds the intro letter.
- Audio uses sine and triangle tones only (no noise generators); page turns are plucked notes, and cats meow.

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
- Default brightness is a little higher (pause slider starts at 118).
