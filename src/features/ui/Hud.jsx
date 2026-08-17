import { PATH_LENGTH } from '../world/index.js';

export default function Hud({
  stats,
  questProgress,
  facingName,
  showCrosshair,
  showInteract,
  showResumeHint,
  toast,
}) {
  return (
    <div className="hud">
      {showCrosshair && <div className="crosshair" />}

      <div className="hud-top">
        <div className="hud-facing">
          facing — <em>{facingName}</em>
        </div>
        <div className="hud-path" title="the way to the Crimson Hexagon">
          {Array.from({ length: PATH_LENGTH }, (_, i) => (
            <span key={i} className={i < questProgress ? 'path-dot lit' : 'path-dot'} />
          ))}
        </div>
      </div>

      <div className="hud-stats">
        <span>{stats.rooms} galleries</span>
        <span>{stats.books} books opened</span>
        <span>{stats.fragments} legible fragments</span>
      </div>

      {showInteract && <div className="hud-interact">read marked volume — E</div>}

      {showResumeHint && <div className="hud-resume">click to walk again</div>}

      {toast && (
        <div className="hud-toast" key={toast.at}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
