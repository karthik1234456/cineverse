'use client';

import React, { useState, useEffect } from 'react';
import { useCinemaStore } from '@/store/useCinemaStore';
import layoutData from '@/public/models/seat_layout_v2.json';
import type { SeatLayoutFile, SeatStatus, QualityTier } from '@/lib/types';
import { Info, Sliders, Sun, Moon, X } from 'lucide-react';

export function AuditoriumInfoPanel() {
  const [showHonestyModal, setShowHonestyModal] = useState(false);
  const [showDevControls, setShowDevControls] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const seatStatuses = useCinemaStore((s) => s.seatStatuses);
  const selectedSeats = useCinemaStore((s) => s.selectedSeats);
  const houseLights = useCinemaStore((s) => s.houseLights);
  const setHouseLights = useCinemaStore((s) => s.setHouseLights);
  const qualityTier = useCinemaStore((s) => s.qualityTier);
  const setQualityTier = useCinemaStore((s) => s.setQualityTier);
  const useHqModel = useCinemaStore((s) => s.useHqModel);
  const setUseHqModel = useCinemaStore((s) => s.setUseHqModel);
  const updateSeatStatus = useCinemaStore((s) => s.updateSeatStatus);
  const showToast = useCinemaStore((s) => s.showToast);
  const cameraMode = useCinemaStore((s) => s.cameraMode);
  const mode = useCinemaStore((s) => s.mode);
  const storeTiers = useCinemaStore((s) => s.tiers);
  const auditoriumLayout = useCinemaStore((s) => s.auditoriumLayout);
  const auditoriumName = useCinemaStore((s) => s.auditoriumName);
  const storeScreenType = useCinemaStore((s) => s.screenType);
  const storeScreenFormat = useCinemaStore((s) => s.screenFormat);
  const storeSoundSystem = useCinemaStore((s) => s.soundSystem);
  const storeProjectionType = useCinemaStore((s) => s.projectionType);
  const storeTechSpecsDisplay = useCinemaStore((s) => s.techSpecsDisplay);
  const isDemo = useCinemaStore((s) => s.isDemo);
  const proceduralResult = useCinemaStore((s) => s.proceduralResult);

  const layout = auditoriumLayout || (layoutData as unknown as SeatLayoutFile);

  const displayTiers = React.useMemo(() => {
    if (layout.seats && layout.seats.length > 0) {
      const allRows = Array.from(new Set(layout.seats.map((s) => s.row))).sort();
      const rowToCat = new Map<string, string>();
      const catPrices = new Map<string, number>();

      for (const s of layout.seats) {
        const cat = (s.category || 'Prime').toLowerCase();
        if (!rowToCat.has(s.row)) {
          rowToCat.set(s.row, cat);
        }
        if (s.price && (!catPrices.has(cat) || s.price < (catPrices.get(cat) || Infinity))) {
          catPrices.set(cat, s.price);
        }
      }

      const catRows = new Map<string, string[]>();
      for (const r of allRows) {
        const cat = rowToCat.get(r) || 'prime';
        if (!catRows.has(cat)) catRows.set(cat, []);
        catRows.get(cat)!.push(r);
      }

      const order = ['front', 'prime', 'premier'];
      const result = [];
      for (const k of order) {
        if (catRows.has(k) && catRows.get(k)!.length > 0) {
          const rowsInTier = catRows.get(k)!;
          const rText =
            rowsInTier.length === 1
              ? `Row ${rowsInTier[0]}`
              : `Rows ${rowsInTier[0]}–${rowsInTier[rowsInTier.length - 1]}`;
          const capName = k.charAt(0).toUpperCase() + k.slice(1);
          const colorClass =
            k === 'premier'
              ? 'border-rose-300 bg-rose-50 text-[#9F1239]'
              : k === 'front'
              ? 'border-amber-300 bg-amber-50 text-[#8D5B28]'
              : 'border-blue-300 bg-blue-50 text-[#1E40AF]';
          const p = catPrices.get(k) || (k === 'premier' ? 520 : k === 'front' ? 280 : 380);
          result.push({
            name: capName,
            category: k,
            rows: rText,
            price: p,
            colorClass,
          });
        }
      }
      if (result.length > 0) return result;
    }

    if (storeTiers && storeTiers.length > 0) {
      return storeTiers.map((t) => ({
        name: t.name,
        category: t.category,
        rows: t.rows.length > 0 ? `Rows ${t.rows[0]}–${t.rows[t.rows.length - 1]}` : '',
        price: t.price,
        colorClass:
          t.category.toLowerCase() === 'premier'
            ? 'border-rose-300 bg-rose-50 text-[#9F1239]'
            : t.category.toLowerCase() === 'front'
            ? 'border-amber-300 bg-amber-50 text-[#8D5B28]'
            : 'border-blue-300 bg-blue-50 text-[#1E40AF]',
      }));
    }
    return [
      { name: 'Front', category: 'front', rows: 'Rows A–C', price: 280, colorClass: 'border-amber-300 bg-amber-50 text-[#8D5B28]' },
      { name: 'Prime', category: 'prime', rows: 'Rows D–G', price: 380, colorClass: 'border-blue-300 bg-blue-50 text-[#1E40AF]' },
      { name: 'Premier', category: 'premier', rows: 'Rows H–J', price: 520, colorClass: 'border-rose-300 bg-rose-50 text-[#9F1239]' },
    ];
  }, [layout.seats, storeTiers]);

  // Check URL query flag ?debug=1 (dev builds only)
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      const params = new URLSearchParams(window.location.search);
      setIsDebugMode(params.get('debug') === '1');
    }
  }, []);

  const totalSeatsCount = layout.seats ? layout.seats.length : 100;
  const rowsList = React.useMemo(() => {
    if (!layout.seats || layout.seats.length === 0) return { first: 'A', last: 'J', count: 10 };
    const rSet = new Set(layout.seats.map((s) => s.row));
    const sorted = Array.from(rSet).sort();
    return { first: sorted[0], last: sorted[sorted.length - 1], count: sorted.length };
  }, [layout.seats]);

  const rowRangeText = `${totalSeatsCount} Seats • ${rowsList.count} Rows (${rowsList.first}–${rowsList.last})`;
  const displayHallTitle = auditoriumName || 'Auditorium';
  const displayScreenType = storeScreenType || layout.theatre_type_label || 'Standard Screen';

  // Screen realistic dimensions: SCENE_TO_METERS = 0.5
  const screenMetersWidth = Math.round((layout.screen.width * 0.5) * 10) / 10;
  const screenMetersHeight = Math.round((layout.screen.height * 0.5) * 10) / 10;

  // Compute status counts strictly partitioning into exactly all seats in this auditorium
  const counts = React.useMemo(() => {
    let available = 0;
    let booked = 0;
    let held = 0;
    const selected = selectedSeats.length;

    for (const seat of layout.seats) {
      if (selectedSeats.includes(seat.seat_id)) {
        continue;
      }
      const status: SeatStatus = seatStatuses[seat.seat_id] || 'available';

      if (status === 'available') available++;
      else if (status === 'booked') booked++;
      else if (status === 'held') held++;
    }

    return { available, booked, held, selected };
  }, [seatStatuses, selectedSeats, layout.seats]);

  // First-person modes (Walk/Seated/POV) are minimal: auto-hide the panel
  const isFirstPerson = mode === 'walk' || mode === 'seated' || cameraMode === 'pov' || cameraMode === 'walk';
  if (isFirstPerson) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className="fixed left-4 top-16 z-30 hidden md:block">
        <button
          onClick={() => setIsCollapsed(false)}
          data-testid="expand-auditorium-info-btn"
          className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-[#E6DCD2] bg-white/95 px-4 py-2 text-sm font-bold text-[#1B1320] shadow-md backdrop-blur-md hover:bg-slate-50 transition active:scale-95"
        >
          <Info className="h-4 w-4 text-[#C8102E]" />
          <span>Auditorium Info & Legend</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className="pointer-events-none fixed left-4 top-16 z-20 hidden w-80 max-h-[calc(100dvh-5rem)] flex-col gap-3 overflow-y-auto transition-opacity duration-300 md:flex"
      >
        {/* Theatre Title & Screen Spec Card */}
        <div className="pointer-events-auto rounded-3xl border border-[#E6DCD2] bg-white/95 p-5 shadow-2xl backdrop-blur-md text-[#1B1320]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="h-2.5 w-2.5 rounded-full bg-[#C8102E] shadow-[0_0_8px_#C8102E]" />
                <h1 className="text-base font-bold tracking-tight text-[#1B1320]" data-testid="auditorium-panel-title">
                  {storeTechSpecsDisplay || `${displayHallTitle} · ${storeScreenFormat || displayScreenType} · ${storeSoundSystem || 'Dolby Atmos'} · ${storeProjectionType || '4K Laser'}`}
                </h1>
                {isDemo && (
                  <span className="rounded bg-amber-100 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                    Demo
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500" data-testid="auditorium-panel-subtitle">
                {rowRangeText}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowHonestyModal(true)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#1B1320] transition"
                title="How CineVerse 3D calculates sightlines"
              >
                <Info className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsCollapsed(true)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[#1B1320] transition"
                title="Collapse Panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-[#FAF6F0] border border-[#E6DCD2] p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Screen Format</span>
              <span className="font-bold text-[#1B1320]">{storeScreenFormat || storeScreenType || '2D'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Sound System</span>
              <span className="font-bold text-[#1B1320]">{storeSoundSystem || 'Dolby Atmos'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Projection</span>
              <span className="font-bold text-[#1B1320]">{storeProjectionType || '4K Laser'}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-[#E6DCD2]/60">
              <span className="text-slate-500">Geometry</span>
              <span className="font-medium text-slate-700" data-testid="auditorium-panel-screen-dims">
                {layout.screen.aspect}:1 Aspect ({screenMetersWidth}m × {screenMetersHeight}m)
              </span>
            </div>
            {(layout as any).layout_signature && (
              <div className="flex items-center justify-between pt-1 border-t border-[#E6DCD2]/60">
                <span className="text-slate-500">Signature</span>
                <span className="font-mono text-[11px] font-semibold text-slate-700" data-testid="auditorium-panel-signature">
                  {(layout as any).layout_signature}
                </span>
              </div>
            )}
          </div>

          {/* Format Equipment in Plain Words (§ Stage 3) */}
          {((layout as any).equipment_profile || storeScreenFormat) && (
            <div className="mt-3 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 p-3 text-xs space-y-1.5" data-testid="auditorium-equipment-card">
              <div className="font-bold text-white flex items-center justify-between">
                <span>Auditorium Equipment</span>
                {((layout as any).equipment_profile?.confirmation_note || ['ICE', 'ICE 3D', 'P[XL]', 'EPIQ'].includes(storeScreenFormat || '')) && (
                  <span className="text-[10px] font-normal text-amber-300 italic">
                    details to confirm with the cinema
                  </span>
                )}
              </div>
              <p className="text-slate-300">
                {(layout as any).equipment_profile?.screen_description ||
                  (storeScreenFormat?.includes('IMAX') ? 'Expansive tall curved screen with steep rake' :
                   storeScreenFormat?.includes('Onyx') ? 'Direct-view Samsung Onyx LED with thin black bezel (no projector beam)' :
                   storeScreenFormat?.includes('ScreenX') ? '270° panoramic centre screen + dual side wall screens' :
                   storeScreenFormat === 'Dolby Cinema' ? 'Dolby Vision HDR laser screen with dark matte interior and plush recliners' :
                   'Flat cinema projection screen')}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1 text-[11px]">
                {(storeScreenFormat?.includes('3D') || (layout as any).equipment_profile?.has_glasses_counter) && (
                  <span className="rounded bg-sky-950 text-sky-300 border border-sky-800 px-2 py-0.5">
                    👓 3D glasses counter at entrance
                  </span>
                )}
                {(storeScreenFormat?.includes('4DX') || storeScreenFormat?.includes('MX4D') || (layout as any).equipment_profile?.has_motion_pods) && (
                  <span className="rounded bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5">
                    ⚡ 4-seat motion pods on visible bases
                  </span>
                )}
                {(storeScreenFormat === 'Dolby Cinema' || (layout as any).theatre_type === 'luxury_recliner') && (
                  <span className="rounded bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5">
                    🛋️ Plush brown leather recliners
                  </span>
                )}
                {(storeSoundSystem?.includes('Atmos') || storeSoundSystem?.includes('DTS:X')) ? (
                  <span className="rounded bg-slate-800 text-slate-300 px-2 py-0.5">
                    🔊 Overhead & surround speaker arrays
                  </span>
                ) : storeSoundSystem?.includes('7.1') ? (
                  <span className="rounded bg-slate-800 text-slate-300 px-2 py-0.5">
                    🔊 Side & rear surrounds
                  </span>
                ) : (
                  <span className="rounded bg-slate-800 text-slate-300 px-2 py-0.5">
                    🔊 Standard surround speakers
                  </span>
                )}
                {storeScreenFormat?.includes('Onyx') ? (
                  <span className="rounded bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5">
                    ✨ Direct LED (no projector beam)
                  </span>
                ) : (
                  <span className="rounded bg-slate-800 text-slate-300 px-2 py-0.5">
                    📽️ Projector booth with laser beam
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Seat Categories & Pricing (§ Task 3) */}
          <div className="mt-4 space-y-2 border-t border-[#E6DCD2] pt-3">
            <div className="text-sm font-bold tracking-wider text-slate-500 uppercase">
              Tiers & Pricing
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              {displayTiers.map((tier) => (
                <div key={tier.name} className={`rounded-xl border py-2 ${tier.colorClass}`}>
                  <div className="font-bold">{tier.name}</div>
                  <div className="text-sm text-slate-500">{tier.rows}</div>
                  <div className="mt-0.5 font-black text-sm">₹{Math.round(tier.price)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Seat Availability Counts & Legend (Strictly sums to 100) */}
          <div className="mt-4 border-t border-[#E6DCD2] pt-3">
            <div className="flex items-center justify-between text-sm text-slate-700">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border border-slate-300 bg-[#FAF6F0]" />
                <span className="font-medium">Available</span>
                <span className="font-bold text-slate-500">({counts.available})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[#C8102E]" />
                <span className="font-bold text-[#C8102E]">Selected</span>
                <span className="font-bold text-[#C8102E]">({counts.selected})</span>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-sm text-slate-700">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-medium">Held</span>
                <span className="font-bold text-amber-700">({counts.held})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-slate-300" />
                <span className="font-medium">Booked</span>
                <span className="font-bold text-slate-400">({counts.booked})</span>
              </div>
            </div>
          </div>

          {/* Quick Environment Controls */}
          <div className="mt-4 flex items-center justify-between border-t border-[#E6DCD2] pt-3 text-sm">
            <button
              onClick={() => setHouseLights(houseLights === 'full' ? 'show' : 'full')}
              className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] px-3.5 py-2 text-slate-700 font-bold transition hover:bg-slate-100"
            >
              {houseLights === 'full' ? (
                <>
                  <Sun className="h-4 w-4 text-amber-500" />
                  <span>Lights Up</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-blue-600" />
                  <span>Show Mode</span>
                </>
              )}
            </button>

            {/* Dev Tools: only visible when ?debug=1 in dev */}
            {isDebugMode && (
              <button
                onClick={() => setShowDevControls(!showDevControls)}
                className="flex items-center gap-1.5 rounded-md bg-slate-800/60 px-2 py-1.5 text-sm text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
              >
                <Sliders className="h-3.5 w-3.5" />
                <span>Dev Tools</span>
              </button>
            )}
          </div>

          {/* Dev Simulation Drawer (only when debug enabled) */}
          {isDebugMode && showDevControls && (
            <div className="mt-3 space-y-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-sm text-slate-300">
              <div className="font-semibold text-slate-400">Dev & Test Diagnostics</div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    updateSeatStatus('D05', 'held');
                    showToast('Simulated: Another patron held seat D05');
                  }}
                  className="flex-1 rounded bg-amber-950/60 border border-amber-600/40 px-2 py-1 text-sm text-amber-300 hover:bg-amber-900/60"
                >
                  Hold D05
                </button>
                <button
                  onClick={() => {
                    updateSeatStatus('D05', 'available');
                    showToast('Simulated: Seat D05 released');
                  }}
                  className="flex-1 rounded bg-slate-800 px-2 py-1 text-sm text-slate-300 hover:bg-slate-700"
                >
                  Release D05
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-slate-400">Quality Tier</span>
                <select
                  value={qualityTier}
                  onChange={(e) => setQualityTier(e.target.value as QualityTier)}
                  className="rounded bg-slate-900 px-1.5 py-0.5 text-sm text-slate-200"
                >
                  <option value="high">High (Full fx)</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low (Mobile)</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">HQ Model (9.5MB)</span>
                <input
                  type="checkbox"
                  checked={useHqModel}
                  onChange={(e) => setUseHqModel(e.target.checked)}
                  className="rounded"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Honesty Rules / How is this calculated Modal */}
      {showHonestyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#0e1117] p-6 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Info className="h-5 w-5 text-[#e50914]" />
                How CineVerse 3D Calculates Your View
              </h2>
              <button
                onClick={() => setShowHonestyModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">
              <div className="rounded-lg bg-slate-900/80 p-3">
                <div className="font-semibold text-white">Idealized Procedural Models & Geometric Estimates</div>
                <p className="mt-1">
                  Viewing angles and sightlines are geometric estimates based on SMPTE cinema standards. Procedural halls are idealized acoustic and architectural models generated from auditorium layout specifications and not physical laser scans. Distances in metres are converted using an estimate factor of <strong>≈ 0.43 m per unit</strong>. Heads of patrons in front rows are not modelled.
                </p>
              </div>

              <div className="rounded-lg bg-slate-900/80 p-3">
                <div className="font-semibold text-white">Geometric Eye Model</div>
                <p className="mt-1">
                  Eye heights assume a seated adult with eyes approximately <strong>0.65m</strong> above
                  the seat cushion top and <strong>0.45 units</strong> in front of the backrest.
                  Viewing angles are geometric estimates. Heads of other people are not modelled.
                </p>
              </div>

              <div className="rounded-lg bg-slate-900/80 p-3">
                <div className="font-semibold text-white">Cinema Standard Numbering</div>
                <p className="mt-1">
                  Seat 01 is on your left when facing the screen. Seats run left-to-right (01 to 10)
                  across each row A through J.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHonestyModal(false)}
                className="rounded-lg bg-[#e50914] px-4 py-2 text-sm font-bold text-white hover:bg-red-700 transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
