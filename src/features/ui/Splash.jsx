export default function Splash({ onStart, touch }) {
  return (
    <div className="overlay splash">
      <div className="splash-inner">
        <div className="splash-rule" />
        <h1 className="splash-title">The Library of Babel</h1>
        <p className="splash-homage">
          Every book that could ever be written waits on these shelves; almost
          none of them can be read.
        </p>
        <button className="serif-button" onClick={onStart}>
          Enter the Library
        </button>
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
        <p className="splash-goal">Find the Crimson Hexagon.</p>
        <p className="splash-hint">
          Only the marked volumes can be opened — pale spines with silk ribbons,
          glowing faintly among the shelves.
        </p>
        <p className="splash-nav">
          Read a marked book for the path: five galleries in named directions.
          Match the compass in the corner of the screen — “facing — the silent
          frost” and the like — and walk that way through a doorway. Step wrong
          and the path forgets you; return to any legible book and begin anew.
        </p>
        <div className="splash-rule" />
      </div>
    </div>
  );
}
