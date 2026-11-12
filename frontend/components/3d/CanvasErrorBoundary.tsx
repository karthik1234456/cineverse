'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onFallbackTo2D?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CineVerse 3D Canvas Error Boundary caught an error:', error, errorInfo);
  }

  private handleBackToSeatMap = () => {
    if (this.props.onFallbackTo2D) {
      this.props.onFallbackTo2D();
      return;
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', '2d');
      window.location.href = url.toString();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          data-testid="canvas-error-boundary-fallback"
          aria-live="assertive"
          className="flex h-[100dvh] w-full flex-col items-center justify-center bg-[#07080a] px-4 text-center text-white"
        >
          <div className="max-w-md rounded-2xl border border-rose-900/40 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-bold tracking-tight text-white">
              Unable to load the 3D auditorium view
            </h2>
            <p className="mb-6 text-sm text-slate-400">
              Your browser or graphics hardware encountered an issue rendering the 3D theatre. You can continue booking seamlessly using the interactive 2D seat map.
            </p>
            {this.state.error && process.env.NODE_ENV !== 'production' && (
              <pre className="mb-6 max-h-32 overflow-auto rounded bg-black/60 p-2 text-left font-mono text-xs text-rose-300">
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleBackToSeatMap}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-red-600 to-rose-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/30 transition-all hover:from-red-500 hover:to-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Back to seat map
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
