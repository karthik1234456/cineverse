import { describe, it, expect, beforeEach } from 'vitest';
import { useCinemaStore } from '../../store/useCinemaStore';

describe('PART D: Screen Play Button and Trailer State Pipeline', () => {
  beforeEach(() => {
    useCinemaStore.setState({
      trailer: {
        isPlaying: false,
        isMuted: true,
        volume: 0.8,
        trailerUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        hasSpill: true,
        playbackStatus: 'ready',
        activeStrategy: 'video_texture',
        movieTitle: 'Quantum Odyssey',
      },
      houseLights: 'full',
    });
  });

  it('initial pre-press state shows "ready" and never "loading..."', () => {
    const state = useCinemaStore.getState();
    expect(state.trailer.isPlaying).toBe(false);
    expect(state.trailer.playbackStatus).toBe('ready');
    expect(state.trailer.playbackStatus).not.toBe('loading');
  });

  it('user gesture transitions to playing and sets house lights to show mode', () => {
    const store = useCinemaStore.getState();
    store.setTrailerState({ isPlaying: true, isMuted: false, playbackStatus: 'playing' });
    store.setHouseLights('show');

    const updated = useCinemaStore.getState();
    expect(updated.trailer.isPlaying).toBe(true);
    expect(updated.trailer.isMuted).toBe(false);
    expect(updated.trailer.playbackStatus).toBe('playing');
    expect(updated.houseLights).toBe('show');
  });

  it('toggles pause and play accurately reflecting playback status', () => {
    const store = useCinemaStore.getState();
    // Start playing
    store.setTrailerState({ isPlaying: true, playbackStatus: 'playing' });
    expect(useCinemaStore.getState().trailer.isPlaying).toBe(true);

    // Toggle pause
    store.toggleTrailerPlay();
    expect(useCinemaStore.getState().trailer.isPlaying).toBe(false);

    // Toggle play back
    store.toggleTrailerPlay();
    expect(useCinemaStore.getState().trailer.isPlaying).toBe(true);
  });

  it('restartTrailer resets state to playing with house lights in show mode', () => {
    const store = useCinemaStore.getState();
    store.setTrailerState({ isPlaying: false, playbackStatus: 'paused' });
    store.setHouseLights('dim');

    store.restartTrailer();

    const restarted = useCinemaStore.getState();
    expect(restarted.trailer.isPlaying).toBe(true);
    expect(restarted.trailer.playbackStatus).toBe('playing');
    expect(restarted.houseLights).toBe('show');
  });

  it('reflects all true player status types (ready, loading, playing, paused, blocked, unavailable)', () => {
    const store = useCinemaStore.getState();
    const statuses = ['ready', 'loading', 'playing', 'paused', 'blocked', 'unavailable'] as const;

    for (const status of statuses) {
      store.setTrailerPlaybackStatus(status);
      expect(useCinemaStore.getState().trailer.playbackStatus).toBe(status);
    }
  });
});
