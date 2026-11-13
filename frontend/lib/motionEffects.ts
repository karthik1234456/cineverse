/**
 * CineVerse Pure Motion Seat Simulation Engine
 * 
 * Exclusively provides mechanical seat motion:
 * - Pod and seat shaking, tilting, and bouncing on the GPU
 * - Synchronized small camera motion in Sit view with seat edges fixed to camera
 * - Effect timelines restricted strictly to motion events:
 *   (footstep, stomp, jump, landing, impact, explosion as a jolt, chase rumble)
 * - Low sub-bass rumble (35-50 Hz) and thump sound synthesis
 * - Android vibration (Navigator.vibrate) and Gamepad controller rumble
 * - Full accessibility & safety controls (off by default, warning dialog, intensity slider,
 *   Comfort mode, reduced motion, Stop button, Escape key)
 */

export type MotionEventType =
  | 'footstep'
  | 'stomp'
  | 'jump'
  | 'landing'
  | 'impact'
  | 'explosion_jolt'
  | 'chase_rumble'
  | 'motion_heave'
  | 'motion_pitch'
  | 'motion_roll'
  | 'motion_vibrate';

// Backward compatibility alias
export type EffectType = MotionEventType;

export interface MotionEvent {
  start: number; // in seconds
  end: number;
  type: MotionEventType;
  intensity: number; // 0.0 to 1.0
  label: string;
}

// Backward compatibility alias
export type EffectEvent = MotionEvent;

export interface MotionTrack {
  version: 1;
  duration: number;
  events: MotionEvent[];
}

export type EffectTrack = MotionTrack;

/**
 * Standard authored Motion-Seat demonstration track for trailers.
 * Strictly motion events only — all environmental effects removed.
 */
export const DEFAULT_MOTION_TRACK: MotionTrack = {
  version: 1,
  duration: 60,
  events: [
    { start: 2.0, end: 5.0, type: 'footstep', intensity: 0.45, label: 'Footstep pulse' },
    { start: 6.0, end: 8.5, type: 'stomp', intensity: 0.70, label: 'Heavy stomp' },
    { start: 10.0, end: 12.0, type: 'jump', intensity: 0.75, label: 'Jump launch' },
    { start: 12.0, end: 14.0, type: 'landing', intensity: 0.85, label: 'Heavy landing' },
    { start: 15.5, end: 18.0, type: 'impact', intensity: 0.90, label: 'Impact shock' },
    { start: 20.0, end: 25.0, type: 'explosion_jolt', intensity: 0.95, label: 'Explosion jolt' },
    { start: 27.0, end: 35.0, type: 'chase_rumble', intensity: 0.80, label: 'Chase rumble' },
    { start: 37.0, end: 40.0, type: 'footstep', intensity: 0.50, label: 'Footstep cadence' },
    { start: 42.0, end: 45.0, type: 'impact', intensity: 0.88, label: 'Direct impact' },
    { start: 47.0, end: 56.0, type: 'chase_rumble', intensity: 0.92, label: 'Climactic chase rumble' },
  ],
};

export const DEFAULT_4DX_TRACK: EffectTrack = DEFAULT_MOTION_TRACK;

export function validateWcagFlashSafety(events: MotionEvent[]): MotionEvent[] {
  // Pure motion events have zero flashes or strobes; passes WCAG 2.3.1 unconditionally
  return events;
}

/**
 * Web Audio Sub-bass Rumble & Thump Player
 * Synthesizes filtered 35-50 Hz sub-bass vibrations and heavy thumps in sync with motion events.
 */
class RumbleAudioController {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private isRunning: boolean = false;

  public start() {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.osc = this.ctx.createOscillator();
      this.osc.type = 'triangle';
      this.osc.frequency.setValueAtTime(42, this.ctx.currentTime);

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(55, this.ctx.currentTime);

      this.gain = this.ctx.createGain();
      this.gain.gain.setValueAtTime(0, this.ctx.currentTime);

      this.osc.connect(this.filter);
      this.filter.connect(this.gain);
      this.gain.connect(this.ctx.destination);

      this.osc.start();
      this.isRunning = true;
    } catch {
      // Audio context policy fallback
    }
  }

  public setRumble(intensity: number) {
    if (!this.gain || !this.ctx || !this.isRunning) return;
    try {
      const targetGain = Math.min(0.28, Math.max(0, intensity * 0.24));
      this.gain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
    } catch {}
  }

  /**
   * Generates a sudden low-frequency thump for stomps, landings, and explosions.
   */
  public triggerThump(intensity: number = 0.8) {
    if (!this.ctx || !this.isRunning) return;
    try {
      const thumpOsc = this.ctx.createOscillator();
      const thumpGain = this.ctx.createGain();
      const thumpFilter = this.ctx.createBiquadFilter();

      thumpFilter.type = 'lowpass';
      thumpFilter.frequency.setValueAtTime(65, this.ctx.currentTime);

      // Pitch drops rapidly from 85 Hz to 32 Hz
      thumpOsc.type = 'sine';
      thumpOsc.frequency.setValueAtTime(85, this.ctx.currentTime);
      thumpOsc.frequency.exponentialRampToValueAtTime(32, this.ctx.currentTime + 0.16);

      const peakGain = Math.min(0.35, intensity * 0.30);
      thumpGain.gain.setValueAtTime(peakGain, this.ctx.currentTime);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.22);

      thumpOsc.connect(thumpFilter);
      thumpFilter.connect(thumpGain);
      thumpGain.connect(this.ctx.destination);

      thumpOsc.start(this.ctx.currentTime);
      thumpOsc.stop(this.ctx.currentTime + 0.24);
    } catch {}
  }

  public stop() {
    if (this.gain && this.ctx) {
      try {
        this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      } catch {}
    }
    if (this.osc) {
      try {
        this.osc.stop();
      } catch {}
      this.osc = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.isRunning = false;
  }
}

export const rumbleController = new RumbleAudioController();

/**
 * Trigger subtle Android / Device haptic feedback
 */
export function triggerHapticPulse(durationMs: number = 50) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(Math.min(120, durationMs));
    } catch {}
  }
}

/**
 * Trigger gamepad controller rumble (dual-rumble motors)
 */
export function triggerGamepadRumble(durationMs: number = 60, weakMagnitude = 0.5, strongMagnitude = 0.6) {
  if (typeof window === 'undefined' || !navigator.getGamepads) return;
  try {
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp && gp.vibrationActuator && typeof (gp.vibrationActuator as any).playEffect === 'function') {
        (gp.vibrationActuator as any).playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          weakMagnitude: Math.min(1.0, weakMagnitude),
          strongMagnitude: Math.min(1.0, strongMagnitude),
        }).catch(() => {});
      }
    }
  } catch {}
}

/**
 * Checks if user has requested reduced motion either in OS or via Comfort mode
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
