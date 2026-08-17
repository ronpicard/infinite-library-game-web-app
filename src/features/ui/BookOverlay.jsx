const KIND_LABEL = {
  gibberish: null,
  clue: 'a legible account',
};

/**
 * A book you've opened. Renders as fading text over the running game — no
 * paper page, no pause. Dismissed by ESC (handled at the app level), by
 * opening another book, by leaving the room, or by tapping / clicking the
 * overlay when pointer lock is not held.
 */
export default function BookOverlay({ book, onClose }) {
  const label = KIND_LABEL[book.kind];
  return (
    <div
      className={`book-text-overlay kind-${book.kind}`}
      role="dialog"
      aria-modal="false"
      aria-label={book.title}
    >
      <div className="book-text-inner">
        {label && <div className="book-text-kind">{label}</div>}
        <h2 className="book-text-title">{book.title}</h2>
        <div className="book-text-body">{book.body}</div>
        <button type="button" className="book-text-hint" onClick={onClose}>
          esc · close
        </button>
      </div>
    </div>
  );
}
