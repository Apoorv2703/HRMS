import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Mail, Building2, ArrowLeft, CheckCircle, AlertTriangle, Loader2, KeyRound } from 'lucide-react';
import api from '../services/api';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [subdomain, setSubdomain] = useState(searchParams.get('subdomain') || '');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.post('/auth/forgot-password', {
        email: email.trim().toLowerCase(),
        subdomain: subdomain.trim().toLowerCase(),
      });
      setSuccessMsg(res.data.message);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-slate-200/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-slate-200/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl p-8 space-y-6">

          {/* Logo */}
          <div className="text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 shadow-md mb-4">
              <KeyRound className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#101828] tracking-tight">Forgot Password?</h1>
            <p className="text-sm text-[#475467] mt-1.5">
              Enter your workspace and email — we'll send you a reset link.
            </p>
          </div>

          {/* Success State */}
          {successMsg ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 flex gap-3 items-start">
                <CheckCircle className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-teal-800">Email Sent!</p>
                  <p className="text-xs text-teal-700 mt-1 leading-relaxed">{successMsg}</p>
                  <p className="text-xs text-slate-500 mt-2">Check your inbox — the link expires in 15 minutes.</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 py-3 text-sm font-semibold text-slate-700 transition duration-200 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error */}
              {errorMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 flex gap-2.5 items-start">
                  <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-rose-700">{errorMsg}</p>
                </div>
              )}

              {/* Workspace */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#344054] mb-1.5">
                  Workspace Subdomain
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="forgot-subdomain"
                    type="text"
                    required
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    placeholder="your-company"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950/20 transition duration-200"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#344054] mb-1.5">
                  Your Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-950 focus:outline-none focus:ring-1 focus:ring-slate-950/20 transition duration-200"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                id="forgot-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-950 hover:bg-slate-900 py-3 text-sm font-bold text-white shadow-lg disabled:opacity-60 transition duration-200 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending Reset Link...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Send Reset Link
                  </>
                )}
              </button>

              {/* Back to login */}
              <div className="text-center pt-1">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-[#475467] hover:text-[#101828] font-bold transition duration-200"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Login
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          HRMS Platform · Secure Password Recovery
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
