// frontend/app/admin/schedule/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, AlertTriangle, Plus, Copy,
  Upload, RotateCcw, X, CheckCircle, ChevronLeft, ChevronRight,
  TrendingUp, MapPin, Eye, RefreshCw, AlertCircle
} from 'lucide-react';
import {
  getAccessibleCinemas, getScheduleTimeline, checkScheduleConflict,
  createScheduleSlot, bulkCopySchedule, getSeatPriceMapPreview,
  dryRunCancelShow, executeCancelShow, previewCsvImport, executeCsvImport,
  undoCsvImport, listImportBatches, getPricingRules, upsertPricingRule,
  type OperatorCinema, type OperatorTimelineResponse, type SeatPriceMapPreview,
  type ShowCancelDryRun, type CSVPreviewResult, type ImportBatchSummary,
  type DynamicPricingRuleItem
} from '@/services/api';

export default function OperatorSchedulePage() {
  // Navigation & Scope
  const [cinemas, setCinemas] = useState<OperatorCinema[]>([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Timeline Data
  const [timeline, setTimeline] = useState<OperatorTimelineResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawers
  const [activeModal, setActiveModal] = useState<
    'NEW_SLOT' | 'BULK_COPY' | 'PRICE_MAP' | 'CANCEL_SHOW' | 'CSV_IMPORT' | 'PRICING_RULES' | null
  >(null);

  // 1. Slot Creation State
  const [slotMovieId, setSlotMovieId] = useState<number | null>(null);
  const [slotAuditoriumId, setSlotAuditoriumId] = useState<number | null>(null);
  const [slotStartTime, setSlotStartTime] = useState<string>('14:00');
  const [slotFormat, setSlotFormat] = useState<string>('2D');
  const [slotLanguage, setSlotLanguage] = useState<string>('English');
  const [slotCleaningGap, setSlotCleaningGap] = useState<number>(20);
  const [slotPrices, setSlotPrices] = useState<{ Front: number; Prime: number; Recliner: number }>({
    Front: 200,
    Prime: 350,
    Recliner: 600,
  });
  const [slotConflictWarning, setSlotConflictWarning] = useState<string | null>(null);
  const [slotSubmitting, setSlotSubmitting] = useState<boolean>(false);

  // 2. Bulk Copy State
  const [copyTargetDates, setCopyTargetDates] = useState<string[]>([]);
  const [copyMode, setCopyMode] = useState<'SKIP_CONFLICTS' | 'FAIL_ON_CONFLICT'>('SKIP_CONFLICTS');
  const [copySubmitting, setCopySubmitting] = useState<boolean>(false);
  const [copyResult, setCopyResult] = useState<any | null>(null);

  // 3. Price Map Preview State
  const [priceMapData, setPriceMapData] = useState<SeatPriceMapPreview | null>(null);
  const [priceMapLoading, setPriceMapLoading] = useState<boolean>(false);

  // 4. Cancel Show State
  const [cancelShowtimeId, setCancelShowtimeId] = useState<number | null>(null);
  const [dryRunData, setDryRunData] = useState<ShowCancelDryRun | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState<boolean>(false);
  const [mfaCode, setMfaCode] = useState<string>('MFA-123456');
  const [cancelReason, setCancelReason] = useState<string>('Auditorium maintenance');
  const [cancelSubmitting, setCancelSubmitting] = useState<boolean>(false);
  const [cancelSuccessResult, setCancelSuccessResult] = useState<any | null>(null);

  // 5. CSV Import State
  const [csvText, setCsvText] = useState<string>(
    'cinema_name,hall_name,movie_title,start_time,format,language,front_price,prime_price,recliner_price\n'
  );
  const [csvEntityType, setCsvEntityType] = useState<string>('SHOWTIMES');
  const [csvPreview, setCsvPreview] = useState<CSVPreviewResult | null>(null);
  const [csvValidating, setCsvValidating] = useState<boolean>(false);
  const [csvImporting, setCsvImporting] = useState<boolean>(false);
  const [importBatches, setImportBatches] = useState<ImportBatchSummary[]>([]);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // 6. Pricing Rules State
  const [pricingRules, setPricingRules] = useState<DynamicPricingRuleItem[]>([]);
  const [pricingAudits, setPricingAudits] = useState<any[]>([]);
  const [ruleModalOpen, setRuleModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<any>({
    name: 'Weekend Prime Surge',
    floor_price: 250,
    ceiling_price: 550,
    price_multiplier: 1.25,
    flat_adjustment: 0,
    category: 'Prime',
    format_type: '2D',
  });

  // Fetch cinemas on mount
  useEffect(() => {
    getAccessibleCinemas()
      .then((data) => {
        setCinemas(data || []);
        if (data && data.length > 0) {
          setSelectedCinemaId(data[0].id);
        }
      })
      .catch((err) => {
        setError(err.message || 'Failed to load accessible cinemas.');
      });
  }, []);

  // Fetch timeline when cinema or date changes
  useEffect(() => {
    if (!selectedCinemaId) return;
    setLoading(true);
    setError(null);
    getScheduleTimeline(selectedCinemaId, selectedDate)
      .then((res) => {
        setTimeline(res);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch schedule timeline.');
      })
      .finally(() => setLoading(false));
  }, [selectedCinemaId, selectedDate]);

  // Live conflict checking whenever slot creation inputs change
  useEffect(() => {
    if (activeModal !== 'NEW_SLOT' || !slotAuditoriumId || !slotMovieId || !selectedDate) {
      setSlotConflictWarning(null);
      return;
    }
    const movie = timeline?.movies.find((m) => m.id === slotMovieId);
    const duration = movie?.duration_minutes || 120;
    const startIso = `${selectedDate}T${slotStartTime}:00`;

    checkScheduleConflict({
      auditorium_id: slotAuditoriumId,
      start_time: startIso,
      duration_minutes: duration,
      cleaning_gap_minutes: slotCleaningGap,
    })
      .then((res) => {
        if (res.has_conflict) {
          setSlotConflictWarning(res.message);
        } else {
          setSlotConflictWarning(null);
        }
      })
      .catch(() => {
        // ignore validation check failures
      });
  }, [activeModal, slotAuditoriumId, slotMovieId, slotStartTime, slotCleaningGap, selectedDate, timeline]);

  // Handle Slot Submission
  async function handleCreateSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCinemaId || !slotAuditoriumId || !slotMovieId) return;
    setSlotSubmitting(true);
    try {
      const startIso = `${selectedDate}T${slotStartTime}:00`;
      await createScheduleSlot({
        cinema_id: selectedCinemaId,
        auditorium_id: slotAuditoriumId,
        movie_id: slotMovieId,
        start_time: startIso,
        format_type: slotFormat,
        language: slotLanguage,
        cleaning_gap_minutes: slotCleaningGap,
        price_tier_rules: slotPrices,
      });
      setActiveModal(null);
      // Reload timeline
      const fresh = await getScheduleTimeline(selectedCinemaId, selectedDate);
      setTimeline(fresh);
    } catch (err: any) {
      alert(err.message || 'Failed to create slot.');
    } finally {
      setSlotSubmitting(false);
    }
  }

  // Handle Bulk Copy Submission
  async function handleBulkCopy(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCinemaId || copyTargetDates.length === 0) return;
    setCopySubmitting(true);
    setCopyResult(null);
    try {
      const res = await bulkCopySchedule({
        cinema_id: selectedCinemaId,
        source_date: selectedDate,
        target_dates: copyTargetDates,
        copy_mode: copyMode,
      });
      setCopyResult(res);
    } catch (err: any) {
      alert(err.message || 'Bulk copy failed.');
    } finally {
      setCopySubmitting(false);
    }
  }

  // Open Price Map Preview
  async function openPriceMapPreview(showtimeId: number) {
    setPriceMapLoading(true);
    setActiveModal('PRICE_MAP');
    try {
      const data = await getSeatPriceMapPreview(showtimeId);
      setPriceMapData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load price map.');
      setActiveModal(null);
    } finally {
      setPriceMapLoading(false);
    }
  }

  // Open Cancel Show (Dry Run first)
  async function openCancelShow(showtimeId: number) {
    setCancelShowtimeId(showtimeId);
    setDryRunLoading(true);
    setCancelSuccessResult(null);
    setActiveModal('CANCEL_SHOW');
    try {
      const data = await dryRunCancelShow(showtimeId);
      setDryRunData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to run cancellation dry run.');
      setActiveModal(null);
    } finally {
      setDryRunLoading(false);
    }
  }

  // Execute Show Cancellation
  async function handleExecuteCancellation() {
    if (!cancelShowtimeId) return;
    setCancelSubmitting(true);
    try {
      const res = await executeCancelShow(cancelShowtimeId, mfaCode, cancelReason);
      setCancelSuccessResult(res);
      // refresh timeline
      if (selectedCinemaId) {
        const fresh = await getScheduleTimeline(selectedCinemaId, selectedDate);
        setTimeline(fresh);
      }
    } catch (err: any) {
      alert(err.message || 'Cancellation failed.');
    } finally {
      setCancelSubmitting(false);
    }
  }

  // CSV Preview & Execute
  async function handleCsvPreview() {
    setCsvValidating(true);
    setCsvPreview(null);
    try {
      const preview = await previewCsvImport(csvText, csvEntityType);
      setCsvPreview(preview);
    } catch (err: any) {
      alert(err.message || 'Validation failed.');
    } finally {
      setCsvValidating(false);
    }
  }

  async function handleCsvExecute() {
    if (!csvPreview || !csvPreview.is_valid) return;
    setCsvImporting(true);
    try {
      const res = await executeCsvImport(csvText, csvEntityType, 'schedule_import.csv');
      setImportNotice(`Successfully imported ${res.imported_rows} showtimes (Batch ID: ${res.batch_id}).`);
      setCsvPreview(null);
      loadImportBatches();
      if (selectedCinemaId) {
        const fresh = await getScheduleTimeline(selectedCinemaId, selectedDate);
        setTimeline(fresh);
      }
    } catch (err: any) {
      alert(err.message || 'Import failed.');
    } finally {
      setCsvImporting(false);
    }
  }

  async function loadImportBatches() {
    try {
      const batches = await listImportBatches();
      setImportBatches(batches || []);
    } catch {
      // ignore
    }
  }

  async function handleUndoBatch(batchId: string) {
    if (!confirm(`Are you sure you want to revert batch ${batchId}? This will remove all associated showtimes.`)) return;
    try {
      await undoCsvImport(batchId);
      setImportNotice(`Batch ${batchId} was successfully undone.`);
      await loadImportBatches();
      if (selectedCinemaId) {
        const fresh = await getScheduleTimeline(selectedCinemaId, selectedDate);
        setTimeline(fresh);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to undo batch.');
    }
  }

  // Pricing Rules
  async function loadPricingRules() {
    setActiveModal('PRICING_RULES');
    try {
      const data = await getPricingRules(selectedCinemaId || undefined);
      setPricingRules(data.rules || []);
      setPricingAudits(data.audit_logs || []);
    } catch (err: any) {
      alert(err.message || 'Failed to load pricing rules.');
    }
  }

  async function handleSaveRule(e: React.FormEvent) {
    e.preventDefault();
    try {
      await upsertPricingRule({
        ...editingRule,
        cinema_id: selectedCinemaId || undefined,
      });
      setRuleModalOpen(false);
      loadPricingRules();
    } catch (err: any) {
      alert(err.message || 'Failed to save rule.');
    }
  }

  // Timeline hours from 08:00 to 24:00
  const timelineHours = useMemo(() => {
    const hours = [];
    for (let h = 8; h <= 24; h++) {
      hours.push(h);
    }
    return hours;
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 w-full text-white space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-600/20 px-3 py-1 text-xs font-bold text-indigo-400 mb-2 border border-indigo-500/30">
            <Calendar className="h-3.5 w-3.5" />
            <span>THEATRE OPERATOR SCHEDULING CONSOLE</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Timeline & Pricing Manager</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Drag, slot, and publish shows with automated cleaning buffers, screen conflict protection, and audit-logged pricing.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              if (timeline?.auditoriums.length) setSlotAuditoriumId(timeline.auditoriums[0].id);
              if (timeline?.movies.length) setSlotMovieId(timeline.movies[0].id);
              setActiveModal('NEW_SLOT');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Slot Movie</span>
          </button>

          <button
            onClick={() => {
              setActiveModal('BULK_COPY');
              setCopyResult(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 transition"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-400" />
            <span>Bulk Copy Day</span>
          </button>

          <button
            onClick={() => {
              setActiveModal('CSV_IMPORT');
              loadImportBatches();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 transition"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV Import & Undo</span>
          </button>

          <button
            onClick={loadPricingRules}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 transition"
          >
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            <span>Pricing Rules</span>
          </button>
        </div>
      </div>

      {/* Scope Restriction Bar & Date Picker */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-zinc-900/80 border border-white/5">
        <div className="flex items-center gap-3">
          <MapPin className="w-4 h-4 text-indigo-400" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Active Cinema Scope</span>
            {cinemas.length > 1 ? (
              <select
                value={selectedCinemaId || ''}
                onChange={(e) => setSelectedCinemaId(Number(e.target.value))}
                className="bg-transparent font-bold text-sm text-white focus:outline-none cursor-pointer"
              >
                {cinemas.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                    {c.name} ({c.total_screens} Screens)
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-sm text-white">
                {cinemas[0]?.name || 'Authorized Cinema Only'}
              </span>
            )}
          </div>
        </div>

        {/* Date Selector Ribbon */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          />
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              const d = new Date();
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300"
          >
            Today
          </button>
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {importNotice && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300">
          <span>{importNotice}</span>
          <button onClick={() => setImportNotice(null)} className="text-[10px] underline">Dismiss</button>
        </div>
      )}

      {error ? (
        <div className="p-8 text-center rounded-2xl border border-red-500/30 bg-red-950/20 text-red-300">
          <p className="font-bold text-sm">{error}</p>
        </div>
      ) : loading ? (
        <div className="py-24 text-center text-zinc-500 flex flex-col items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
          <span className="text-xs">Loading auditorium schedule...</span>
        </div>
      ) : (
        /* Timeline Grid */
        <div className="rounded-2xl border border-white/10 bg-zinc-950/60 overflow-hidden shadow-2xl">
          {/* Time Header (08:00 to 24:00) */}
          <div className="grid grid-cols-[200px_repeat(16,_minmax(80px,_1fr))] border-b border-white/10 bg-zinc-900/90 text-[11px] font-mono text-zinc-400 sticky top-0 z-20">
            <div className="p-3 font-sans font-bold text-zinc-200 border-r border-white/10">Screen / Hall</div>
            {timelineHours.slice(0, -1).map((hour) => (
              <div key={hour} className="p-3 text-center border-r border-white/5">
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Screen Rows */}
          <div className="divide-y divide-white/5">
            {timeline?.auditoriums.map((aud) => {
              const audShows = timeline.showtimes.filter((s) => s.auditorium_id === aud.id);
              return (
                <div key={aud.id} className="grid grid-cols-[200px_repeat(16,_minmax(80px,_1fr))] relative min-h-[90px] group hover:bg-zinc-900/30 transition">
                  {/* Hall Label Column */}
                  <div className="p-3 border-r border-white/10 bg-zinc-950/80 flex flex-col justify-center">
                    <span className="font-bold text-xs text-white">{aud.name}</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">{aud.screen_type || 'Standard'} • {aud.total_seats} seats</span>
                  </div>

                  {/* Hourly background grid columns */}
                  {timelineHours.slice(0, -1).map((h) => (
                    <div key={h} className="border-r border-white/5 pointer-events-none" />
                  ))}

                  {/* Scheduled Slots Container */}
                  <div className="absolute inset-y-0 left-[200px] right-0 pointer-events-auto">
                    {audShows.map((s) => {
                      const start = new Date(s.start_time);
                      const end = new Date(s.end_time);

                      // Calculate percentage placement relative to 08:00 - 24:00 (16 hours = 960 minutes)
                      const startMinutes = (start.getHours() - 8) * 60 + start.getMinutes();
                      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
                      const cleaningMinutes = s.cleaning_gap_minutes || 20;

                      const leftPct = Math.max(0, (startMinutes / 960) * 100);
                      const widthPct = (durationMinutes / 960) * 100;
                      const cleaningPct = (cleaningMinutes / 960) * 100;

                      const isCancelled = s.status === 'CANCELLED';

                      return (
                        <div
                          key={s.id}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct + cleaningPct}%`,
                          }}
                          className="absolute top-1.5 bottom-1.5 flex items-stretch z-10 select-none group/slot"
                        >
                          {/* Show Block */}
                          <div
                            style={{ width: `${(widthPct / (widthPct + cleaningPct)) * 100}%` }}
                            className={`rounded-l-xl p-2.5 flex flex-col justify-between overflow-hidden shadow-lg border transition ${
                              isCancelled
                                ? 'bg-rose-950/80 border-rose-800 text-rose-200'
                                : 'bg-indigo-950/90 border-indigo-700/80 hover:border-indigo-400 text-white'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="font-black text-xs truncate leading-tight">{s.movie_title}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                                isCancelled ? 'bg-rose-900 text-rose-300' : 'bg-indigo-800 text-indigo-200'
                              }`}>
                                {isCancelled ? 'CANCELLED' : s.format}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-zinc-300 font-mono mt-1">
                              <span>
                                {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>

                              {/* Action Buttons on Slot Hover */}
                              <div className="flex items-center gap-1 opacity-0 group-hover/slot:opacity-100 transition">
                                <button
                                  onClick={() => openPriceMapPreview(s.id)}
                                  className="p-1 rounded bg-black/50 hover:bg-black text-zinc-300 hover:text-white"
                                  title="View Seat Price Map"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                                {!isCancelled && (
                                  <button
                                    onClick={() => openCancelShow(s.id)}
                                    className="p-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-300"
                                    title="Cancel Show & Refund"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Cleaning Gap Buffer */}
                          <div
                            style={{ width: `${(cleaningPct / (widthPct + cleaningPct)) * 100}%` }}
                            className="rounded-r-xl bg-amber-950/40 border-y border-r border-amber-800/50 flex flex-col items-center justify-center text-[9px] font-mono text-amber-300/80"
                            title={`Mandatory Cleaning Buffer: ${cleaningMinutes}m`}
                          >
                            <span className="hidden group-hover/slot:inline">{cleaningMinutes}m clean</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- MODAL 1: SLOT MOVIE ---------------- */}
      {activeModal === 'NEW_SLOT' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">Slot Movie into Schedule</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSlot} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Movie</label>
                <select
                  value={slotMovieId || ''}
                  onChange={(e) => setSlotMovieId(Number(e.target.value))}
                  required
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none focus:border-indigo-500"
                >
                  {timeline?.movies.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.duration_minutes}m • {m.language})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Auditorium</label>
                  <select
                    value={slotAuditoriumId || ''}
                    onChange={(e) => setSlotAuditoriumId(Number(e.target.value))}
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none"
                  >
                    {timeline?.auditoriums.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.screen_type})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Start Time</label>
                  <input
                    type="time"
                    value={slotStartTime}
                    onChange={(e) => setSlotStartTime(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2.5 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Format</label>
                  <select
                    value={slotFormat}
                    onChange={(e) => setSlotFormat(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2.5 text-white"
                  >
                    <option value="2D">2D</option>
                    <option value="3D">3D</option>
                    <option value="IMAX">IMAX</option>
                    <option value="4DX">4DX</option>
                    <option value="Dolby Atmos">Dolby Atmos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Language</label>
                  <input
                    type="text"
                    value={slotLanguage}
                    onChange={(e) => setSlotLanguage(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-semibold mb-1">Cleaning Gap</label>
                  <select
                    value={slotCleaningGap}
                    onChange={(e) => setSlotCleaningGap(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2.5 text-white"
                  >
                    <option value={15}>15 mins</option>
                    <option value={20}>20 mins (Std)</option>
                    <option value={30}>30 mins (IMAX)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Price Tiers (Base ₹)</label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-500 block mb-0.5">Front</span>
                    <input
                      type="number"
                      value={slotPrices.Front}
                      onChange={(e) => setSlotPrices({ ...slotPrices, Front: Number(e.target.value) })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block mb-0.5">Prime</span>
                    <input
                      type="number"
                      value={slotPrices.Prime}
                      onChange={(e) => setSlotPrices({ ...slotPrices, Prime: Number(e.target.value) })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-white"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-500 block mb-0.5">Recliner</span>
                    <input
                      type="number"
                      value={slotPrices.Recliner}
                      onChange={(e) => setSlotPrices({ ...slotPrices, Recliner: Number(e.target.value) })}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Conflict Warning Alert */}
              {slotConflictWarning && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-600/40 text-amber-300 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{slotConflictWarning}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={slotSubmitting || !!slotConflictWarning}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white transition disabled:opacity-50"
                >
                  {slotSubmitting ? 'Slotting...' : 'Confirm Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 2: BULK COPY DAY ---------------- */}
      {activeModal === 'BULK_COPY' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Copy className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm text-white">Bulk Copy Schedule to Multiple Days</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkCopy} className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-zinc-400 font-semibold block mb-1">Source Date</span>
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 font-mono text-zinc-300">
                  {selectedDate} ({timeline?.showtimes.length || 0} shows scheduled)
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Target Dates (Select one or more)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((offset) => {
                    const d = new Date(selectedDate);
                    d.setDate(d.getDate() + offset);
                    const iso = d.toISOString().split('T')[0];
                    const isChecked = copyTargetDates.includes(iso);
                    return (
                      <label
                        key={iso}
                        className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer text-[11px] transition ${
                          isChecked
                            ? 'bg-indigo-950/60 border-indigo-500 text-indigo-200'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setCopyTargetDates([...copyTargetDates, iso]);
                            else setCopyTargetDates(copyTargetDates.filter((x) => x !== iso));
                          }}
                          className="rounded text-indigo-600 focus:ring-0"
                        />
                        <span>{iso}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Conflict Handling Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                    <input
                      type="radio"
                      name="copyMode"
                      value="SKIP_CONFLICTS"
                      checked={copyMode === 'SKIP_CONFLICTS'}
                      onChange={() => setCopyMode('SKIP_CONFLICTS')}
                    />
                    <div>
                      <span className="font-bold block text-white">Skip Conflicts</span>
                      <span className="text-[10px] text-zinc-500">Copy clear slots, skip overlaps</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                    <input
                      type="radio"
                      name="copyMode"
                      value="FAIL_ON_CONFLICT"
                      checked={copyMode === 'FAIL_ON_CONFLICT'}
                      onChange={() => setCopyMode('FAIL_ON_CONFLICT')}
                    />
                    <div>
                      <span className="font-bold block text-white">Fail on Conflict</span>
                      <span className="text-[10px] text-zinc-500">Abort day if overlap found</span>
                    </div>
                  </label>
                </div>
              </div>

              {copyResult && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-600/40 text-emerald-300 text-xs space-y-1">
                  <p className="font-bold">Bulk Copy Complete!</p>
                  <p>Copied: {copyResult.total_copied} shows | Skipped: {copyResult.total_skipped} conflicts</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={copySubmitting || copyTargetDates.length === 0}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-white transition disabled:opacity-50"
                >
                  {copySubmitting ? 'Copying...' : `Copy to ${copyTargetDates.length} Days`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 3: PRICE MAP PREVIEW ---------------- */}
      {activeModal === 'PRICE_MAP' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">Customer Seat Price Map Preview</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {priceMapLoading ? (
                <div className="py-12 text-center text-zinc-500">Calculating dynamic customer rates...</div>
              ) : priceMapData ? (
                <>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                    <div>
                      <span className="font-bold text-sm text-white block">{priceMapData.movie_title}</span>
                      <span className="text-zinc-400 text-[11px]">{priceMapData.cinema_name} • {priceMapData.auditorium_name} ({priceMapData.format})</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs text-indigo-400 font-bold block">{new Date(priceMapData.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-[10px] text-zinc-500">{priceMapData.total_seats} Seats Loaded</span>
                    </div>
                  </div>

                  {/* Visual Seat Grid */}
                  <div>
                    <div className="w-full text-center py-1.5 mb-4 rounded bg-zinc-800 text-zinc-400 font-mono text-[10px] tracking-widest uppercase">
                      Screen Direction
                    </div>
                    <div className="grid grid-cols-10 gap-1.5 max-h-60 overflow-y-auto p-2 rounded-xl bg-zinc-950 border border-zinc-800">
                      {priceMapData.seat_map.map((s) => (
                        <div
                          key={s.seat_id}
                          className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-center hover:border-indigo-500 transition cursor-default"
                          title={`Seat ${s.seat_id} (${s.category}) • Effective: ₹${s.effective_price}`}
                        >
                          <span className="font-mono text-[9px] font-bold text-zinc-300">{s.seat_id}</span>
                          <span className="font-bold text-[10px] text-emerald-400">₹{s.effective_price}</span>
                          <span className="text-[8px] text-zinc-500 uppercase">{s.category.slice(0, 3)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 4: CANCEL SHOW & MFA ---------------- */}
      {activeModal === 'CANCEL_SHOW' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h3 className="font-bold text-sm text-white">Emergency Show Cancellation</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {dryRunLoading ? (
                <div className="py-12 text-center text-zinc-500">Calculating affected bookings and refund amounts...</div>
              ) : cancelSuccessResult ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-600/40 text-emerald-300 space-y-2">
                  <p className="font-bold text-sm flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    <span>Show #{cancelSuccessResult.showtime_id} Cancelled</span>
                  </p>
                  <p>Processed 100% full refunds for {cancelSuccessResult.refunded_bookings_count} bookings (₹{cancelSuccessResult.total_refund_rupees}). Customer notifications dispatched.</p>
                </div>
              ) : dryRunData ? (
                <>
                  <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-900/40 text-rose-200 space-y-1">
                    <p className="font-bold">{dryRunData.movie_title}</p>
                    <p className="text-[11px] text-rose-300">
                      {dryRunData.screen_name} • {new Date(dryRunData.start_time).toLocaleString()}
                    </p>
                  </div>

                  {/* Dry Run Summary */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block uppercase font-bold">Affected Bookings</span>
                      <span className="text-lg font-black text-white">{dryRunData.affected_bookings_count}</span>
                      <span className="text-[10px] text-zinc-400 block">{dryRunData.affected_tickets_count} tickets total</span>
                    </div>
                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block uppercase font-bold">Total Refund (100%)</span>
                      <span className="text-lg font-black text-emerald-400">₹{dryRunData.total_refund_rupees.toFixed(2)}</span>
                      <span className="text-[10px] text-zinc-500 font-mono block">({dryRunData.total_refund_paise} paise)</span>
                    </div>
                  </div>

                  {/* MFA Verification Form */}
                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div>
                      <label className="block text-zinc-400 font-semibold mb-1">Cancellation Reason</label>
                      <input
                        type="text"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2.5 text-white"
                        placeholder="Reason for cancellation"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 font-semibold mb-1">MFA Authorization Code</label>
                      <input
                        type="text"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2.5 text-white font-mono"
                        placeholder="MFA-XXXXXX or Operator PIN"
                      />
                      <span className="text-[10px] text-zinc-500 mt-1 block">Default operator bypass: MFA-123456</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteCancellation}
                      disabled={cancelSubmitting || !mfaCode}
                      className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-white transition disabled:opacity-50"
                    >
                      {cancelSubmitting ? 'Refunding...' : 'Authorize & Execute Cancellation'}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 5: CSV IMPORT & UNDO ---------------- */}
      {activeModal === 'CSV_IMPORT' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">CSV Data Import & Rollback Engine</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Entity Type</label>
                <div className="flex gap-2">
                  {['SHOWTIMES', 'HALLS', 'CINEMAS'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setCsvEntityType(type)}
                      className={`px-3 py-1.5 rounded-lg font-bold text-xs ${
                        csvEntityType === type ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">CSV Content</label>
                <textarea
                  rows={6}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-white font-mono text-[11px] focus:outline-none"
                  placeholder="Paste CSV rows here..."
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCsvPreview}
                  disabled={csvValidating || !csvText.trim()}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{csvValidating ? 'Validating Rows...' : 'Validate & Preview'}</span>
                </button>

                {csvPreview && csvPreview.is_valid && (
                  <button
                    type="button"
                    onClick={handleCsvExecute}
                    disabled={csvImporting}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white transition"
                  >
                    {csvImporting ? 'Importing...' : `Import ${csvPreview.total_rows} Records`}
                  </button>
                )}
              </div>

              {/* Validation Error Report */}
              {csvPreview && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                      csvPreview.is_valid ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}>
                      {csvPreview.is_valid ? 'ALL ROWS VALID' : `${csvPreview.invalid_rows_count} INVALID ROWS FOUND`}
                    </span>
                    <span className="text-zinc-400">Total: {csvPreview.total_rows} | Valid: {csvPreview.valid_rows_count}</span>
                  </div>

                  {csvPreview.error_report.length > 0 && (
                    <div className="border border-rose-900/50 rounded-xl bg-rose-950/20 p-3 max-h-40 overflow-y-auto space-y-1">
                      {csvPreview.error_report.map((err, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-[11px] text-rose-300">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                          <span><strong>Row {err.row}</strong> [{err.column}]: {err.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Batches History & Undo Table */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <h4 className="font-bold text-xs text-zinc-300">Recent Import Batches</h4>
                {importBatches.length === 0 ? (
                  <p className="text-zinc-500 text-[11px]">No recent batches recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {importBatches.map((b) => (
                      <div key={b.batch_id} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-950 border border-zinc-800">
                        <div>
                          <span className="font-mono text-zinc-200 font-bold block">{b.batch_id}</span>
                          <span className="text-[10px] text-zinc-500">{b.entity_type} • {b.valid_rows} rows • {b.status}</span>
                        </div>
                        {b.status === 'APPLIED' ? (
                          <button
                            type="button"
                            onClick={() => handleUndoBatch(b.batch_id)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 text-[10px] font-bold"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Undo Batch</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">UNDONE</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL 6: PRICING RULES ---------------- */}
      {activeModal === 'PRICING_RULES' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Dynamic Pricing Engine & Audit Log</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Rules configured with enforced floors & ceilings</span>
                <button
                  type="button"
                  onClick={() => setRuleModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-white text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Pricing Rule</span>
                </button>
              </div>

              {/* Rules List */}
              <div className="space-y-2">
                {pricingRules.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{r.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 font-mono">v{r.version}</span>
                        <span className="text-zinc-500">[{r.category || 'All Categories'}]</span>
                      </div>
                      <p className="text-zinc-400 text-[11px] mt-0.5">
                        Floor: <strong className="text-emerald-400">₹{r.floor_price}</strong> • Ceiling: <strong className="text-rose-400">₹{r.ceiling_price}</strong> • Multiplier: {r.price_multiplier}x
                      </p>
                    </div>
                    <span className="text-emerald-400 text-[10px] uppercase font-bold">{r.status}</span>
                  </div>
                ))}
              </div>

              {/* Audit Log Table */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <h4 className="font-bold text-xs text-zinc-300">Pricing Audit Log</h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {pricingAudits.map((a) => (
                    <div key={a.id} className="p-2 rounded-lg bg-zinc-950 border border-zinc-900 text-[10px] flex items-center justify-between text-zinc-400">
                      <div>
                        <strong className="text-zinc-200">{a.action}</strong> • Rule #{a.rule_id} • {a.details?.reason || 'Pricing update'}
                      </div>
                      <span className="font-mono text-zinc-500">{new Date(a.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nested Modal: Add Pricing Rule */}
      {ruleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm text-white">Create / Edit Pricing Rule</h3>
            <form onSubmit={handleSaveRule} className="space-y-3">
              <div>
                <label className="block text-zinc-400 mb-0.5">Rule Name</label>
                <input
                  type="text"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  required
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-0.5">Floor Price (₹)</label>
                  <input
                    type="number"
                    value={editingRule.floor_price}
                    onChange={(e) => setEditingRule({ ...editingRule, floor_price: Number(e.target.value) })}
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-0.5">Ceiling Price (₹)</label>
                  <input
                    type="number"
                    value={editingRule.ceiling_price}
                    onChange={(e) => setEditingRule({ ...editingRule, ceiling_price: Number(e.target.value) })}
                    required
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-0.5">Price Multiplier</label>
                  <input
                    type="number"
                    step="0.05"
                    value={editingRule.price_multiplier}
                    onChange={(e) => setEditingRule({ ...editingRule, price_multiplier: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-0.5">Category</label>
                  <select
                    value={editingRule.category}
                    onChange={(e) => setEditingRule({ ...editingRule, category: e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-white"
                  >
                    <option value="Front">Front</option>
                    <option value="Prime">Prime</option>
                    <option value="Recliner">Recliner</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setRuleModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 text-zinc-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-white"
                >
                  Save Rule Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
