import { useEffect, useRef, useState } from 'react';
import { bus, ChargeState, EndStats, HudState } from '../shared/eventBus';
import { Bi, T } from '../shared/i18n';
import { formatTime } from '../logic/GameState';
import { session } from '../game/session';
import { audio } from '../game/systems/Audio';

type Screen = 'loading' | 'title' | 'intro' | 'playing' | 'paused' | 'end';

/** English and Hebrew together; Hebrew is laid out right-to-left. */
export function B({ t, inline = false }: { t: Bi; inline?: boolean }) {
  return (
    <span className={inline ? 'bi inline' : 'bi'}>
      <span className="en" lang="en">
        {t.en}
      </span>
      <span className="he" lang="he" dir="rtl">
        {t.he}
      </span>
    </span>
  );
}

export function Overlay() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [hasSave, setHasSave] = useState(false);
  const [hud, setHud] = useState<HudState>({ health: 5, maxHealth: 5, dash: false });
  const [sign, setSign] = useState<Bi | null>(null);
  const [caption, setCaption] = useState<{ t: Bi; key: number } | null>(null);
  const [room, setRoom] = useState<{ name: Bi; key: number } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; title: Bi; body: Bi }[]>([]);
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
      bus.on('ui:caption', ({ text }) => setCaption(text ? { t: text, key: Date.now() } : null)),
      bus.on('ui:intro', ({ active }) => {
        setScreen(active ? 'intro' : 'playing');
        if (!active) setCaption(null);
      }),
      bus.on('ui:room', ({ name }) => setRoom({ name, key: Date.now() })),
      bus.on('ui:toast', ({ title, body }) => {
        const tid = ++id;
        setToasts((t) => [...t, { id: tid, title, body }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), 7000);
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
      if (s === 'intro' && (e.key === 'Escape' || e.key === 'Enter')) bus.emit('cmd:skipIntro', {});
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const start = (continueSave: boolean, intro = !continueSave) => {
    setToasts([]);
    setSign(null);
    setEnd(null);
    setCaption(null);
    setScreen(intro ? 'intro' : 'playing');
    bus.emit('cmd:start', { continueSave, intro });
  };
  const toTitle = () => {
    setHasSave(session.hasSave());
    setScreen('title');
    bus.emit('cmd:quitToTitle', {});
  };

  const showHud = screen === 'playing' || screen === 'paused';

  return (
    <div className="overlay">
      <div className="vignette" />
      {screen === 'loading' && (
        <div className="center loading">
          <B t={T.loading} />
        </div>
      )}

      {screen === 'title' && (
        <div className="center title">
          <h1>
            Meteor<span>Magic</span>
          </h1>
          <div className="he-title" lang="he" dir="rtl">
            קסם המטאור
          </div>
          <p className="tag">
            <B t={T.tagline} />
          </p>
          <div className="menu">
            {hasSave && (
              <button autoFocus onClick={() => start(true)}>
                <B t={T.continue} />
              </button>
            )}
            <button autoFocus={!hasSave} onClick={() => start(false)}>
              <B t={hasSave ? T.newGame : T.start} />
            </button>
            {hasSave && (
              <button className="ghost" onClick={() => start(true, true)}>
                <B t={T.replayIntro} />
              </button>
            )}
          </div>
          <Controls />
          <p className="small">
            <B t={T.titleNote} />
          </p>
        </div>
      )}

      {screen === 'intro' && (
        <>
          <div className="letterbox top" />
          <div className="letterbox bottom" />
          {caption && (
            <div key={caption.key} className="caption">
              <B t={caption.t} />
            </div>
          )}
          <button className="skip" onClick={() => bus.emit('cmd:skipIntro', {})}>
            <B t={T.skip} inline /> ⏭
          </button>
        </>
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
              <div ref={orbRef} className="orb" title="Meteor energy · אנרגיית מטאור" />
              <div className="meter">
                <div ref={barRef} className="fill" />
              </div>
              <div className="siphon">
                <div ref={siphonBarRef} className="sfill" />
              </div>
            </div>
            <div className="powers">
              <span className="power on">
                <B t={T.emberSiphon} inline />
              </span>
              <span className={`power ${hud.dash ? 'on' : ''}`}>{hud.dash ? <B t={T.kineticSurge} inline /> : '???'}</span>
              {muted && (
                <span className="power">
                  <B t={T.muted} inline />
                </span>
              )}
            </div>
          </div>
          {room && (
            <div key={room.key} className="roomname">
              <B t={room.name} />
            </div>
          )}
          {sign && (
            <div className="sign">
              <B t={sign} />
            </div>
          )}
          <div className="toasts">
            {toasts.map((t) => (
              <div key={t.id} className="toast">
                <b>
                  <B t={t.title} />
                </b>
                <span>
                  <B t={t.body} />
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {screen === 'paused' && (
        <div className="center panel pause">
          <h2>
            <B t={T.paused} />
          </h2>
          <div className="menu">
            <button autoFocus onClick={() => bus.emit('cmd:resume', {})}>
              <B t={T.resume} />
            </button>
            <button onClick={toTitle}>
              <B t={T.quit} />
            </button>
          </div>
          <Controls />
        </div>
      )}

      {screen === 'end' && end && (
        <div className="center panel end">
          <h2>
            <B t={T.endTitle} />
          </h2>
          <p>
            <B t={T.endText} />
          </p>
          <div className="stats">
            <div>
              <b>{formatTime(end.timeMs)}</b>
              <B t={T.time} />
            </div>
            <div>
              <b>{end.deaths}</b>
              <B t={T.falls} />
            </div>
            <div>
              <b>
                {end.shards}/{end.totalShards}
              </b>
              <B t={T.heartShards} />
            </div>
          </div>
          <p className="small">
            <B t={T.thanks} />
          </p>
          <div className="menu">
            <button autoFocus onClick={toTitle}>
              <B t={T.backToTitle} />
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
        {T.controls.map(([label, keys, note]) => (
          <tr key={label.en}>
            <td className="c-en">{label.en}</td>
            <td className="c-keys">
              <kbd>{keys}</kbd>
              {note && (
                <div className="note">
                  <B t={note} inline />
                </div>
              )}
            </td>
            <td className="c-he" lang="he" dir="rtl">
              {label.he}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
