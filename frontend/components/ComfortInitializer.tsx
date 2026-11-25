'use client';

import { useEffect } from 'react';
import { useComfortStore } from '@/store/useComfortStore';
import { useFeatureFlags } from '@/store/useFeatureFlags';

export function ComfortInitializer() {
  const initSettings = useComfortStore((s) => s.initSettings);
  const initFlags = useFeatureFlags((s) => s.initFlags);

  useEffect(() => {
    initSettings();
    initFlags();
  }, [initSettings, initFlags]);

  return null;
}

