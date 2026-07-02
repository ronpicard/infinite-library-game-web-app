const KIND_LABEL = {
  gibberish: null,
  aphorism: 'something legible surfaces',
  clue: 'a legible account',
  intro: 'a letter',
};

export default function BookOverlay({ book, onClose }) {
  const label = KIND_LABEL[book.kind];
  return (
    <div className="overlay book-overlay">
      <div className={`book-page kind-${book.kind}`}>
        {label && <div className="book-kind">{label}</div>}
        <h2 className="book-title">{book.title}</h2>
        <div className="book-body">{book.body}</div>
        <button className="serif-button book-close" onClick={onClose}>
          return the book — ESC
        </button>
      </div>
    </div>
  );
}
