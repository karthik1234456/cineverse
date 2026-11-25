'use client';

import React, { useState, useEffect } from 'react';
import {
  QrCode, CheckCircle2, AlertTriangle, XCircle,
  Search, RefreshCw, Smartphone, ShieldCheck, ArrowRight,
  Wifi, WifiOff
} from 'lucide-react';
import {
  scanTicket, lookupTicket, registerStaffDevice,
  type StaffScanResponse
} from '@/services/api';

export default function StaffScanPwaPage() {
  const [deviceId, setDeviceId] = useState<string>('');
  const [gate, setGate] = useState<string>('Gate 1 - Main Turnstile');
  const [qrInput, setQrInput] = useState<string>('');
  const [lookupCode, setLookupCode] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<StaffScanResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<any | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<Array<{ qr: string; timestamp: string }>>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Initialize device registration
  useEffect(() => {
    let savedDevId = localStorage.getItem('cineverse_staff_device_id');
    if (!savedDevId) {
      savedDevId = 'DEV-' + Math.random().toString(36).substring(2, 9).toUpperCase();
      localStorage.setItem('cineverse_staff_device_id', savedDevId);
      registerStaffDevice(gate, 'Turnstile Scanner 1').catch(() => {});
    }
    setDeviceId(savedDevId);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [gate]);

  async function handleScanSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!qrInput.trim()) return;

    setIsScanning(true);
    setErrorMessage(null);
    setErrorType(null);
    setScanResult(null);

    if (!navigator.onLine) {
      // Store in offline queue
      const queued = [...offlineQueue, { qr: qrInput.trim(), timestamp: new Date().toISOString() }];
      setOfflineQueue(queued);
      localStorage.setItem('cineverse_offline_scans', JSON.stringify(queued));
      setErrorMessage('Offline mode: Scan queued for automatic synchronization.');
      setErrorType('OFFLINE_QUEUED');
      setIsScanning(false);
      return;
    }

    try {
      const res = await scanTicket(qrInput.trim(), gate, deviceId);
      setScanResult(res);
      setQrInput('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Ticket validation failed');
      if (err.message.includes('ALREADY_USED')) {
        setErrorType('ALREADY_USED');
      } else if (err.message.includes('INVALID_HMAC')) {
        setErrorType('FORGED_SIGNATURE');
      } else {
        setErrorType('ERROR');
      }
    } finally {
      setIsScanning(false);
    }
  }

  async function handleManualLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupCode.trim()) return;

    try {
      const res = await lookupTicket(lookupCode.trim());
      setLookupResult(res);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lookup failed');
      setLookupResult(null);
    }
  }

  return (
    <div className="mx-auto max-w-md min-h-screen px-4 py-6 text-white space-y-6 flex flex-col justify-between">
      {/* PWA Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white leading-tight">Turnstile Scanner</h1>
              <p className="text-[11px] text-zinc-400">Staff Entry Access Point</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
            </span>
          </div>
        </div>

        {/* Device & Gate Info */}
        <div className="rounded-xl bg-[#12131a] p-3 border border-white/10 text-xs flex justify-between items-center text-zinc-300">
          <div>
            <span className="text-zinc-500 block text-[10px]">CURRENT GATE</span>
            <span className="font-semibold text-white">{gate}</span>
          </div>
          <div className="text-right">
            <span className="text-zinc-500 block text-[10px]">DEVICE ID</span>
            <span className="font-mono text-zinc-400">{deviceId || 'DEV-ACTIVE'}</span>
          </div>
        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="space-y-4 flex-1">
        {/* Scanner Simulation Card */}
        <div className="rounded-2xl border border-white/10 bg-[#161822] p-5 space-y-4 shadow-xl">
          <div className="text-center space-y-1">
            <div className="inline-flex p-3 rounded-full bg-white/5 border border-white/10 text-red-500 animate-pulse">
              <Smartphone className="h-6 w-6" />
            </div>
            <h2 className="text-sm font-bold text-white">Scan Digital Pass</h2>
            <p className="text-xs text-zinc-400">Present customer QR code to scan</p>
          </div>

          <form onSubmit={handleScanSubmit} className="space-y-3">
            <div>
              <input
                id="qr-input"
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Paste QR payload or raw ticket data..."
                className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 font-mono"
              />
            </div>

            <button
              id="btn-scan"
              type="submit"
              disabled={isScanning || !qrInput.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-3 text-sm font-bold text-white transition active:scale-[0.98]"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Validating Pass...</span>
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4" />
                  <span>Process Scan</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Scan Status Feedback */}
        {scanResult && (
          <div
            id="scan-success-card"
            data-testid="scan-success-card"
            role="alert"
            className="rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-5 space-y-3 animate-fadeIn"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-400 shrink-0" />
              <div>
                <h3 className="text-base font-black text-emerald-300">ENTRY GRANTED</h3>
                <p className="text-xs text-emerald-200/80">Valid single-use ticket verified</p>
              </div>
            </div>

            <div className="rounded-xl bg-black/40 p-3 space-y-1.5 text-xs border border-emerald-500/20">
              <div className="flex justify-between">
                <span className="text-zinc-400">Movie</span>
                <span className="font-semibold text-white">{scanResult.movie_title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Auditorium</span>
                <span className="font-semibold text-white">{scanResult.screen_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Seats</span>
                <span className="font-bold text-emerald-400">{scanResult.seats.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Admissions</span>
                <span className="font-bold text-white">{scanResult.total_admissions} Person(s)</span>
              </div>
            </div>
          </div>
        )}

        {errorMessage && (
          <div
            id="scan-error-card"
            data-testid="scan-error-card"
            role="alert"
            className="rounded-2xl border border-red-500/40 bg-red-950/20 p-5 space-y-3 animate-fadeIn"
          >
            <div className="flex items-center gap-3">
              {errorType === 'ALREADY_USED' ? (
                <AlertTriangle className="h-7 w-7 text-amber-400 shrink-0" />
              ) : (
                <XCircle className="h-7 w-7 text-red-400 shrink-0" />
              )}
              <div>
                <h3 className="text-base font-black text-red-300">
                  {errorType === 'ALREADY_USED' ? 'DUPLICATE SCAN DETECTED' : 'ENTRY REJECTED'}
                </h3>
                <p className="text-xs text-red-200/80">{errorMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Manual Lookup Accordion */}
        <div className="rounded-2xl border border-white/10 bg-[#12131a] p-4 space-y-3">
          <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-red-400" />
            <span>Manual Code Search</span>
          </h3>

          <form onSubmit={handleManualLookup} className="flex gap-2">
            <input
              id="lookup-input"
              type="text"
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value)}
              placeholder="e.g. CV-A1B2C3 or TKT-..."
              className="flex-1 rounded-xl bg-black/40 border border-white/15 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 font-mono"
            />
            <button
              id="btn-lookup"
              type="submit"
              className="rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-xs font-semibold text-white transition"
            >
              Lookup
            </button>
          </form>

          {lookupResult && (
            <div id="lookup-details" className="rounded-xl bg-black/40 p-3 text-xs space-y-1 border border-white/5">
              <div className="flex justify-between">
                <span className="text-zinc-400">Ticket No</span>
                <span className="font-mono text-white">{lookupResult.ticket_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Status</span>
                <span className={lookupResult.is_used ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {lookupResult.is_used ? 'USED' : 'ACTIVE'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Seats</span>
                <span className="text-white font-medium">{lookupResult.seats?.join(', ')}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-[10px] text-zinc-500 border-t border-white/5 pt-4">
        CineVerse Turnstile OS v2.4 • Offline-Tolerant Engine • Gate 1
      </div>
    </div>
  );
}
