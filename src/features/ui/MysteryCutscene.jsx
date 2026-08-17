import { useEffect, useState } from 'react';

/** Full-screen mystery beat unlocked by path progress. Click / tap / Enter to continue. */
export default function MysteryCutscene({ revelation, step, of, onContinue, touch }) {
  const [canContinue, setCanContinue] = useState(false);

  useEffect(() => {
    setCanContinue(false);
    const t = setTimeout(() => setCanContinue(true), 1400);
    return () => clearTimeout(t);
  }, [revelation, step]);

  useEffect(() => {
    function onKey(e) {
      if (!canContinue) return;
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault();
        onContinue();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [canContinue, onContinue]);

  return (
    <div
      className={`mystery-cutscene${canContinue ? ' mystery-cutscene-ready' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={revelation.title}
      onClick={() => {
        if (canContinue) onContinue();
      }}
    >
      <div className="mystery-cutscene-vignette" />
      <div className="mystery-cutscene-inner">
        <p className="mystery-cutscene-eyebrow">
          {revelation.eyebrow}
          <span className="mystery-cutscene-step">
            {' '}
            · {step} of {of}
          </span>
        </p>
        <h2 className="mystery-cutscene-title">{revelation.title}</h2>
        {revelation.lines.map((line, i) => (
          <p key={i} className="mystery-cutscene-line" style={{ animationDelay: `${0.45 + i * 0.55}s` }}>
            {line}
          </p>
        ))}
        <p className={`mystery-cutscene-continue${canContinue ? ' show' : ''}`}>
          {touch ? 'tap to continue' : 'click or press Enter to continue'}
        </p>
      </div>
    </div>
  );
}
