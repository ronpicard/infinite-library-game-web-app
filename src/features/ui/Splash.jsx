export default function Splash({ onStart, touch }) {
  return (
    <div
      className="overlay splash"
      data-testid="splash"
      role="dialog"
      aria-modal="true"
      aria-labelledby="splash-title"
    >
      <div className="splash-inner">
        <div className="splash-rule" />
        <h1 id="splash-title" className="splash-title">
          The Library of Babel
        </h1>
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
          One marked volume per gallery — pale spine, silk ribbon, glowing faintly
          among the shelves. Only it can be opened.
        </p>
        <p className="splash-nav">
          Read it for the path: five galleries in named directions. Match the
          compass at the top of the screen and walk that way through a doorway.
          Step wrong and the path forgets you; return to the clue book and begin
          anew.
        </p>
        <div className="splash-rule" />
      </div>
    </div>
  );
}
