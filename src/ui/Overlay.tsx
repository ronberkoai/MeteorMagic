import { useEffect, useRef, useState } from 'react';
import { bus, ChargeState, EndStats, HudState } from '../shared/eventBus';
import { formatTime } from '../logic/GameState';
import { session } from '../game/session';
import { audio } from '../game/systems/Audio';

type Screen = 'loading' | 'title' | 'playing' | 'paused' | 'end';

const CONTROLS: [string, string][] = [
  ['Move', 'A / D  or  ← / →'],
  ['Jump', 'Space  or  Z   (hold for higher)'],
  ['Siphon fire', 'E  or  J   (tap near fire or an incoming fire arrow)'],
  ['Release fireball', 'F  or  L   (hold W/S or ↑/↓ to aim)'],
  ['Kinetic Surge dash', 'Shift  or  K   (once you find it)'],
  ['Drop through planks', 'S / ↓ + Jump'],
  ['Pause', 'Esc  or  P'],
  ['Mute', 'M'],
];

export function Overlay() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [hasSave, setHasSave] = useState(false);
  const [hud, setHud] = useState<HudState>({ health: 5, maxHealth: 5, dash: false });
  const [sign, setSign] = useState<string | null>(null);
  const [room, setRoom] = useState<{ name: string; key: number } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; title: string; body: string }[]>([]);
  const [end, setEnd] = useState<EndStats | null>(null);
  const [muted, setMuted] = useState(false);
  const charge = useRef<ChargeState>({ type: null, endsAt: 0, totalMs: 10000 });
  const barRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const siphonRef = useRef<{ until: number; total: number }>({ until: 0, total: 1 });
  const siphonBarRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  useEffect(() => {
    let id = 0;
    const offs = [
      bus.on('game:ready', () => {
        setHasSave(session.hasSave());
        setScreen('title');
      }),
      bus.on('hud:update', setHud),
      bus.on('hud:charge', (c) => (charge.current = c)),
      bus.on('hud:siphon', ({ cooldownMs }) => (siphonRef.current = { until: performance.now() + cooldownMs, total: cooldownMs })),
      bus.on('ui:sign', ({ text }) => setSign(text)),
      bus.on('ui:room', ({ name }) => setRoom({ name, key: Date.now() })),
      bus.on('ui:toast', ({ title, body }) => {
        const tid = ++id;
        setToasts((t) => [...t, { id: tid, title, body }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), 6500);
      }),
      bus.on('ui:paused', ({ paused }) => setScreen((s) => (paused ? 'paused' : s === 'paused' ? 'playing' : s))),
      bus.on('game:end', (stats) => {
        setEnd(stats);
        setScreen('end');
      }),
    ];
    return () => offs.forEach((o) => o());
  }, []);

  // Animate the energy meter without re-rendering React every frame.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const c = charge.current;
      const now = performance.now();
      const pct = c.type ? Math.max(0, Math.min(1, (c.endsAt - now) / c.totalMs)) : 0;
      if (barRef.current) barRef.current.style.width = `${pct * 100}%`;
      if (orbRef.current) orbRef.current.classList.toggle('charged', !!c.type && pct > 0);
      const s = siphonRef.current;
      const sp = s.until > now ? 1 - (s.until - now) / s.total : 1;
      if (siphonBarRef.current) siphonBarRef.current.style.transform = `scaleX(${sp})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'm' || e.key === 'M') setMuted(audio.toggleMute());
      const s = screenRef.current;
      if (s === 'paused' && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) bus.emit('cmd:resume', {});
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const start = (continueSave: boolean) => {
    setToasts([]);
    setSign(null);
    setEnd(null);
    setScreen('playing');
    bus.emit('cmd:start', { continueSave });
  };
  const toTitle = () => {
    setHasSave(session.hasSave());
    setScreen('title');
    bus.emit('cmd:quitToTitle', {});
  };

  const showHud = screen === 'playing' || screen === 'paused';

  return (
    <div className="overlay">
      {screen === 'loading' && <div className="center loading">Gathering meteor dust…</div>}

      {screen === 'title' && (
        <div className="center title">
          <h1>
            Meteor<span>Magic</span>
          </h1>
          <p className="tag">The bandits burned your village. The meteor chose you.</p>
          <div className="menu">
            {hasSave && (
              <button autoFocus onClick={() => start(true)}>
                Continue
              </button>
            )}
            <button autoFocus={!hasSave} onClick={() => start(false)}>
              {hasSave ? 'New game' : 'Start'}
            </button>
          </div>
          <Controls />
          <p className="small">Test build · keyboard or gamepad · about 10–15 minutes</p>
        </div>
      )}

      {showHud && (
        <>
          <div className="hud">
            <div className="hearts">
              {Array.from({ length: hud.maxHealth }).map((_, i) => (
                <div key={i} className={`heart ${i < hud.health ? 'full' : ''}`} />
              ))}
            </div>
            <div className="energy">
              <div ref={orbRef} className="orb" title="Meteor energy" />
              <div className="meter">
                <div ref={barRef} className="fill" />
              </div>
              <div className="siphon">
                <div ref={siphonBarRef} className="sfill" />
              </div>
            </div>
            <div className="powers">
              <span className="power on">Ember Siphon</span>
              <span className={`power ${hud.dash ? 'on' : ''}`}>{hud.dash ? 'Kinetic Surge' : '???'}</span>
              {muted && <span className="power">muted</span>}
            </div>
          </div>
          {room && (
            <div key={room.key} className="roomname">
              {room.name}
            </div>
          )}
          {sign && <div className="sign">{sign}</div>}
          <div className="toasts">
            {toasts.map((t) => (
              <div key={t.id} className="toast">
                <b>{t.title}</b>
                <span>{t.body}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {screen === 'paused' && (
        <div className="center panel">
          <h2>Paused</h2>
          <div className="menu">
            <button autoFocus onClick={() => bus.emit('cmd:resume', {})}>
              Resume
            </button>
            <button onClick={toTitle}>Quit to title</button>
          </div>
          <Controls />
        </div>
      )}

      {screen === 'end' && end && (
        <div className="center panel end">
          <h2>End of the test build</h2>
          <p>The patrol camp has fallen. The bandit fortress, and the meteor machine, wait beyond the hills.</p>
          <div className="stats">
            <div>
              <b>{formatTime(end.timeMs)}</b>
              <span>time</span>
            </div>
            <div>
              <b>{end.deaths}</b>
              <span>falls</span>
            </div>
            <div>
              <b>
                {end.shards}/{end.totalShards}
              </b>
              <span>heart shards</span>
            </div>
          </div>
          <p className="small">Thanks for playing! Tell us where you got stuck and what felt great.</p>
          <div className="menu">
            <button autoFocus onClick={toTitle}>
              Back to title
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Controls() {
  return (
    <table className="controls">
      <tbody>
        {CONTROLS.map(([a, k]) => (
          <tr key={a}>
            <td>{a}</td>
            <td>{k}</td>
          </tr>
        ))}
        <tr>
          <td>Gamepad</td>
          <td>A jump · X siphon · Y/RB release · B/LB dash</td>
        </tr>
      </tbody>
    </table>
  );
}
