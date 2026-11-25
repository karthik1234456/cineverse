// components/AuthModal.tsx
'use client';

import React, { useState } from 'react';
import { X, Lock, Mail, Phone, User, KeyRound, Sparkles, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { loginUser, registerUser, sendOtp, verifyOtp, forgotPassword, resetPassword } from '@/services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

function formatAuthError(err: any): string {
  if (err?.status === 401) return 'Invalid email/phone or password. Please try again.';
  if (err?.status === 403) return 'Account is locked or deactivated. Please contact support.';
  if (err?.status === 429) return 'Too many attempts. Please wait a few moments and try again.';
  if (err?.status >= 500) return 'Server error encountered. Please try again later.';
  if (err?.message?.includes('Network error') || err?.status === 0) return 'Network error. Unable to reach authentication server.';
  return err?.message || 'Authentication failed. Please check your details.';
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'otp' | 'forgot'>('login');
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await loginUser(emailOrPhone, password);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const isEmail = emailOrPhone.includes('@');
      const payload: any = {
        password,
        full_name: fullName,
      };
      if (isEmail) payload.email = emailOrPhone;
      else payload.phone = emailOrPhone;

      const res = await registerUser(payload);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp() {
    if (!phone) {
      setError('Please enter a phone number');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendOtp(phone);
      setOtpSent(true);
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await verifyOtp(phone, otp);
      onSuccess(res);
      onClose();
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setLoading(true);
    try {
      const res = await forgotPassword(emailOrPhone);
      setResetStep(2);
      setSuccessNotice(res.message || 'Reset code sent. Use 123456 for sandbox testing.');
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await resetPassword({
        emailOrPhone,
        tokenOrOtp: resetCode,
        newPassword,
      });
      setSuccessNotice(res.message || 'Password successfully updated.');
      setResetStep(1);
      setMode('login');
      setPassword(newPassword);
    } catch (err: any) {
      setError(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#16181f] p-6 shadow-2xl text-white">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white transition"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600/20 text-[#e50914]">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">CineVerse Account</h2>
            <p className="text-xs text-zinc-400">Unlock 3D seat booking & quick checkout</p>
          </div>
        </div>

        {/* Tab switch */}
        {mode !== 'forgot' && (
          <div className="flex rounded-xl bg-[#0f1014] p-1 mb-5 border border-white/5">
            <button
              onClick={() => { setMode('login'); setError(null); setSuccessNotice(null); }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                mode === 'login' ? 'bg-[#e50914] text-white shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Password Sign In
            </button>
            <button
              onClick={() => { setMode('otp'); setError(null); setSuccessNotice(null); }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                mode === 'otp' ? 'bg-[#e50914] text-white shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              OTP Login
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); setSuccessNotice(null); }}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                mode === 'register' ? 'bg-[#e50914] text-white shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {successNotice && (
          <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Form */}
        {mode === 'login' && (
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Email or Phone</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="patron@example.com / 9876543212"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0f1014] py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-[#e50914] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-300">Password</label>
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); setSuccessNotice(null); setResetStep(1); }}
                  className="text-[11px] text-[#e50914] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0f1014] py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-[#e50914] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#e50914] py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>

            <div className="text-center text-[11px] text-zinc-500">
              Demo patron: <span className="text-zinc-300">patron@example.com</span> / <span className="text-zinc-300">Patron@123</span>
            </div>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="Karthik R"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0f1014] py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-[#e50914] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Email or Phone</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  required
                  placeholder="user@example.com"
                  value={emailOrPhone}
                  onChange={(e) => setEmailOrPhone(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0f1014] py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-[#e50914] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Create Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0f1014] py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-[#e50914] focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#e50914] py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        {mode === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Mobile Phone Number</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#0f1014] py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-[#e50914] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || !phone}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-white hover:bg-white/10 transition disabled:opacity-50"
                >
                  {otpSent ? 'Resend' : 'Send OTP'}
                </button>
              </div>
            </div>

            {otpSent && (
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Enter 6-Digit OTP <span className="text-zinc-500">(Use 123456 for sandbox)</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="w-full tracking-widest text-center rounded-xl border border-white/10 bg-[#0f1014] py-2.5 text-lg font-bold text-white placeholder-zinc-700 focus:border-[#e50914] focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !otpSent}
              className="w-full rounded-xl bg-[#e50914] py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
            >
              {loading ? 'Verifying OTP...' : 'Verify & Continue'}
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(null); setSuccessNotice(null); setResetStep(1); }}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </button>
            </div>

            {resetStep === 1 ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <p className="text-xs text-zinc-400">
                  Enter your registered email address or phone number to receive a verification reset code.
                </p>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Email or Phone</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      placeholder="patron@example.com / 9876543212"
                      value={emailOrPhone}
                      onChange={(e) => setEmailOrPhone(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#0f1014] py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-[#e50914] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !emailOrPhone}
                  className="w-full rounded-xl bg-[#e50914] py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
                >
                  {loading ? 'Sending Code...' : 'Send Reset Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCompleteReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Reset Code <span className="text-zinc-500">(Use 123456 for test environment)</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full tracking-widest text-center rounded-xl border border-white/10 bg-[#0f1014] py-2.5 text-lg font-bold text-white placeholder-zinc-700 focus:border-[#e50914] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">New Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="password"
                      required
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#0f1014] py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-600 focus:border-[#e50914] focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !resetCode || !newPassword}
                  className="w-full rounded-xl bg-[#e50914] py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition disabled:opacity-50"
                >
                  {loading ? 'Updating Password...' : 'Save New Password & Sign In'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

