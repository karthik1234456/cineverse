'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Layers, CheckCircle2, AlertCircle, ShieldAlert, ArrowLeft,
  RotateCcw, Sparkles, Box, Sliders, Check, Eye
} from 'lucide-react';
import { apiFetch } from '@/services/api';

export default function HallDesignerPage() {
  const [selectedAuditoriumId, setSelectedAuditoriumId] = useState<number>(1);
  const [hallName, setHallName] = useState<string>('Auditorium 1 — Astral Koramangala');
  const [rowCount, setRowCount] = useState<number>(10);
  const [seatsPerRow, setSeatsPerRow] = useState<number>(10);
  const [aislesInput, setAislesInput] = useState<string>('3, 7');
  const [aisleWidthM, setAisleWidthM] = useState<number>(1.2);
  const [numberingDirection, setNumberingDirection] = useState<'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT'>('LEFT_TO_RIGHT');
  const [screenSize, setScreenSize] = useState<string>('CURVED_LARGE');

  // Accessible seating
  const [wheelchairSeats, setWheelchairSeats] = useState<string[]>(['A01', 'A02']);
  const [companionSeats, setCompanionSeats] = useState<string[]>(['A03']);

  // Validation & Publishing state
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Generate rows array
  const rowLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N'].slice(0, rowCount);
  const aisles = aislesInput.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
  const totalCapacity = rowCount * seatsPerRow;

  const handleValidate = async () => {
    setIsValidating(true);
    setValidationErrors([]);
    setPublishMessage(null);
    setPublishError(null);

    try {
      const payload = {
        auditorium_id: selectedAuditoriumId,
        name: hallName,
        rows: rowLetters,
        seats_per_row: seatsPerRow,
        aisles: aisles,
        aisle_width_m: aisleWidthM,
        wheelchair_seats: wheelchairSeats,
        companion_seats: companionSeats,
        numbering_direction: numberingDirection,
        screen_size: screenSize,
      };

      const res = await apiFetch<any>('/admin/onboarding/designer/validate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setValidationResult(res);
      setValidationErrors(res.errors || []);
    } catch (err: any) {
      setValidationErrors([err.message || 'Validation request failed']);
    } finally {
      setIsValidating(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishMessage(null);
    setPublishError(null);

    try {
      // Build layout JSON
      const seats = [];
      for (const r of rowLetters) {
        for (let n = 1; n <= seatsPerRow; n++) {
          const seatId = `${r}${n.toString().padStart(2, '0')}`;
          const isWheelchair = wheelchairSeats.includes(seatId);
          const isComp = companionSeats.includes(seatId);
          let cat = 'Prime';
          if (['A', 'B', 'C'].includes(r)) cat = 'Front';
          if (['H', 'I', 'J'].includes(r)) cat = 'Premier';
          if (isWheelchair) cat = 'Wheelchair';
          if (isComp) cat = 'Companion';

          seats.push({
            seat_id: seatId,
            row: r,
            number: n,
            category: cat,
            node_name: `seat_${r}_${n.toString().padStart(2, '0')}`,
            screen_distance: 8.0 + (rowLetters.indexOf(r) * 1.2),
            vertical_angle_deg: (10 - rowLetters.indexOf(r)) * 1.5,
            horizontal_offset_deg: (n - (seatsPerRow / 2)) * 3.5,
            is_accessible: isWheelchair,
            is_companion: isComp,
          });
        }
      }

      const layoutData = {
        format_version: '2.0',
        auditorium_name: hallName,
        screen_size: screenSize,
        numbering_direction: numberingDirection,
        seats,
      };

      const formData = new FormData();
      formData.append('version_label', '3.0');
      formData.append('seat_layout_json', JSON.stringify(layoutData));

      const res = await fetch(`http://127.0.0.1:8002/api/v1/admin/onboarding/publish?auditorium_id=${selectedAuditoriumId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('cineverse_token') || ''}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Publish failed');
      }

      setPublishMessage(`Auditorium layout published successfully as version 3.0 with ${seats.length} seats!`);
    } catch (err: any) {
      setPublishError(err.message || 'Failed to publish layout. Active bookings may protect this auditorium.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 text-[#1B1320] space-y-8" data-testid="hall-designer-page">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6DCD2] pb-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C8102E] hover:underline mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Admin Console</span>
          </Link>
          <h1 className="text-3xl font-black text-[#1B1320]" data-testid="hall-designer-title">Visual Hall Designer</h1>
          <p className="text-sm text-slate-600 mt-1">
            Design, validate, and publish auditorium layouts without developers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleValidate}
            disabled={isValidating}
            data-testid="validate-layout-btn"
            className="flex min-h-[44px] items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-[#1B1320] bg-white font-bold text-sm text-[#1B1320] hover:bg-slate-50 transition shadow-xs"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{isValidating ? 'Validating...' : 'Validate Layout'}</span>
          </button>

          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            data-testid="publish-hall-btn"
            className="flex min-h-[44px] items-center gap-2 px-6 py-2.5 rounded-xl bg-[#C8102E] font-bold text-sm text-white hover:bg-[#A60D26] transition shadow-md"
          >
            <Check className="h-4 w-4" />
            <span>{isPublishing ? 'Publishing...' : 'Publish Layout'}</span>
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {publishMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm flex items-center gap-3" data-testid="publish-success-banner">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{publishMessage}</span>
        </div>
      )}

      {publishError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-sm flex items-center gap-3" data-testid="publish-error-banner">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{publishError}</span>
        </div>
      )}

      {/* Grid: Left Editor Controls & Right Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Editor Controls */}
        <div className="lg:col-span-5 rounded-3xl border border-[#E6DCD2] bg-white p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 text-base font-bold text-[#1B1320] border-b border-[#E6DCD2] pb-3">
            <Sliders className="h-5 w-5 text-[#C8102E]" />
            <span>Layout Geometry Specifications</span>
          </div>

          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Auditorium Target
              </label>
              <select
                value={selectedAuditoriumId}
                onChange={(e) => setSelectedAuditoriumId(Number(e.target.value))}
                className="w-full rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] p-2.5 font-bold text-[#1B1320]"
                data-testid="select-auditorium-target"
              >
                <option value={1}>Auditorium 1 (Flagship Laser)</option>
                <option value={2}>Auditorium 2 (Standard)</option>
                <option value={3}>Auditorium 3 (ScreenX)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Rows ({rowCount})
                </label>
                <input
                  type="number"
                  min={3}
                  max={14}
                  value={rowCount}
                  onChange={(e) => setRowCount(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] p-2.5 font-bold text-[#1B1320]"
                  data-testid="input-row-count"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Seats Per Row ({seatsPerRow})
                </label>
                <input
                  type="number"
                  min={6}
                  max={24}
                  value={seatsPerRow}
                  onChange={(e) => setSeatsPerRow(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] p-2.5 font-bold text-[#1B1320]"
                  data-testid="designer-seats-per-row-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Aisle Columns (eg. 3, 7)
                </label>
                <input
                  type="text"
                  value={aislesInput}
                  onChange={(e) => setAislesInput(e.target.value)}
                  className="w-full rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] p-2.5 font-bold text-[#1B1320]"
                  data-testid="designer-aisles-input"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Aisle Width (Meters)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.8"
                  max="2.5"
                  value={aisleWidthM}
                  onChange={(e) => setAisleWidthM(Number(e.target.value))}
                  className="w-full rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] p-2.5 font-bold text-[#1B1320]"
                  data-testid="input-aisle-width"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Numbering Direction
                </label>
                <select
                  value={numberingDirection}
                  onChange={(e) => setNumberingDirection(e.target.value as any)}
                  className="w-full rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] p-2.5 font-bold text-[#1B1320]"
                  data-testid="select-numbering-direction"
                >
                  <option value="LEFT_TO_RIGHT">Left to Right (Seat 01 on Left)</option>
                  <option value="RIGHT_TO_LEFT">Right to Left</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Screen Geometry
                </label>
                <select
                  value={screenSize}
                  onChange={(e) => setScreenSize(e.target.value)}
                  className="w-full rounded-xl border border-[#E6DCD2] bg-[#FAF6F0] p-2.5 font-bold text-[#1B1320]"
                  data-testid="select-screen-geometry"
                >
                  <option value="CURVED_LARGE">Curved Panoramic Screen</option>
                  <option value="FLAT_STANDARD">Flat Standard Screen</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Accessible Seats (Wheelchair: {wheelchairSeats.join(', ')})
              </span>
              <p className="text-xs text-slate-500">
                Row A seats 1 & 2 are designated as level-access step-free wheelchair spaces.
              </p>
            </div>
          </div>

          {/* Validation Results Box */}
          <div data-testid="designer-validation-results">
            {validationErrors.length > 0 && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs space-y-1.5" data-testid="validation-errors-box">
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Validation Violations ({validationErrors.length})</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult && validationResult.is_valid && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2" data-testid="validation-success-box">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Layout passed validation successfully: {totalCapacity} seats, 0 unreachable seats, fire egress compliant.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Live 2D & 3D Visual Preview */}
        <div className="lg:col-span-7 rounded-3xl border border-[#E6DCD2] bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E6DCD2] pb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-[#C8102E]" />
              <span className="font-bold text-base text-[#1B1320]">Live Dynamic Seat Map Preview</span>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
              Total Capacity: {totalCapacity} Seats
            </span>
          </div>

          {/* Simulated Screen */}
          <div className="flex flex-col items-center justify-center pt-2">
            <div className="w-3/4 h-3 bg-gradient-to-r from-rose-200 via-rose-500 to-rose-200 rounded-full shadow-sm" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              THEATRE SCREEN ({screenSize})
            </span>
          </div>

          {/* Seat Grid Preview */}
          <div className="p-4 rounded-2xl bg-[#FFF8F1] border border-[#E6DCD2] overflow-x-auto">
            <div className="min-w-max mx-auto space-y-2 py-2 flex flex-col items-center">
              {rowLetters.slice().reverse().map((row) => (
                <div key={row} className="flex items-center gap-1.5">
                  <span className="w-6 text-center text-xs font-black text-slate-400">{row}</span>
                  <div className="flex items-center">
                    {Array.from({ length: seatsPerRow }).map((_, idx) => {
                      const num = numberingDirection === 'LEFT_TO_RIGHT' ? idx + 1 : seatsPerRow - idx;
                      const seatId = `${row}${num.toString().padStart(2, '0')}`;
                      const isWheelchair = wheelchairSeats.includes(seatId);
                      const isComp = companionSeats.includes(seatId);
                      const hasAisle = aisles.includes(num);

                      return (
                        <div
                          key={seatId}
                          className={`flex items-center justify-center p-0.5 ${hasAisle ? 'mr-4' : ''}`}
                        >
                          <div
                            className={`h-7 w-7 rounded-lg text-[10px] font-bold flex items-center justify-center border shadow-2xs ${
                              isWheelchair
                                ? 'bg-blue-600 text-white border-blue-700'
                                : isComp
                                ? 'bg-purple-600 text-white border-purple-700'
                                : ['H', 'I', 'J'].includes(row)
                                ? 'bg-rose-100 text-[#9F1239] border-rose-300'
                                : ['A', 'B', 'C'].includes(row)
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-white text-slate-700 border-slate-300'
                            }`}
                            title={`Seat ${seatId}`}
                          >
                            {isWheelchair ? '♿' : isComp ? 'C' : num}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <span className="w-6 text-center text-xs font-black text-slate-400">{row}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
