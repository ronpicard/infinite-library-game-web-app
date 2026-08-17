import { useCallback, useEffect, useState } from 'react';
import { mysteryProgressLabel } from '../world/index.js';

const READY_DELAY_MS = 1400;
const PER_LINE_READ_MS = 3200;
const TRAILING_READ_MS = 2400;
const FADE_OUT_MS = 900;

/**
 * A revelation beat unlocked by path progress. Renders as fading text over
 * the running game — no vignette, no pause. Auto-fades after a read window;
 * user can also dismiss early with Enter / Space / E once the read window opens.
 */
export default function MysteryCutscene({ revelation, step, of, onContinue }) {
  const [canContinue, setCanContinue] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    setCanContinue(false);
    setDismissing(false);
    const readyT = setTimeout(() => setCanContinue(true), READY_DELAY_MS);
    // Auto-dismiss once the reader has had time to take in every line.
    const displayMs = revelation.lines.length * PER_LINE_READ_MS + TRAILING_READ_MS;
    const autoT = setTimeout(() => setDismissing(true), displayMs);
    return () => {
      clearTimeout(readyT);
      clearTimeout(autoT);
    };
  }, [revelation, step]);

  // Once the fade-out animation has played, actually clear the mystery.
  useEffect(() => {
    if (!dismissing) return;
    const t = setTimeout(onContinue, FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [dismissing, onContinue]);

  const dismiss = useCallback(() => {
    if (canContinue && !dismissing) setDismissing(true);
  }, [canContinue, dismissing]);

  useEffect(() => {
    function onKey(e) {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
        e.preventDefault();
        dismiss();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dismiss]);

  const cls = [
    'mystery-cutscene',
    canContinue && !dismissing ? 'mystery-cutscene-ready' : '',
    dismissing ? 'mystery-cutscene-dismissing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="dialog" aria-modal="false" aria-label={revelation.title}>
      <div className="mystery-cutscene-inner">
        <p className="mystery-cutscene-eyebrow">
          {revelation.eyebrow}
          <span className="mystery-cutscene-step">
            {' '}
            · {mysteryProgressLabel(step, of)}
          </span>
        </p>
        <h2 className="mystery-cutscene-title">{revelation.title}</h2>
        {revelation.lines.map((line, i) => (
          <p
            key={i}
            className="mystery-cutscene-line"
            style={{ animationDelay: `${0.45 + i * 0.55}s` }}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
