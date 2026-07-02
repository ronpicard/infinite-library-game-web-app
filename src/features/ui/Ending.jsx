import { getCrimsonBookContent } from '../books/index.js';

export default function Ending({ stats, onRestart }) {
  const book = getCrimsonBookContent();
  return (
    <div className="overlay ending">
      <div className="ending-inner">
        <div className="splash-rule crimson" />
        <h1 className="ending-title">The Crimson Hexagon</h1>
        <h2 className="ending-book-title">{book.title}</h2>
        <div className="ending-body">{book.body}</div>
        <div className="ending-stats">
          {stats.rooms} galleries walked · {stats.books} books opened ·{' '}
          {stats.fragments} legible fragments found
        </div>
        <button className="serif-button pause-restart" onClick={onRestart}>
          Begin Again
        </button>
        <div className="splash-rule crimson" />
      </div>
    </div>
  );
}
