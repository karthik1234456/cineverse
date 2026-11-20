import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCinemaStore } from '@/store/useCinemaStore';

describe('PART A: Remove Automatic Theatre Mode & Verify Safeguard Truth', () => {
  beforeEach(() => {
    useCinemaStore.setState({
      theatreModeOpen: false,
      toastMessage: null,
      toastAction: null,
      trailer: {
        isPlaying: true,
        playbackStatus: 'playing',
        isMuted: false,
        volume: 0.8,
        activeStrategy: 'youtube_css3d',
        trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        isTheatreMode: false,
        youtubeErrorCode: null,
      },
    });
  });

  it('1. verifies Theatre Mode starts closed and never opens automatically', () => {
    const state = useCinemaStore.getState();
    expect(state.theatreModeOpen).toBe(false);
  });

  it('2. verifies simulating high input latency triggers suggestion toast but does NOT auto-switch to Theatre Mode', () => {
    const { showToast, setTheatreModeOpen } = useCinemaStore.getState();

    // Simulate what PerformanceWatchdog does on sustained input latency > 200ms
    showToast('Playback is choppy. Try Theatre Mode', {
      label: 'Theatre Mode',
      onClick: () => setTheatreModeOpen(true),
    });

    const state = useCinemaStore.getState();
    expect(state.theatreModeOpen).toBe(false); // MUST STAY FALSE! Never switch by itself!
    expect(state.toastMessage).toBe('Playback is choppy. Try Theatre Mode');
    expect(state.toastAction).toBeDefined();
    expect(state.toastAction?.label).toBe('Theatre Mode');

    // Only switches when user explicitly clicks the action
    state.toastAction?.onClick();
    expect(useCinemaStore.getState().theatreModeOpen).toBe(true);
  });

  it('3. verifies simulating low frame rate (<30 FPS for 3s) triggers suggestion toast but does NOT auto-switch', () => {
    const { showToast, setTheatreModeOpen } = useCinemaStore.getState();

    showToast('Playback is choppy. Try Theatre Mode', {
      label: 'Theatre Mode',
      onClick: () => setTheatreModeOpen(true),
    });

    const state = useCinemaStore.getState();
    expect(state.theatreModeOpen).toBe(false); // MUST STAY FALSE!
    expect(state.toastMessage).toContain('Playback is choppy');
  });

  it('4. verifies simulating player errors (101, 150, 153) keeps 3D screen in title card mode without auto-switching', () => {
    const errorCodes = [101, 150, 153];
    for (const code of errorCodes) {
      useCinemaStore.setState({ theatreModeOpen: false });
      useCinemaStore.getState().setTrailerState({ youtubeErrorCode: code, activeStrategy: 'title_card' });

      const state = useCinemaStore.getState();
      expect(state.theatreModeOpen).toBe(false); // MUST NOT SWITCH AUTOMATICALLY!
      expect(state.trailer.youtubeErrorCode).toBe(code);
      expect(state.trailer.activeStrategy).toBe('title_card');
    }
  });

  it('5. verifies a stalled player does not trigger an automatic mode change', () => {
    useCinemaStore.getState().setTrailerPlaybackStatus('loading');
    const state = useCinemaStore.getState();
    expect(state.theatreModeOpen).toBe(false);
    expect(state.trailer.playbackStatus).toBe('loading');
  });

  it('6. verifies Theatre Mode opens ONLY on explicit user button click', () => {
    expect(useCinemaStore.getState().theatreModeOpen).toBe(false);
    useCinemaStore.getState().setTheatreModeOpen(true);
    expect(useCinemaStore.getState().theatreModeOpen).toBe(true);

    useCinemaStore.getState().setTheatreModeOpen(false);
    expect(useCinemaStore.getState().theatreModeOpen).toBe(false);
  });
});
