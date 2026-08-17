/** Fading text that plays over the final chamber's seal cinematic. */
export default function CrimsonArrival() {
  return (
    <div className="crimson-arrival" aria-live="polite" data-testid="crimson-arrival">
      <div className="crimson-arrival-inner">
        <p className="crimson-arrival-eyebrow">The way ends here</p>
        <h2 className="crimson-arrival-title">The Crimson Hexagon</h2>
        <p className="crimson-arrival-body">
          The doors close behind you. The lamps turn to embers.
        </p>
      </div>
    </div>
  );
}
