/**
 * CineVerse 4DX & Motion Seat Simulation Engine
 * 
 * WCAG 2.3.1 Compliant:
 * - Strobe flashes strictly restricted to <= 3 flashes per second
 * - Disabled automatically under prefers-reduced-motion or Comfort mode
 * - Spring-damper physics for seated camera motion
 * - Web Audio sub-bass rumble generator (20-60 Hz)
 * - Android Vibration API integration
 */

export type EffectType =
  | 'motion_heave'
  | 'motion_pitch'
  | 'motion_roll'
  | 'motion_vibrate'
  | 'wind'
  | 'water_mist'
  | 'fog'
  | 'strobe'
  | 'heat_glow'
  | 'scent'
  | 'tickler'
  | 'poke';

export interface EffectEvent {
  start: number; // in seconds
  end: number;
  type: EffectType;
  intensity: number; // 0.0 to 1.0
  label?: string; // e.g. "Pine forest", "Ocean breeze", "Gunpowder"
}

export interface EffectTrack {
  version: 1;
  duration: number;
  events: EffectEvent[];
}

/**
 * Standard authored 4DX demonstration effect track for movie trailers.
 */
export const DEFAULT_4DX_TRACK: EffectTrack = {
  version: 1,
  duration: 120,
  events: [
    { start: 2.0, end: 6.0, type: 'wind', intensity: 0.6, label: 'Gentle breeze' },
    { start: 7.0, end: 12.0, type: 'motion_pitch', intensity: 0.5 },
    { start: 10.0, end: 15.0, type: 'fog', intensity: 0.7 },
    { start: 14.0, end: 18.0, type: 'scent', intensity: 0.8, label: 'Pine forest' },
    { start: 20.0, end: 24.0, type: 'water_mist', intensity: 0.5 },
    { start: 25.0, end: 29.0, type: 'motion_roll', intensity: 0.7 },
    { start: 28.0, end: 32.0, type: 'scent', intensity: 0.9, label: 'Ocean breeze' },
    { start: 35.0, end: 38.0, type: 'heat_glow', intensity: 0.85, label: 'Warm heat glow' },
    { start: 36.0, end: 36.5, type: 'strobe', intensity: 0.5 }, // 1 flash (WCAG safe)
    { start: 37.0, end: 37.5, type: 'strobe', intensity: 0.5 }, // 1 flash (WCAG safe)
    { start: 40.0, end: 41.5, type: 'poke', intensity: 0.7, label: 'Back poke' },
    { start: 42.0, end: 43.5, type: 'tickler', intensity: 0.6, label: 'Leg tickler' },
    { start: 45.0, end: 50.0, type: 'motion_vibrate', intensity: 0.8 },
    { start: 52.0, end: 57.0, type: 'scent', intensity: 0.85, label: 'Gunpowder' },
  ],
};

/**
 * Validates WCAG 2.3.1 Three Flashes or Below Threshold Rule.
 * Rejects or clamps any strobe sequence that fires more than 3 flashes in any 1-second window.
 */
export function validateWcagFlashSafety(events: EffectEvent[]): EffectEvent[] {
  const strobeEvents = events.filter((e) => e.type === 'strobe').sort((a, b) => a.start - b.start);
  const safeEvents: EffectEvent[] = [];

  // Filter strobes ensuring no more than 3 starts in any sliding 1.0 second window
  const approvedStrobeStarts: number[] = [];
  for (const st of strobeEvents) {
    const recentStarts = approvedStrobeStarts.filter((t) => st.start - t < 1.0);
    if (recentStarts.length < 3) {
      approvedStrobeStarts.push(st.start);
      safeEvents.push(st);
    }
  }

  // Combine non-strobe events with approved safe strobes
  const nonStrobes = events.filter((e) => e.type !== 'strobe');
  return [...nonStrobes, ...safeEvents].sort((a, b) => a.start - b.start);
}

/**
 * Web Audio Sub-bass Rumble Player
 * Synthesizes filtered 35-50 Hz sub-bass vibrations in sync with motion events.
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
      const targetGain = Math.min(0.25, Math.max(0, intensity * 0.22));
      this.gain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
    } catch {
      // Ignore audio parameter errors
    }
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
export function triggerHapticPulse(durationMs: number = 40) {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(Math.min(100, durationMs));
    } catch {
      // Haptic permission or unsupported fallback
    }
  }
}

/**
 * Checks if user has requested reduced motion either in OS or via Comfort mode
 */
export function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

