'use client';

import { useEffect } from 'react';

/**
 * Environmental VFX Emitters Container.
 * All environmental effects (smoke, fog, wind streaks, water mist, fire glow, strobes, scents)
 * have been completely removed per specification. Only mechanical seat motion is retained.
 * 
 * Exposes debug verification hooks asserting 0 emitters and 0 particles.
 */
export function MotionVFXScene() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__cineverse_vfx_emitters_count = 0;
      (window as any).__cineverse_particles_count = 0;
    }
  }, []);

  return null;
}
