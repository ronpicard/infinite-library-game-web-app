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
        <div className="splash-rule" />
      </div>
    </div>
  );
}
