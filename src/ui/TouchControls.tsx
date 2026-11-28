import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { touch, latch, clearTouch, type TouchAction } from '../shared/touch';
import { T } from '../shared/i18n';
import type { Bi } from '../shared/i18n';

/** Floating thumbstick: touch anywhere in the left zone, the stick centres there. */
function Stick() {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);

  const apply = (dx: number, dy: number) => {
    touch.left = dx < -16;
    touch.right = dx > 16;
    touch.up = dy < -34;
    touch.down = dy > 34;
    const d = Math.hypot(dx, dy);
    const k = d > 46 ? 46 / d : 1;
    setKnob({ x: dx * k, y: dy * k });
  };
  const release = () => {
    id.current = null;
    setOrigin(null);
    touch.left = touch.right = touch.up = touch.down = false;
  };

  return (
    <div
      className="touch-stick-zone"
      onPointerDown={(e) => {
        if (id.current !== null) return;
        id.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        setOrigin({ x: e.clientX, y: e.clientY });
        apply(0, 0);
      }}
      onPointerMove={(e) => {
        if (e.pointerId !== id.current || !origin) return;
        apply(e.clientX - origin.x, e.clientY - origin.y);
      }}
      onPointerUp={(e) => e.pointerId === id.current && release()}
      onPointerCancel={(e) => e.pointerId === id.current && release()}
    >
      {origin ? (
        <div className="touch-stick" style={{ left: origin.x, top: origin.y }}>
          <div className="touch-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
        </div>
      ) : (
        <div className="touch-stick idle">
          <div className="touch-knob" />
        </div>
      )}
    </div>
  );
}

function Btn({ action, label, className, disabled }: { action: TouchAction; label: Bi | string; className: string; disabled?: boolean }) {
  const [down, setDown] = useState(false);
  const set = (v: boolean) => {
    touch[action] = v;
    if (v) latch.add(action);
    setDown(v);
  };
  const onDown = (e: RPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    set(true);
  };
  return (
    <button
      className={`touch-btn ${className} ${down ? 'down' : ''} ${disabled ? 'disabled' : ''}`}
      onPointerDown={onDown}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {typeof label === 'string' ? (
        label
      ) : (
        <>
          <span className="en">{label.en}</span>
          <span className="he" lang="he" dir="rtl">
            {label.he}
          </span>
        </>
      )}
    </button>
  );
}

export function TouchControls({ dash }: { dash: boolean }) {
  useEffect(() => clearTouch, []);
  return (
    <div className="touch-layer">
      <Stick />
      <Btn action="pause" label="❚❚" className="t-pause" />
      <div className="touch-actions">
        <Btn action="siphon" label={T.touch.siphon} className="t-siphon" />
        <Btn action="release" label={T.touch.release} className="t-release" />
        <Btn action="dash" label={T.touch.dash} className="t-dash" disabled={!dash} />
        <Btn action="jump" label={T.touch.jump} className="t-jump" />
      </div>
    </div>
  );
}
