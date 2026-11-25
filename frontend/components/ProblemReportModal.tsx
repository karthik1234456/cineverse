'use client';

import React, { useState, useEffect } from 'react';
import { collectDiagnosticData, DiagnosticSnapshot } from '../lib/telemetryBuffer';

interface ProblemReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: string;
  initialSeats?: string[];
  initialMetrics?: { fps?: number; frameTimeMs?: number; qualityTier?: string };
}

export default function ProblemReportModal({
  isOpen,
  onClose,
  initialMode,
  initialSeats,
  initialMetrics,
}: ProblemReportModalProps) {
  const [description, setDescription] = useState('');
  const [expected, setExpected] = useState('');
  const [snapshot, setSnapshot] = useState<DiagnosticSnapshot | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDescription('');
      setExpected('');
      setSubmitSuccess(false);
      setErrorMsg(null);
      setIsCapturing(true);

      // Collect telemetry snapshot on modal opening
      collectDiagnosticData({
        mode: initialMode,
        selectedSeats: initialSeats,
        renderMetrics: initialMetrics,
      })
        .then((data) => {
          setSnapshot(data);
          setIsCapturing(false);
        })
        .catch((err) => {
          console.error('Failed to collect diagnostics:', err);
          setIsCapturing(false);
        });
    }
  }, [isOpen, initialMode, initialSeats, initialMetrics]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Please describe what happened.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        user_description: description.trim(),
        expected_behavior: expected.trim() || undefined,
        screenshot_base64: snapshot?.screenshotBase64,
        url: snapshot?.url || window.location.href,
        route: snapshot?.route || window.location.pathname,
        query_params: snapshot?.queryParams || {},
        build_stamp: snapshot?.buildStamp || 'git:cineverse',
        auditorium_id: snapshot?.auditoriumId,
        showtime_id: snapshot?.showtimeId,
        cinema_id: snapshot?.cinemaId,
        mode: snapshot?.mode,
        selected_seats: snapshot?.selectedSeats,
        console_logs: snapshot?.consoleLogs || [],
        network_requests: snapshot?.networkRequests || [],
        browser_info: snapshot?.browserInfo || {},
        render_metrics: snapshot?.renderMetrics || {},
      };

      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error (${res.status})`);
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit problem report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-2xl bg-[#11141c] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900/60 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <div>
              <h2 id="report-modal-title" className="text-lg font-bold text-white tracking-wide">
                Report a Problem
              </h2>
              <p className="text-xs text-slate-400">
                1-tap diagnostic capture • automatically sanitized
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        {submitSuccess ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">Problem Report Submitted</h3>
            <p className="text-sm text-slate-400 max-w-md">
              Thank you! Our engineering team and automated diagnostic agents have received your report with full environment telemetry.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-red-200 text-sm">
                {errorMsg}
              </div>
            )}

            {/* Description */}
            <div>
              <label htmlFor="issue-desc" className="block text-sm font-semibold text-slate-200 mb-1">
                What went wrong? <span className="text-red-400">*</span>
              </label>
              <textarea
                id="issue-desc"
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="E.g., In walk mode, row F seats clipped through the aisle floor, or the audio stopped playing..."
                className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
              />
            </div>

            {/* Expected Behavior */}
            <div>
              <label htmlFor="expected-desc" className="block text-sm font-medium text-slate-300 mb-1">
                What did you expect to happen? <span className="text-xs text-slate-500">(optional)</span>
              </label>
              <input
                id="expected-desc"
                type="text"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                placeholder="E.g., The trailer volume slider should stay muted when clicked."
                className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
              />
            </div>

            {/* Telemetry pill badges */}
            <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Captured Context ({isCapturing ? 'Analyzing...' : 'Ready'})
                </span>
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-cyan-400 hover:text-cyan-300 underline"
                >
                  {showDetails ? 'Hide technical details' : 'View technical details'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {snapshot?.route && (
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                    Route: <strong className="text-white">{snapshot.route}</strong>
                  </span>
                )}
                {snapshot?.mode && (
                  <span className="px-2 py-0.5 bg-cyan-950/60 text-cyan-300 rounded border border-cyan-800/60">
                    Mode: <strong className="text-cyan-200 uppercase">{snapshot.mode}</strong>
                  </span>
                )}
                {snapshot?.auditoriumId && (
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                    Hall #{snapshot.auditoriumId}
                  </span>
                )}
                {snapshot?.showtimeId && (
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                    Showtime #{snapshot.showtimeId}
                  </span>
                )}
                {snapshot?.selectedSeats && snapshot.selectedSeats.length > 0 && (
                  <span className="px-2 py-0.5 bg-purple-950/60 text-purple-300 rounded border border-purple-800/60">
                    Seats: {snapshot.selectedSeats.join(', ')}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
                  Logs: {snapshot?.consoleLogs?.length || 0} msgs
                </span>
                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700">
                  Network: {snapshot?.networkRequests?.length || 0} issues
                </span>
              </div>

              {/* Screenshot thumbnail preview */}
              {snapshot?.screenshotBase64 && (
                <div className="mt-2 flex items-center gap-3 pt-2 border-t border-slate-800">
                  <div className="relative w-28 h-16 rounded border border-slate-700 overflow-hidden bg-black flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={snapshot.screenshotBase64}
                      alt="Canvas capture preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-xs text-slate-400">
                    <p className="text-slate-300 font-medium">3D Canvas / Viewport Snapshot</p>
                    <p className="text-[11px] text-slate-500">
                      Captured live state with camera position and rendered geometry.
                    </p>
                  </div>
                </div>
              )}

              {/* Technical expandable details */}
              {showDetails && snapshot && (
                <div className="mt-3 pt-3 border-t border-slate-800 space-y-2 text-xs font-mono text-slate-300">
                  <div>
                    <span className="text-slate-500">Build: </span>
                    <span>{snapshot.buildStamp}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Viewport: </span>
                    <span>
                      {snapshot.browserInfo.viewportWidth}x{snapshot.browserInfo.viewportHeight} (DPR {snapshot.browserInfo.devicePixelRatio})
                    </span>
                  </div>
                  {snapshot.renderMetrics?.qualityTier && (
                    <div>
                      <span className="text-slate-500">Quality Tier: </span>
                      <span>{snapshot.renderMetrics.qualityTier}</span>
                    </div>
                  )}
                  {snapshot.consoleLogs.length > 0 && (
                    <div>
                      <span className="text-slate-500 block mb-1">Recent Console Logs (Sanitized):</span>
                      <div className="max-h-24 overflow-y-auto bg-black/60 p-2 rounded border border-slate-800 space-y-1">
                        {snapshot.consoleLogs.slice(-8).map((log, i) => (
                          <div
                            key={i}
                            className={`text-[11px] ${
                              log.level === 'error'
                                ? 'text-red-400'
                                : log.level === 'warn'
                                ? 'text-amber-400'
                                : 'text-slate-400'
                            }`}
                          >
                            [{log.level.toUpperCase()}] {log.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Privacy notice */}
            <p className="text-[11px] text-slate-500 leading-tight">
              🔒 <strong>Privacy Assurance:</strong> Authentication tokens, cookies, passwords, and personal details are automatically redacted on device before submission.
            </p>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCapturing}
                className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 rounded-lg shadow-lg shadow-cyan-900/30 transition flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

