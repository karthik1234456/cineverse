'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Upload, Box, Layers, AlertCircle, CheckCircle2,
  RotateCcw, Sparkles, ShieldCheck, ArrowRight, RefreshCw, FileText
} from 'lucide-react';
import {
  validateGLB, publishTheatreAsset, getAssetVersions,
  rollbackAssetVersion, optimizeTheatreAsset
} from '@/services/api';

export default function AuditoriumOnboardingPage() {
  const [selectedAuditoriumId, setSelectedAuditoriumId] = useState<number>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationReport, setValidationReport] = useState<any | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [versionLabel, setVersionLabel] = useState<string>('2.1');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  const [versions, setVersions] = useState<any[]>([]);
  const [optimizationStats, setOptimizationStats] = useState<any | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);

  useEffect(() => {
    loadVersions(selectedAuditoriumId);
  }, [selectedAuditoriumId]);

  async function loadVersions(audiId: number) {
    try {
      const res = await getAssetVersions(audiId);
      setVersions(res.versions || []);
    } catch {
      // ignore
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setValidationReport(null);
      setValidationError(null);
      setPublishSuccess(null);

      // Trigger automatic validation
      setIsValidating(true);
      try {
        const res = await validateGLB(file);
        setValidationReport(res.report);
      } catch (err: any) {
        setValidationError(err.message || 'GLB validation failed');
      } finally {
        setIsValidating(false);
      }
    }
  }

  async function handlePublish() {
    if (!validationReport?.seat_layout) return;
    setIsPublishing(true);
    setPublishSuccess(null);
    try {
      const res = await publishTheatreAsset(selectedAuditoriumId, versionLabel, validationReport.seat_layout);
      setPublishSuccess(`Asset published successfully as version ${versionLabel}!`);
      loadVersions(selectedAuditoriumId);
    } catch (err: any) {
      setValidationError(err.message || 'Publish failed');
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleRollback(versionId: number) {
    try {
      await rollbackAssetVersion(selectedAuditoriumId, versionId);
      loadVersions(selectedAuditoriumId);
      alert('Rollback successful! The selected version is now active.');
    } catch (err: any) {
      alert(`Rollback failed: ${err.message}`);
    }
  }

  async function handleOptimize() {
    setIsOptimizing(true);
    try {
      const res = await optimizeTheatreAsset(selectedAuditoriumId);
      setOptimizationStats(res);
    } catch (err: any) {
      alert(`Optimization failed: ${err.message}`);
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 w-full text-white space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold text-red-400 mb-2 border border-red-500/30">
            <Box className="h-3.5 w-3.5" />
            <span>VENUE OPERATIONS</span>
          </div>
          <h1 className="text-3xl font-black text-white">Auditorium Onboarding & Asset Pipeline</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Automated GLB coordinate convention detection, seat layout extraction, defect analysis, and version management
          </p>
        </div>

        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/10 transition"
        >
          <span>Executive Dashboard</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Main Grid: Upload & Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Upload & Auditorium Target */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-2xl border border-white/10 bg-[#12131a] p-6 space-y-5">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <Layers className="h-4 w-4 text-red-500" />
              <span>Target Screen</span>
            </h2>

            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Select Auditorium</label>
              <select
                id="auditorium-selector"
                value={selectedAuditoriumId}
                onChange={(e) => setSelectedAuditoriumId(Number(e.target.value))}
                className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
              >
                <option value={1}>Auditorium 1 — 3D Laser IMAX (Koramangala)</option>
                <option value={2}>Auditorium 2 — 2D Dolby Atmos (Orion Mall)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">Release Version Label</label>
              <input
                id="version-label-input"
                type="text"
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="e.g. 2.1"
                className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500 font-mono"
              />
            </div>

            {/* Drag & Drop File Upload */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 block">3D Auditorium Model (.glb)</label>
              <label
                htmlFor="glb-upload"
                className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 hover:border-red-500/50 rounded-2xl p-6 text-center cursor-pointer bg-white/5 transition group"
              >
                <Upload className="h-8 w-8 text-zinc-400 group-hover:text-red-500 transition mb-2" />
                <span className="text-xs font-bold text-white block">
                  {selectedFile ? selectedFile.name : 'Select or drop GLB model'}
                </span>
                <span className="text-[10px] text-zinc-400 mt-1 block">Binary glTF 2.0 (up to 50MB)</span>
                <input
                  id="glb-upload"
                  type="file"
                  accept=".glb"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>

            {isValidating && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/20 p-3 rounded-xl border border-red-500/20">
                <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
                <span>Running automated pipeline & defect inspection...</span>
              </div>
            )}

            {validationError && (
              <div className="text-xs text-red-400 bg-red-950/20 p-3 rounded-xl border border-red-500/20">
                {validationError}
              </div>
            )}

            {publishSuccess && (
              <div className="text-xs text-emerald-400 bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/20">
                {publishSuccess}
              </div>
            )}

            {validationReport && validationReport.validation_status !== 'REJECTED' && (
              <button
                id="btn-publish-layout"
                onClick={handlePublish}
                disabled={isPublishing}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2.5 text-xs font-bold text-white transition"
              >
                {isPublishing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Publishing Asset Version...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Publish & Deploy Layout</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Web Optimization Card */}
          <div className="rounded-2xl border border-white/10 bg-[#12131a] p-6 space-y-4">
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>Asset Optimization (.web.glb)</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Generate web-optimized lightweight mesh with Draco geometry compression and LOD tuning.
            </p>

            <button
              id="btn-optimize"
              onClick={handleOptimize}
              disabled={isOptimizing}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-50 px-4 py-2 text-xs font-bold text-white transition"
            >
              {isOptimizing ? 'Compressing Mesh...' : 'Trigger Web Optimization'}
            </button>

            {optimizationStats && (
              <div id="optimization-metrics" className="rounded-xl bg-black/40 p-3 text-xs space-y-1.5 border border-white/5 font-mono">
                <div className="flex justify-between text-zinc-400">
                  <span>Triangle Reduction</span>
                  <span className="text-emerald-400 font-bold">
                    {optimizationStats.improvements?.triangle_reduction_percentage != null
                      ? `${Number(optimizationStats.improvements.triangle_reduction_percentage).toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Optimized Triangles</span>
                  <span className="text-white font-bold">
                    {optimizationStats.after?.triangles?.toLocaleString?.() ?? 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Web Asset</span>
                  <span className="text-zinc-300">{optimizationStats.optimized_glb_path}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Columns: Inspection Report & Version History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Inspection Report */}
          <div className="rounded-2xl border border-white/10 bg-[#12131a] p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-red-500" />
                <span>Automated Validation Report</span>
              </h2>

              {validationReport && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  validationReport.validation_status === 'VALID'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : validationReport.validation_status === 'WARNINGS'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {validationReport.validation_status}
                </span>
              )}
            </div>

            {!validationReport ? (
              <div className="p-8 text-center text-xs text-zinc-500 space-y-2">
                <Box className="h-8 w-8 mx-auto text-zinc-600" />
                <p>Upload a GLB model to inspect coordinate space, extracted seat geometry, and defect checklist.</p>
              </div>
            ) : (
              <div id="validation-report-content" className="space-y-4 text-xs">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-black/40 p-3 border border-white/5">
                    <span className="text-zinc-500 text-[10px] block">CONVENTION</span>
                    <span className="font-bold text-white font-mono">{validationReport.coordinate_info?.convention || 'glTF_Y_UP'}</span>
                  </div>
                  <div className="rounded-xl bg-black/40 p-3 border border-white/5">
                    <span className="text-zinc-500 text-[10px] block">DETECTED SEATS</span>
                    <span className="font-bold text-emerald-400 font-mono">{validationReport.mesh_metrics?.seat_count ?? 0} seats</span>
                  </div>
                  <div className="rounded-xl bg-black/40 p-3 border border-white/5">
                    <span className="text-zinc-500 text-[10px] block">TRIANGLES</span>
                    <span className="font-bold text-white font-mono">
                      {validationReport.mesh_metrics?.triangle_count?.toLocaleString?.() ?? '0'}
                    </span>
                  </div>
                  <div className="rounded-xl bg-black/40 p-3 border border-white/5">
                    <span className="text-zinc-500 text-[10px] block">SCREEN DETECTED</span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {validationReport.mesh_metrics?.screen_center ? 'YES' : 'NO'}
                    </span>
                  </div>
                </div>

                {/* Coordinate Info Banner */}
                <div className="rounded-xl bg-white/5 p-3.5 border border-white/10 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-zinc-200">
                    <ShieldCheck className="h-4 w-4 text-red-400" />
                    <span>Coordinate Transformation Details</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Source: <code className="text-zinc-200">{validationReport.coordinate_info?.convention}</code> → Target Standard: <code className="text-zinc-200">{validationReport.coordinate_info?.target_space}</code>. Transform applied: <span className="text-zinc-300">{validationReport.coordinate_info?.applied_transform}</span>
                  </p>
                </div>

                {/* Seat Rows Breakdown */}
                <div className="space-y-2">
                  <h3 className="font-bold text-zinc-300">Extracted Seat Rows & Categories</h3>
                  <div className="rounded-xl bg-black/40 p-3 border border-white/5 max-h-48 overflow-y-auto space-y-1 font-mono text-[11px]">
                    {validationReport.seat_layout?.seats?.slice(0, 10).map((s: any) => (
                      <div key={s.seat_id} className="flex justify-between border-b border-white/5 py-0.5">
                        <span className="text-zinc-300">{s.seat_id} ({s.category})</span>
                        <span className="text-zinc-500">
                          Eye: [{Array.isArray(s.eye_position_gltf_y_up) ? s.eye_position_gltf_y_up.map((n: number) => Number(n).toFixed(2)).join(', ') : '0, 0, 0'}]
                        </span>
                        <span className="text-zinc-400">{s.screen_distance != null ? `${Number(s.screen_distance).toFixed(1)}m` : '-'}</span>
                      </div>
                    ))}
                    {(validationReport.seat_layout?.seats?.length || 0) > 10 && (
                      <div className="text-center text-zinc-500 pt-1">
                        ... and {validationReport.seat_layout.seats.length - 10} more seats extracted.
                      </div>
                    )}
                  </div>
                </div>

                {/* Defect Warnings & Errors */}
                {validationReport.errors?.length > 0 && (
                  <div className="rounded-xl bg-red-950/20 border border-red-500/30 p-3 space-y-1">
                    <span className="font-bold text-red-300 block">Critical Defects Detected</span>
                    {validationReport.errors.map((e: string, idx: number) => (
                      <div key={idx} className="text-red-400 text-[11px]">• {e}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Version History & Rollback */}
          <div className="rounded-2xl border border-white/10 bg-[#12131a] p-6 space-y-4">
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-red-500" />
              <span>Versioned Theatre Assets & Rollback</span>
            </h2>

            {versions.length === 0 ? (
              <p className="text-xs text-zinc-500">No asset versions recorded for this auditorium.</p>
            ) : (
              <div id="versions-list" className="space-y-2">
                {versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="rounded-xl bg-black/40 border border-white/5 p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">Version {ver.version}</span>
                        {ver.is_active && (
                          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        Triangles: {ver.total_triangles?.toLocaleString()} • Coordinate: {ver.coordinate_convention}
                      </p>
                    </div>

                    {!ver.is_active && (
                      <button
                        onClick={() => handleRollback(ver.id)}
                        className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition"
                      >
                        Rollback to v{ver.version}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
