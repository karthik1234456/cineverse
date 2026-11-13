/**
 * telemetryBuffer.ts
 *
 * In-memory telemetry buffer capturing:
 * - Last 50 console messages (log, warn, error, info)
 * - Last 20 failed or slow network requests (status >= 400 or duration >= 1500ms)
 * - Secrets & PII scrubbing (Bearer tokens, cookies, auth headers, email, cc, passwords)
 * - Page screenshot capture including WebGL 3D Canvas
 * - Diagnostics collector
 */

export interface ConsoleEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
}

export interface NetworkEntry {
  timestamp: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
  statusText?: string;
}

export interface DiagnosticSnapshot {
  url: string;
  route: string;
  queryParams: Record<string, any>;
  buildStamp: string;
  auditoriumId?: string;
  showtimeId?: number;
  cinemaId?: number;
  mode?: string;
  selectedSeats?: string[];
  consoleLogs: ConsoleEntry[];
  networkRequests: NetworkEntry[];
  browserInfo: {
    userAgent: string;
    language: string;
    viewportWidth: number;
    viewportHeight: number;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
    colorDepth: number;
  };
  renderMetrics?: {
    fps?: number;
    frameTimeMs?: number;
    qualityTier?: string;
    canvasWidth?: number;
    canvasHeight?: number;
  };
  screenshotBase64?: string;
}

// Secret scrubbing patterns (client-side first line of defense)
const JWT_REGEX = /Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const HEX_KEY_REGEX = /\b[a-fA-F0-9]{32}\b/g;
const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
const CREDIT_CARD_REGEX = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
const AUTH_HEADER_PARAM = /(authorization|token|password|secret|cookie|session_id)=([^&\s]+)/gi;

export function scrubString(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(JWT_REGEX, 'Bearer [REDACTED_TOKEN]')
    .replace(HEX_KEY_REGEX, '[REDACTED_KEY]')
    .replace(CREDIT_CARD_REGEX, '[REDACTED_CARD]')
    .replace(EMAIL_REGEX, '[REDACTED_EMAIL]')
    .replace(AUTH_HEADER_PARAM, '$1=[REDACTED]');
}

// In-memory ring buffers
const MAX_CONSOLE_LOGS = 50;
const MAX_NETWORK_LOGS = 20;

const consoleBuffer: ConsoleEntry[] = [];
const networkBuffer: NetworkEntry[] = [];

let isInitialized = false;

export function initTelemetryBuffer(): void {
  if (typeof window === 'undefined' || isInitialized) return;
  isInitialized = true;

  // 1. Console interceptors
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  const pushConsole = (level: ConsoleEntry['level'], args: any[]) => {
    try {
      const serialized = args
        .map((arg) => {
          if (typeof arg === 'string') return arg;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(' ');

      const scrubbed = scrubString(serialized);
      consoleBuffer.push({
        timestamp: new Date().toISOString(),
        level,
        message: scrubbed.slice(0, 1000), // Max 1000 chars per line
      });

      if (consoleBuffer.length > MAX_CONSOLE_LOGS) {
        consoleBuffer.shift();
      }
    } catch {
      // Don't crash on console capture errors
    }
  };

  console.log = (...args: any[]) => {
    pushConsole('log', args);
    originalLog.apply(console, args);
  };
  console.warn = (...args: any[]) => {
    pushConsole('warn', args);
    originalWarn.apply(console, args);
  };
  console.error = (...args: any[]) => {
    pushConsole('error', args);
    originalError.apply(console, args);
  };
  console.info = (...args: any[]) => {
    pushConsole('info', args);
    originalInfo.apply(console, args);
  };

  // 2. Network interceptor (fetch proxy)
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const startTime = performance.now();
      const input = args[0];
      const init = args[1];

      let method = 'GET';
      let urlStr = '';

      if (typeof input === 'string') {
        urlStr = input;
      } else if (input instanceof URL) {
        urlStr = input.toString();
      } else if (input && typeof input === 'object' && 'url' in input) {
        urlStr = (input as Request).url;
        method = (input as Request).method || 'GET';
      }

      if (init?.method) {
        method = init.method.toUpperCase();
      }

      // Do not log report submission requests to avoid loop
      const isReportApi = urlStr.includes('/api/v1/reports');

      try {
        const response = await originalFetch(...args);
        const durationMs = Math.round(performance.now() - startTime);

        if (!isReportApi && (response.status >= 400 || durationMs >= 1500)) {
          networkBuffer.push({
            timestamp: new Date().toISOString(),
            method,
            url: scrubString(urlStr),
            status: response.status,
            statusText: response.statusText,
            durationMs,
          });
          if (networkBuffer.length > MAX_NETWORK_LOGS) {
            networkBuffer.shift();
          }
        }
        return response;
      } catch (err: any) {
        const durationMs = Math.round(performance.now() - startTime);
        if (!isReportApi) {
          networkBuffer.push({
            timestamp: new Date().toISOString(),
            method,
            url: scrubString(urlStr),
            status: 0,
            statusText: err?.message || 'NetworkError',
            durationMs,
          });
          if (networkBuffer.length > MAX_NETWORK_LOGS) {
            networkBuffer.shift();
          }
        }
        throw err;
      }
    };
  }
}

/**
 * Captures screenshot of current view, prioritizing the 3D WebGL Canvas.
 */
export async function capturePageScreenshot(): Promise<string | undefined> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

  try {
    // 1. Look for WebGL / Three.js Canvas
    const canvases = Array.from(document.querySelectorAll('canvas'));
    const webglCanvas = canvases.find((c) => {
      const rect = c.getBoundingClientRect();
      return rect.width > 200 && rect.height > 200;
    }) || canvases[0];

    if (webglCanvas) {
      // Create an offscreen canvas to scale down if large, and ensure standard JPEG
      const targetWidth = Math.min(webglCanvas.width || 1280, 1280);
      const scale = targetWidth / (webglCanvas.width || 1280);
      const targetHeight = Math.round((webglCanvas.height || 720) * scale);

      const offscreen = document.createElement('canvas');
      offscreen.width = targetWidth;
      offscreen.height = targetHeight;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        // Draw background
        ctx.fillStyle = '#0a0b0e';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        try {
          ctx.drawImage(webglCanvas, 0, 0, targetWidth, targetHeight);
        } catch {
          // Cross-origin / tainted canvas fallback
        }
        return offscreen.toDataURL('image/jpeg', 0.85);
      }
      return webglCanvas.toDataURL('image/jpeg', 0.85);
    }

    // 2. Fallback: Draw synthetic representation of page layout
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 800;
    fallbackCanvas.height = 450;
    const ctx = fallbackCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, 800, 450);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('CineVerse Diagnostic Snapshot', 40, 60);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px monospace';
      ctx.fillText(`URL: ${window.location.pathname}${window.location.search}`, 40, 110);
      ctx.fillText(`Viewport: ${window.innerWidth}x${window.innerHeight}`, 40, 140);
      ctx.fillText(`Time: ${new Date().toISOString()}`, 40, 170);
      ctx.fillText(`User Agent: ${navigator.userAgent.slice(0, 60)}...`, 40, 200);

      ctx.fillStyle = '#334155';
      ctx.fillRect(40, 240, 720, 160);
      ctx.fillStyle = '#f1f5f9';
      ctx.font = '14px sans-serif';
      ctx.fillText('2D Page View Snapshot (Standard DOM page - no WebGL canvas detected)', 60, 320);

      return fallbackCanvas.toDataURL('image/jpeg', 0.85);
    }
  } catch (err) {
    console.error('Failed to capture page screenshot:', err);
  }
  return undefined;
}

/**
 * Collects complete diagnostic snapshot for problem report.
 */
export async function collectDiagnosticData(params?: {
  mode?: string;
  selectedSeats?: string[];
  renderMetrics?: { fps?: number; frameTimeMs?: number; qualityTier?: string };
}): Promise<DiagnosticSnapshot> {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  
  // Parse query params
  const queryParams: Record<string, any> = {};
  if (typeof window !== 'undefined' && window.location.search) {
    const searchParams = new URLSearchParams(window.location.search);
    searchParams.forEach((val, key) => {
      // Don't keep sensitive token in query params
      if (/token|auth|secret|key/i.test(key)) {
        queryParams[key] = '[REDACTED]';
      } else {
        queryParams[key] = val;
      }
    });
  }

  // Parse path IDs (e.g. /cinemas/2/auditorium/5)
  const cinemaMatch = pathname.match(/\/cinemas\/(\d+)/);
  const audMatch = pathname.match(/\/auditorium\/([^\/?#]+)/);
  const cinemaId = cinemaMatch ? parseInt(cinemaMatch[1], 10) : undefined;
  const auditoriumId = audMatch ? audMatch[1] : undefined;
  const showtimeId = queryParams.showtime ? parseInt(queryParams.showtime, 10) : undefined;

  // Active mode from parameter or query param
  const activeMode = params?.mode || queryParams.mode || (pathname.includes('/auditorium/') ? 'overview' : undefined);

  // Selected seats from params or local storage or window
  let selectedSeats = params?.selectedSeats;
  if (!selectedSeats && typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('cineverse_selected_seats');
      if (stored) selectedSeats = JSON.parse(stored);
    } catch {
      // ignore
    }
  }

  // Capture screenshot
  const screenshotBase64 = await capturePageScreenshot();

  const buildStamp = process.env.NEXT_PUBLIC_BUILD_STAMP || 'git:cineverse-prod | built:2026-11-13 UTC';

  return {
    url: scrubString(url),
    route: pathname,
    queryParams,
    buildStamp,
    auditoriumId,
    showtimeId,
    cinemaId,
    mode: activeMode,
    selectedSeats,
    consoleLogs: [...consoleBuffer],
    networkRequests: [...networkBuffer],
    browserInfo: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      language: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1280,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 720,
      screenWidth: typeof window !== 'undefined' ? window.screen?.width || 1920 : 1920,
      screenHeight: typeof window !== 'undefined' ? window.screen?.height || 1080 : 1080,
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
      colorDepth: typeof window !== 'undefined' ? window.screen?.colorDepth || 24 : 24,
    },
    renderMetrics: {
      fps: params?.renderMetrics?.fps,
      frameTimeMs: params?.renderMetrics?.frameTimeMs,
      qualityTier: params?.renderMetrics?.qualityTier,
      canvasWidth: typeof document !== 'undefined' ? document.querySelector('canvas')?.width : undefined,
      canvasHeight: typeof document !== 'undefined' ? document.querySelector('canvas')?.height : undefined,
    },
    screenshotBase64,
  };
}

