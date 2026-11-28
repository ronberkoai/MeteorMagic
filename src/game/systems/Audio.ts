/**
 * Tiny synthesized audio (WebAudio, no files): sound effects plus two ambient music beds
 * ("dark" and "fantasy") that crossfade by room mood. Swap for Howler + recorded audio later.
 */
type Bed = 'dark' | 'fantasy';

const NOTES_DARK = [110, 130.81, 146.83, 164.81, 174.61, 196, 220];
const NOTES_FANTASY = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private beds: Record<Bed, { gain: GainNode; nodes: AudioNode[] }> | null = null;
  private current: Bed | null = null;
  private nextNoteAt = 0;
  private noteStep = 0;
  private paused = false;
  private suspendTimer: number | undefined;
  muted = false;

  /** True while a music bed is active (gameplay or intro running). */
  get playing() {
    return this.current !== null;
  }

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.55;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicBus.connect(this.master);
    this.beds = { dark: this.makeDrone([55, 82.4, 110.5], 420), fantasy: this.makeDrone([130.81, 196, 261.63], 900) };
    // Never keep humming in a background tab.
    document.addEventListener('visibilitychange', () => this.syncContext());
  }

  /** Run the AudioContext only while the tab is visible and a game/intro is active. */
  private syncContext() {
    if (!this.ctx) return;
    window.clearTimeout(this.suspendTimer);
    const shouldRun = !document.hidden && this.current !== null;
    if (shouldRun) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } else if (this.ctx.state === 'running') {
      void this.ctx.suspend();
    }
  }

  /** Fade out all music and suspend audio entirely (title screen, end screen, game torn down). */
  stopMusic() {
    if (!this.ctx || !this.beds) return;
    const t = this.ctx.currentTime;
    (Object.keys(this.beds) as Bed[]).forEach((b) => {
      const g = this.beds![b].gain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + 0.6);
    });
    this.current = null;
    window.clearTimeout(this.suspendTimer);
    // Let the fade (and any final sfx) finish, then stop the oscillators' clock.
    this.suspendTimer = window.setTimeout(() => this.syncContext(), 1200);
  }

  /** Silence the music bed while the game is paused (sfx bus is unaffected). */
  setPaused(paused: boolean) {
    this.paused = paused;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = this.musicBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(paused ? 0 : 0.32, t + 0.25);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  private makeDrone(freqs: number[], cutoff: number) {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    filter.connect(gain);
    gain.connect(this.musicBus);
    const nodes: AudioNode[] = [filter];
    freqs.forEach((f, i) => {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'sawtooth' : 'triangle';
        o.frequency.value = f;
        o.detune.value = det;
        const g = ctx.createGain();
        g.gain.value = i === 0 ? 0.12 : 0.08;
        o.connect(g).connect(filter);
        o.start();
        nodes.push(o);
      }
    });
    // slow filter movement
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lg = ctx.createGain();
    lg.gain.value = cutoff * 0.35;
    lfo.connect(lg).connect(filter.frequency);
    lfo.start();
    return { gain, nodes };
  }

  setMusic(bed: Bed) {
    if (!this.ctx || !this.beds) return;
    if (this.paused) this.setPaused(false);
    if (this.current === bed) return;
    this.current = bed;
    this.syncContext();
    const t = this.ctx.currentTime;
    (Object.keys(this.beds) as Bed[]).forEach((b) => {
      const g = this.beds![b].gain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(b === bed ? 1 : 0, t + 1.5);
    });
  }

  /** Call every frame: schedules a sparse melodic layer on top of the drone. */
  tick() {
    if (!this.ctx || !this.current || this.muted || this.paused) return;
    const t = this.ctx.currentTime;
    if (this.nextNoteAt < t) this.nextNoteAt = t + 0.1;
    while (this.nextNoteAt < t + 0.2) {
      const dark = this.current === 'dark';
      const scale = dark ? NOTES_DARK : NOTES_FANTASY;
      const step = this.noteStep++;
      const pattern = dark ? [0, -1, 2, -1, 4, -1, -1, 1, 0, -1, 5, -1, 3, -1, -1, -1] : [0, 2, 4, 2, 5, 4, 2, -1, 1, 3, 5, 3, 6, 5, 3, -1];
      const idx = pattern[step % pattern.length];
      if (idx >= 0 && (dark ? Math.random() < 0.8 : true)) {
        const f = scale[idx] * (dark ? 2 : 1);
        this.tone(f, dark ? 'sine' : 'triangle', 0.025, dark ? 1.6 : 0.9, this.musicBus, this.nextNoteAt, dark ? 0.06 : 0.05);
      }
      this.nextNoteAt += dark ? 0.42 : 0.24;
    }
  }

  private tone(freq: number, type: OscillatorType, attack: number, decay: number, bus: AudioNode, at?: number, vol = 0.3, slideTo?: number) {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + attack + decay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  private noise(dur: number, filterFreq: number, vol: number, type: BiquadFilterType = 'lowpass', sweepTo?: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(filterFreq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
  }

  sfx(name: 'jump' | 'land' | 'siphon' | 'absorb' | 'release' | 'fizzle' | 'hit' | 'hurt' | 'explode' | 'pickup' | 'door' | 'dash' | 'arrow' | 'light' | 'deflect' | 'burn' | 'checkpoint' | 'death' | 'break') {
    if (!this.ctx) return;
    const b = this.sfxBus;
    switch (name) {
      case 'jump': this.tone(260, 'square', 0.005, 0.12, b, undefined, 0.08, 520); break;
      case 'land': this.noise(0.08, 400, 0.25); break;
      case 'siphon': this.noise(0.3, 300, 0.35, 'bandpass', 2400); this.tone(180, 'sine', 0.02, 0.3, b, undefined, 0.12, 520); break;
      case 'absorb': [660, 880, 1320].forEach((f, i) => this.tone(f, 'triangle', 0.005, 0.25, b, this.ctx!.currentTime + i * 0.05, 0.12)); break;
      case 'release': this.noise(0.25, 1800, 0.35, 'lowpass', 300); this.tone(140, 'sawtooth', 0.005, 0.25, b, undefined, 0.12, 60); break;
      case 'fizzle': this.noise(0.15, 3000, 0.12, 'highpass'); break;
      case 'hit': this.tone(320, 'square', 0.002, 0.1, b, undefined, 0.15, 120); this.noise(0.08, 2000, 0.2); break;
      case 'hurt': this.tone(240, 'sawtooth', 0.002, 0.3, b, undefined, 0.2, 80); break;
      case 'explode': this.noise(0.9, 900, 0.7, 'lowpass', 60); this.tone(70, 'sine', 0.005, 0.6, b, undefined, 0.4, 30); break;
      case 'pickup': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 'triangle', 0.005, 0.35, b, this.ctx!.currentTime + i * 0.08, 0.14)); break;
      case 'door': this.noise(1.0, 200, 0.5, 'lowpass', 80); this.tone(55, 'sine', 0.1, 0.9, b, undefined, 0.3); break;
      case 'dash': this.noise(0.18, 600, 0.35, 'bandpass', 3000); break;
      case 'arrow': this.tone(700, 'triangle', 0.002, 0.12, b, undefined, 0.08, 300); break;
      case 'light': this.tone(392, 'sine', 0.01, 0.8, b, undefined, 0.15); this.tone(587, 'sine', 0.01, 0.8, b, undefined, 0.1); this.noise(0.4, 1200, 0.2); break;
      case 'deflect': this.tone(1200, 'square', 0.002, 0.08, b, undefined, 0.08, 1800); break;
      case 'burn': this.noise(0.6, 1500, 0.35, 'bandpass', 500); break;
      case 'checkpoint': [392, 523, 659].forEach((f, i) => this.tone(f, 'sine', 0.02, 0.6, b, this.ctx!.currentTime + i * 0.12, 0.12)); break;
      case 'death': this.tone(300, 'sawtooth', 0.01, 1.0, b, undefined, 0.2, 40); break;
      case 'break': this.noise(0.4, 700, 0.6, 'lowpass', 120); break;
    }
  }
}

export const audio = new AudioEngine();
