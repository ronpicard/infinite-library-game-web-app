import { useCallback, useRef, useState } from 'react';

const STICK_RADIUS = 52;

/**
 * Virtual joystick (movement) plus READ and pause buttons for touch devices.
 * Look-around dragging is handled by the engine directly on the canvas.
 */
export default function TouchControls({ onMove, onInteract, onPause, hovering }) {
  const baseRef = useRef(null);
  const touchIdRef = useRef(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });

  const updateFromTouch = useCallback(
    (touch) => {
      const rect = baseRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = touch.clientX - cx;
      let dy = touch.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        dx = (dx / len) * STICK_RADIUS;
        dy = (dy / len) * STICK_RADIUS;
      }
      setThumb({ x: dx, y: dy });
      // Joystick up = forward.
      onMove(dx / STICK_RADIUS, -dy / STICK_RADIUS);
    },
    [onMove]
  );

  const handleStart = useCallback(
    (e) => {
      e.preventDefault();
      if (touchIdRef.current !== null) return;
      const t = e.changedTouches[0];
      touchIdRef.current = t.identifier;
      updateFromTouch(t);
    },
    [updateFromTouch]
  );

  const handleMove = useCallback(
    (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === touchIdRef.current) updateFromTouch(t);
      }
    },
    [updateFromTouch]
  );

  const handleEnd = useCallback(
    (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== touchIdRef.current) continue;
        touchIdRef.current = null;
        setThumb({ x: 0, y: 0 });
        onMove(0, 0);
      }
    },
    [onMove]
  );

  return (
    <div className="touch-controls">
      <div
        ref={baseRef}
        className="joystick"
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
      >
        <div
          className="joystick-thumb"
          style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }}
        />
      </div>
      {hovering && (
        <button className="touch-read" onClick={onInteract}>
          read
        </button>
      )}
      <button className="touch-pause" onClick={onPause} aria-label="Pause">
        ❚❚
      </button>
    </div>
  );
}
