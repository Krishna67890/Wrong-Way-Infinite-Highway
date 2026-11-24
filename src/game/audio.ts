import { CarAudioProfile, GameSettings, PowerUpType, RepairPickupTier } from './types';

class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private engineRunning = false;
  private oscPrimary: OscillatorNode | null = null;
  private oscHarmonic: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private settings: GameSettings = {
    graphics: 'high',
    masterVolume: 0.8,
    musicVolume: 0.45,
    sfxVolume: 0.85,
    muted: false,
    vibration: true,
    tiltSteering: false,
    tiltSensitivity: 1.0,
    controlScheme: 'hybrid',
    cameraPreset: 'chase',
  };

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public updateSettings(next: GameSettings): void {
    this.settings = next;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.sfxGain || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const master = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.gain.setTargetAtTime(master, now, 0.03);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, now, 0.03);
    this.musicGain.gain.setTargetAtTime(this.settings.musicVolume, now, 0.03);
  }

  public startMusic(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.musicTimer !== null) return;

    const scale = [55, 65.41, 73.42, 82.41, 98, 110, 130.81, 146.83];
    const bassPattern = [0, 0, 2, 0, 4, 3, 2, 1];
    const arpPattern = [4, 5, 7, 5, 6, 4, 7, 3];

    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.ctx.state !== 'running') return;
      if (this.settings.muted || this.settings.musicVolume <= 0.01) return;

      const t = this.ctx.currentTime;
      const step = this.musicStep % 8;
      this.musicStep += 1;

      // Driving synthwave bass pulse
      const bassFreq = scale[bassPattern[step]];
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(bassFreq, t);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(380, t);
      filter.frequency.exponentialRampToValueAtTime(140, t + 0.19);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.21);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.22);

      // High arpeggio accent every 2nd step
      if (step % 2 === 0) {
        const arpFreq = scale[arpPattern[step]] * 2;
        const aOsc = this.ctx.createOscillator();
        const aGain = this.ctx.createGain();
        aOsc.type = 'triangle';
        aOsc.frequency.setValueAtTime(arpFreq, t);
        aGain.gain.setValueAtTime(0.001, t);
        aGain.gain.linearRampToValueAtTime(0.06, t + 0.01);
        aGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
        aOsc.connect(aGain);
        aGain.connect(this.musicGain);
        aOsc.start(t);
        aOsc.stop(t + 0.17);
      }
    }, 220);
  }

  public stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public startEngine(profile: CarAudioProfile): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    this.stopEngine();

    const t = ctx.currentTime;
    this.oscPrimary = ctx.createOscillator();
    this.oscHarmonic = ctx.createOscillator();
    this.engineFilter = ctx.createBiquadFilter();
    this.engineGain = ctx.createGain();

    this.oscPrimary.type = 'sawtooth';
    this.oscHarmonic.type = 'triangle';
    this.oscPrimary.frequency.setValueAtTime(profile.baseFreq, t);
    this.oscHarmonic.frequency.setValueAtTime(profile.baseFreq * profile.harmonicRatio, t);

    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(260, t);
    this.engineFilter.Q.value = 3.2;

    this.engineGain.gain.setValueAtTime(0.001, t);
    this.engineGain.gain.linearRampToValueAtTime(0.08 + profile.exhaustGrowl * 0.05, t + 0.18);

    this.oscPrimary.connect(this.engineFilter);
    this.oscHarmonic.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.oscPrimary.start(t);
    this.oscHarmonic.start(t);
    this.engineRunning = true;
  }

  public updateEngine(
    profile: CarAudioProfile,
    speedRatio: number,
    nitroActive: boolean,
    braking: boolean,
    healthRatio: number,
  ): void {
    if (!this.engineRunning || !this.ctx || !this.oscPrimary || !this.oscHarmonic || !this.engineFilter || !this.engineGain) {
      return;
    }
    const t = this.ctx.currentTime;
    // Simulated 5-gear RPM sawtooth curve so speed feels alive
    const clamped = Math.max(0.1, Math.min(1.45, speedRatio));
    const gear = Math.min(5, Math.floor(clamped * 4.2) + 1);
    const gearFrac = (clamped * 4.2) % 1;
    const rpmFactor = 0.72 + gear * 0.18 + gearFrac * 0.42 + (nitroActive ? 0.35 : 0) - (braking ? 0.18 : 0);

    const f1 = profile.baseFreq * profile.pitchScale * rpmFactor;
    const f2 = f1 * profile.harmonicRatio;

    // Damaged engine sputter below 35% health
    const sputter =
      healthRatio < 0.35
        ? 1 + Math.sin(t * 28) * 0.09 * (1 - healthRatio / 0.35)
        : 1;

    this.oscPrimary.frequency.setTargetAtTime(f1 * sputter, t, 0.05);
    this.oscHarmonic.frequency.setTargetAtTime(f2 * sputter, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(
      240 + clamped * 680 + (nitroActive ? 550 : 0),
      t,
      0.06,
    );
    const vol = (0.06 + clamped * 0.045 + (nitroActive ? 0.04 : 0)) * (healthRatio < 0.3 ? 0.85 : 1);
    this.engineGain.gain.setTargetAtTime(vol, t, 0.06);
  }

  public stopEngine(): void {
    this.engineRunning = false;
    try {
      this.oscPrimary?.stop();
      this.oscHarmonic?.stop();
      this.oscPrimary?.disconnect();
      this.oscHarmonic?.disconnect();
      this.engineFilter?.disconnect();
      this.engineGain?.disconnect();
    } catch {
      // ignore already stopped
    }
    this.oscPrimary = null;
    this.oscHarmonic = null;
    this.engineFilter = null;
    this.engineGain = null;
  }

  public playLaneShift(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(115, t + 0.075);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  public playCoin(combo = 1): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const base = 780 + Math.min(combo, 10) * 45;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.setValueAtTime(base * 1.33, t + 0.045);
    g.gain.setValueAtTime(0.11, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  public playNearMiss(combo: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    // Doppler swoop + harmonic chime
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(95, t + 0.18);
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.2);

    const ping = ctx.createOscillator();
    const pg = ctx.createGain();
    ping.type = 'sine';
    const f = 520 + Math.min(combo, 12) * 55;
    ping.frequency.setValueAtTime(f, t + 0.02);
    ping.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.14);
    pg.gain.setValueAtTime(0.1, t + 0.02);
    pg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    ping.connect(pg);
    pg.connect(this.sfxGain);
    ping.start(t + 0.02);
    ping.stop(t + 0.19);
  }

  public playRepair(tier: RepairPickupTier): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const notes =
      tier === 'legendary'
        ? [523.25, 659.25, 783.99, 1046.5]
        : tier === 'large'
          ? [440, 554.37, 659.25, 880]
          : [440, 554.37, 659.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.055);
      g.gain.setValueAtTime(0.11, t + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.055 + 0.22);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t + i * 0.055);
      osc.stop(t + i * 0.055 + 0.24);
    });
  }

  public playPowerUp(type: PowerUpType): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type === 'slow_mo' ? 'sine' : 'triangle';
    const startF = type === 'slow_mo' ? 760 : 320;
    const endF = type === 'slow_mo' ? 240 : 960;
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.exponentialRampToValueAtTime(endF, t + 0.24);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  public playNitroStart(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.25);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, t);
    filter.frequency.exponentialRampToValueAtTime(2200, t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start(t);
  }

  public playCrash(severity: 'small' | 'medium' | 'heavy'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const dur = severity === 'heavy' ? 0.45 : severity === 'medium' ? 0.3 : 0.18;
    const gainLevel = severity === 'heavy' ? 0.32 : severity === 'medium' ? 0.22 : 0.14;

    // Noise burst
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(severity === 'heavy' ? 1400 : 900, t);
    filter.frequency.exponentialRampToValueAtTime(140, t + dur);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gainLevel, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(filter);
    filter.connect(ng);
    ng.connect(this.sfxGain);
    noise.start(t);

    // Sub impact thud
    const sub = ctx.createOscillator();
    const sg = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(severity === 'heavy' ? 130 : 100, t);
    sub.frequency.exponentialRampToValueAtTime(32, t + dur * 0.8);
    sg.gain.setValueAtTime(gainLevel * 1.1, t);
    sg.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.85);
    sub.connect(sg);
    sg.connect(this.sfxGain);
    sub.start(t);
    sub.stop(t + dur);
  }

  public playShieldBreak(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(980, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.25);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.27);
  }

  public playUiClick(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, t);
    osc.frequency.exponentialRampToValueAtTime(420, t + 0.04);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  public playUnlock(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);
      g.gain.setValueAtTime(0.12, t + idx * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.28);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.3);
    });
  }

  public playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    [330, 261.63, 196, 130.81].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 600;
      osc.frequency.setValueAtTime(freq, t + idx * 0.11);
      g.gain.setValueAtTime(0.12, t + idx * 0.11);
      g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.11 + 0.32);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain!);
      osc.start(t + idx * 0.11);
      osc.stop(t + idx * 0.11 + 0.35);
    });
  }
}

export const audioEngine = new GameAudioEngine();
