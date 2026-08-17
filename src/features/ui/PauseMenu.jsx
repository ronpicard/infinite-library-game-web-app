export default function PauseMenu({
  onResume,
  onRestart,
  touch,
  volume,
  muted,
  onVolume,
  onToggleMute,
  brightness,
  onBrightness,
}) {
  return (
    <div
      className="overlay pause-menu"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="pause-inner">
        <div className="splash-rule" />
        <h1 id="pause-title" className="pause-title">
          A Pause Among the Shelves
        </h1>
        <div className="pause-buttons">
          <button className="serif-button" onClick={onResume}>
            Resume
          </button>
          <button className="serif-button pause-restart" onClick={onRestart}>
            Restart the Search
          </button>
        </div>

        <div className="settings">
          <div className="settings-title">display</div>
          <label className="settings-row">
            <span>brightness</span>
            <input
              type="range"
              min="40"
              max="180"
              value={Math.round(brightness * 100)}
              onChange={(e) => onBrightness(Number(e.target.value) / 100)}
            />
          </label>
        </div>

        <div className="settings">
          <div className="settings-title">sound</div>
          <label className="settings-row">
            <span>volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onChange={(e) => onVolume(Number(e.target.value) / 100)}
              disabled={muted}
            />
          </label>
          <button className="serif-button settings-mute" onClick={onToggleMute}>
            {muted ? 'unmute' : 'mute'}
          </button>
        </div>

        <p className="pause-nav-hint">
          Open a marked volume for the way. Follow the named directions — the HUD
          shows which way you face — and keep to the path of five galleries.
        </p>

        <div className="splash-controls">
          {touch ? (
            <>
              <span>left stick — walk</span>
              <span>drag — look</span>
              <span>tap a book — read</span>
            </>
          ) : (
            <>
              <span>WASD — walk</span>
              <span>mouse — look</span>
              <span>E / click — open a book</span>
              <span>ESC — pause</span>
            </>
          )}
        </div>
        <div className="splash-rule" />
      </div>
    </div>
  );
}
