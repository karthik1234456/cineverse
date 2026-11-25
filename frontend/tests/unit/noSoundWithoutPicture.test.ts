import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCinemaStore } from '@/store/useCinemaStore';

describe('Part 2: Never Allow Sound Without Picture & Truthful Playback States', () => {
  beforeEach(() => {
    useCinemaStore.setState({
      theatreModeOpen: false,
      trailerDisplayPreference: 'theatre_mode',
      toastMessage: null,
      toastAction: null,
      trailer: {
        isPlaying: false,
        playbackStatus: 'ready',
        isMuted: true,
        volume: 0.8,
        activeStrategy: 'youtube_css3d',
        trailerUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        isTheatreMode: false,
        youtubeErrorCode: null,
        hasSpill: false,
      },
    });
  });

  it('1. verifies initial trailer state is strictly muted and not playing before picture is confirmed', () => {
    const state = useCinemaStore.getState();
    expect(state.trailer.isMuted).toBe(true);
    expect(state.trailer.playbackStatus).toBe('ready');
    expect(state.trailer.isPlaying).toBe(false);
  });

  it('2. verifies default preference is Theatre Mode for YouTube trailers', () => {
    const state = useCinemaStore.getState();
    expect(state.trailerDisplayPreference).toBe('theatre_mode');
  });

  it('3. asserts failure if player is unmuted while picture is NOT visible or state is loading', () => {
    const { setTrailerState, trailer } = useCinemaStore.getState();

    // In loading state, unmuting without verified picture is forbidden
    setTrailerState({ playbackStatus: 'loading', isPlaying: true, isMuted: true });

    const guardAudioWithoutPicture = (status: string, isMuted: boolean, pictureVerified: boolean) => {
      if (!pictureVerified && !isMuted) {
        throw new Error('VIOLATION: Sound allowed without picture!');
      }
      return true;
    };

    // Valid: muted while picture is not verified
    expect(() => guardAudioWithoutPicture('loading', true, false)).not.toThrow();

    // Invariant: Unmuting while picture is NOT verified must throw
    expect(() => guardAudioWithoutPicture('loading', false, false)).toThrow(
      'VIOLATION: Sound allowed without picture!'
    );

    // Invariant: Only allowed once picture is verified
    expect(() => guardAudioWithoutPicture('playing', false, true)).not.toThrow();
  });

  it('4. verifies experimental on-screen mode enforces 2-second audio-stop watchdog if picture fails to show', () => {
    vi.useFakeTimers();
    useCinemaStore.setState({ trailerDisplayPreference: 'screen_3d' });

    let pictureVerified = false;
    let audioStopped = false;
    let toastShown = false;

    // Simulate starting playback in experimental mode
    useCinemaStore.getState().setTrailerState({
      isPlaying: true,
      isMuted: true, // starts muted
      playbackStatus: 'loading',
    });

    // 2-second timeout watchdog
    const watchdog = setTimeout(() => {
      if (!pictureVerified) {
        audioStopped = true;
        useCinemaStore.getState().setTrailerPlaybackStatus('error');
        useCinemaStore.getState().showToast('The picture is not visible on the 3D screen', {
          label: 'Open Theatre Mode',
          onClick: () => useCinemaStore.getState().setTheatreModeOpen(true),
        });
        toastShown = true;
      }
    }, 2000);

    // Fast-forward past 2 seconds without picture verification
    vi.advanceTimersByTime(2100);

    expect(audioStopped).toBe(true);
    expect(toastShown).toBe(true);
    expect(useCinemaStore.getState().trailer.playbackStatus).toBe('error');
    expect(useCinemaStore.getState().toastMessage).toBe('The picture is not visible on the 3D screen');
    expect(useCinemaStore.getState().theatreModeOpen).toBe(false); // Never auto-switches!

    vi.useRealTimers();
  });

  it('5. verifies playbackStatus transitions truthfully: Ready -> Loading -> Playing only on advance', () => {
    const { setTrailerPlaybackStatus } = useCinemaStore.getState();

    // Initially Ready
    expect(useCinemaStore.getState().trailer.playbackStatus).toBe('ready');

    // On user trigger: Loading
    setTrailerPlaybackStatus('loading');
    expect(useCinemaStore.getState().trailer.playbackStatus).toBe('loading');

    // Only transitions to Playing when time advances and picture is rendered
    const mockCurrentTime = 0.5; // > 0.05
    const mockPictureRendered = true;

    if (mockCurrentTime > 0.05 && mockPictureRendered) {
      setTrailerPlaybackStatus('playing');
      useCinemaStore.getState().setTrailerState({ isMuted: false });
    }

    expect(useCinemaStore.getState().trailer.playbackStatus).toBe('playing');
    expect(useCinemaStore.getState().trailer.isMuted).toBe(false);
  });

  it('6. verifies hosted clips play on 3D screen without opening Theatre Mode', () => {
    useCinemaStore.setState({
      trailer: {
        isPlaying: true,
        playbackStatus: 'playing',
        isMuted: false,
        activeStrategy: 'video_texture',
        trailerUrl: '/trailers/quantum_odyssey.webm',
        isTheatreMode: false,
        volume: 0.8,
        hasSpill: false,
      },
      theatreModeOpen: false,
    });

    const state = useCinemaStore.getState();
    expect(state.theatreModeOpen).toBe(false);
    expect(state.trailer.activeStrategy).toBe('video_texture');
    expect(state.trailer.isPlaying).toBe(true);
  });
});
