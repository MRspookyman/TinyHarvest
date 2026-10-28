// Sonidos suaves y breves, sin archivos de audio.
export type SoundKind =
  | 'plant'
  | 'harvest'
  | 'coins'
  | 'buy'
  | 'hire'
  | 'golden'
  | 'mastery'
  | 'crown'
  | 'rally'
  | 'order'
  | 'orderDone'
  | 'album'
  | 'click';

export interface Sound {
  play(kind: SoundKind, amount?: number): void;
  readonly muted: boolean;
  setMuted(m: boolean): void;
}

const STORAGE_KEY = 'tiny-harvest:sonido';
const MIN_INTERVAL: Record<SoundKind, number> = {
  plant: 0.06,
  harvest: 0.09,
  coins: 0.12,
  buy: 0.06,
  hire: 0.06,
  golden: 0.06,
  mastery: 0.06,
  crown: 0.06,
  rally: 0.06,
  order: 0.06,
  orderDone: 0.06,
  album: 0.06,
  click: 0.06,
};

// Cada oscilador o ráfaga de ruido cuenta como una voz, incluidos los del acorde.
const VOICES: Record<SoundKind, number> = {
  plant: 2,
  harvest: 1,
  coins: 2,
  buy: 2,
  hire: 3,
  golden: 4,
  mastery: 3,
  crown: 3,
  rally: 2,
  order: 1,
  orderDone: 3,
  album: 2,
  click: 1,
};

export function createSound(): Sound {
  let muted = false;
  try {
    muted = localStorage.getItem(STORAGE_KEY) === '0';
  } catch {
    // El juego también funciona con el almacenamiento bloqueado.
  }

  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let noise: AudioBuffer | undefined;
  const lastPlayed: Partial<Record<SoundKind, number>> = {};
  const starts: number[] = [];

  function unlock(): void {
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    try {
      if (typeof window.AudioContext !== 'function') return;
      context = new window.AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.25;
      master.connect(context.destination);
      if (context.state === 'suspended') void context.resume().catch(() => {});
    } catch {
      if (context) void context.close().catch(() => {});
      context = undefined;
      master = undefined;
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', unlock, { once: true, capture: false });
    window.addEventListener('keydown', unlock, { once: true, capture: false });
  }

  function tone(
    ctx: AudioContext, output: GainNode, start: number, frequency: number,
    duration: number, volume: number, type: OscillatorType = 'sine', endFrequency = frequency,
  ): void {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(0.012, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.gain.linearRampToValueAtTime(0, start + duration + 0.01);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      oscillator.onended = null;
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.015);
  }

  function rustle(ctx: AudioContext, output: GainNode, start: number, volume: number): void {
    if (!noise) {
      noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.08), ctx.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    source.buffer = noise;
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.5;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.07);
    gain.gain.linearRampToValueAtTime(0, start + 0.08);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      source.onended = null;
    };
    source.start(start);
    source.stop(start + 0.08);
  }

  return {
    get muted() { return muted; },
    setMuted(m: boolean): void {
      muted = m;
      if (context && master) {
        // Una rampa corta evita chasquidos al silenciar una nota en curso.
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setTargetAtTime(m ? 0 : 0.25, context.currentTime, 0.01);
      }
      try {
        localStorage.setItem(STORAGE_KEY, m ? '0' : '1');
      } catch {
        // Silenciar sigue funcionando aunque no pueda guardarse.
      }
    },
    play(kind: SoundKind, amount = 1): void {
      const ctx = context;
      const output = master;
      if (muted || !ctx || !output || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (now - (lastPlayed[kind] ?? -Infinity) < MIN_INTERVAL[kind]) return;
      for (let i = starts.length - 1; i >= 0; i--) {
        if (starts[i] <= now - 0.25) starts.splice(i, 1);
      }
      if (starts.length + VOICES[kind] > 8) return;

      // Reservamos también las notas futuras: ninguna ventana supera ocho voces.
      const frequent = kind === 'plant' || kind === 'harvest' || kind === 'coins' || kind === 'click';
      const pitch = frequent ? 0.97 + Math.random() * 0.06 : 1;
      const at = now + 0.005;
      const note = (
        frequency: number, delay: number, duration: number, volume: number,
        type: OscillatorType = 'sine', endFrequency = frequency,
      ): void => {
        starts.push(at + delay);
        tone(ctx, output, at + delay, frequency * pitch, duration, volume, type, endFrequency * pitch);
      };

      try {
        switch (kind) {
          case 'plant':
            rustle(ctx, output, at, 0.035);
            starts.push(at);
            note(330, 0.015, 0.085, 0.055, 'sine', 440);
            break;
          case 'harvest':
            note(620, 0, 0.075, 0.045, 'sine', 790);
            break;
          case 'coins': {
            const brightness = 1 + Math.min(0.12, Math.log1p(Number.isFinite(amount) ? Math.max(0, amount) : 0) * 0.018);
            note(784 * brightness, 0, 0.1, 0.065);
            note(988 * brightness, 0.055, 0.12, 0.05);
            break;
          }
          case 'buy':
            note(392, 0, 0.13, 0.085, 'triangle');
            note(588, 0.065, 0.17, 0.075);
            break;
          case 'hire':
            note(523.25, 0, 0.14, 0.11, 'triangle');
            note(659.25, 0.105, 0.14, 0.1, 'triangle');
            note(784, 0.21, 0.22, 0.11);
            break;
          case 'golden':
            note(659.25, 0, 0.22, 0.1);
            note(830.61, 0.075, 0.24, 0.09);
            note(987.77, 0.15, 0.26, 0.08);
            note(1318.51, 0.225, 0.3, 0.065);
            break;
          case 'mastery':
            note(392, 0, 0.16, 0.1, 'triangle');
            note(523.25, 0.11, 0.16, 0.1, 'triangle');
            note(659.25, 0.22, 0.24, 0.11, 'triangle');
            break;
          case 'crown':
            note(587.33, 0, 0.17, 0.085);
            note(739.99, 0.09, 0.19, 0.08);
            note(880, 0.18, 0.26, 0.09);
            break;
          case 'rally':
            note(440, 0, 0.16, 0.075, 'triangle', 494);
            note(659.25, 0.15, 0.2, 0.085, 'triangle');
            break;
          case 'order':
            note(880, 0, 0.25, 0.07);
            break;
          case 'orderDone':
            note(523.25, 0, 0.17, 0.08);
            note(659.25, 0.08, 0.18, 0.08);
            note(1046.5, 0.16, 0.24, 0.07);
            break;
          case 'album':
            rustle(ctx, output, at, 0.045);
            starts.push(at);
            note(1046.5, 0.07, 0.2, 0.065);
            break;
          case 'click':
            note(640, 0, 0.025, 0.028, 'sine', 480);
            break;
        }
      } catch {
        // Una interrupción del dispositivo de audio nunca debe detener el juego.
      }
      lastPlayed[kind] = now;
    },
  };
}
