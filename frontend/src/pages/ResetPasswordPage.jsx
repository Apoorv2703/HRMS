import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, CheckCircle, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import api from '../services/api';

const getStrength = (password) => {
  let score = 0;
  if (!password) return { score: 0, label: '', color: '' };
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;

  if (score <= 1) return { score, label: 'Too weak', color: 'bg-rose-500' };
  if (score === 2) return { score, label: 'Weak', color: 'bg-orange-500' };
  if (score === 3) return { score, label: 'Fair', color: 'bg-amber-500' };
  if (score === 4) return { score, label: 'Strong', color: 'bg-teal-500' };
  return { score, label: 'Very strong', color: 'bg-emerald-500' };
};

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const subdomain = searchParams.get('subdomain') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [countdown, setCountdown] = useState(null);

  const strength = getStrength(newPassword);

  // Link validity check
  const linkInvalid = !token || !email || !subdomain;

  // Auto-redirect countdown after success
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      navigate('/login');
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }
    if (strength.score < 3) {
      setErrorMsg('Password is too weak. Use at least 8 characters with uppercase, numbers, and symbols.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        token,
        email,
        subdomain,
        newPassword,
      });
      setSuccessMsg(res.data.message);
      setCountdown(5);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-teal-500/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/40 p-8 space-y-6">

          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/20 mb-4">
              <ShieldCheck className="h-7 w-7 text-black" />
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Set New Password</h1>
            <p className="text-sm text-slate-400 mt-1.5">
              {email && <span>Resetting for <strong className="text-slate-300">{email}</strong></span>}
            </p>
          </div>

          {/* Invalid link state */}
          {linkInvalid ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-5 flex gap-3 items-start">
                <AlertTriangle className="h-5 w-5 text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-rose-300">Invalid Reset Link</p>
                  <p className="text-xs text-rose-400/80 mt-1 leading-relaxed">
                    This link is missing required parameters. Please request a new password reset link.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/forgot-password')}
                className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 py-3 text-sm font-bold text-black cursor-pointer"
              >
                Request New Link
              </button>
            </div>

          ) : successMsg ? (
            /* Success state */
            <div className="space-y-5">
              <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 p-5 flex gap-3 items-start">
                <CheckCircle className="h-5 w-5 text-teal-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-teal-300">Password Reset Successfully!</p>
                  <p className="text-xs text-teal-400/80 mt-1 leading-relaxed">{successMsg}</p>
                  {countdown !== null && (
                    <p className="text-xs text-slate-500 mt-2">
                      Redirecting to login in <strong className="text-slate-400">{countdown}s</strong>...
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 py-3 text-sm font-bold text-black cursor-pointer"
              >
                Go to Login
              </button>
            </div>

          ) : (
            /* Reset form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMsg && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 flex gap-2.5 items-start">
                  <AlertTriangle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-300">{errorMsg}</p>
                </div>
              )}

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  New Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="reset-new-password"
                    type={showNew ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 pl-10 pr-11 py-3 text-sm text-white placeholder-slate-600 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30 transition duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength bar */}
                {newPassword && (
                  <div className="space-y-1 pt-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            i <= strength.score ? strength.color : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-[10px] font-semibold ${
                      strength.score <= 2 ? 'text-rose-400' : strength.score === 3 ? 'text-amber-400' : 'text-teal-400'
                    }`}>
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Confirm New Password
                </label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    id="reset-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className={`w-full rounded-xl border pl-10 pr-11 py-3 text-sm text-white placeholder-slate-600 bg-slate-900/60 focus:outline-none focus:ring-1 transition duration-200 ${
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/20'
                        : 'border-slate-700 focus:border-teal-500 focus:ring-teal-500/30'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword === newPassword && (
                  <p className="text-[10px] text-teal-400 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Passwords match
                  </p>
                )}
              </div>

              {/* Password requirements hint */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-1.5">
                <p className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Requirements</p>
                {[
                  { label: 'At least 8 characters', met: newPassword.length >= 8 },
                  { label: 'One uppercase letter', met: /[A-Z]/.test(newPassword) },
                  { label: 'One number', met: /[0-9]/.test(newPassword) },
                  { label: 'One special character (!@#$...)', met: /[^A-Za-z0-9]/.test(newPassword) },
                ].map(({ label, met }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${met ? 'bg-teal-400' : 'bg-slate-700'}`} />
                    <span className={`text-[10px] ${met ? 'text-teal-400' : 'text-slate-600'}`}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Submit */}
              <button
                id="reset-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 py-3 text-sm font-bold text-black shadow-lg shadow-teal-500/20 disabled:opacity-60 transition duration-200 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Reset Password
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          HRMS Platform · Secure Password Recovery
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
