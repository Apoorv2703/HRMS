import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ShieldCheck, UserCheck, KeyRound, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import { loginSuccess } from '../store/authSlice';
import { useToast } from '../context/ToastContext';

const OnboardingVerification = () => {
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const code = searchParams.get('code');

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);

  // Employee details from code
  const [details, setDetails] = useState(null);

  // Form password
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passError, setPassError] = useState('');

  // Password rules validation checklist
  const [rules, setRules] = useState({
    length: false,
    uppercase: false,
    number: false,
    special: false
  });

  useEffect(() => {
    if (!code) {
      setError('Invitation setup code is missing from link.');
      setLoading(false);
      return;
    }
    verifyCode();
  }, [code]);

  const verifyCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/employees/verify-invite?code=${code}`);
      setDetails(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'This onboarding invitation link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (val) => {
    setPassword(val);
    setRules({
      length: val.length >= 8,
      uppercase: /[A-Z]/.test(val),
      number: /\d/.test(val),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(val)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPassError('');

    if (password !== confirmPassword) {
      setPassError('Passwords do not match.');
      return;
    }

    const { length, uppercase, number, special } = rules;
    if (!length || !uppercase || !number || !special) {
      setPassError('Password must satisfy all complexity constraints listed below.');
      return;
    }

    setVerifying(true);
    try {
      const response = await api.post('/employees/activate-invite', {
        inviteCode: code,
        password
      });

      // Dispatch auto-login details into Redux auth store state
      dispatch(loginSuccess({
        token: response.data.token,
        user: response.data.user
      }));

      showToast('Account setup completed successfully! Welcome aboard.', 'success');
      navigate('/dashboard');
    } catch (err) {
      setPassError(err.response?.data?.error || 'Failed to complete registration setup.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-950 border-t-transparent"></div>
        <span className="ml-3 font-medium">Validating onboarding invitation...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-2xl text-slate-850">
        {error ? (
          <div className="text-center animate-in zoom-in-95 duration-200">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              <ShieldAlert className="h-8 w-8 text-rose-600" />
            </div>
            <h2 className="text-xl font-bold text-rose-900">Setup Verification Failed</h2>
            <p className="mt-2 text-sm text-slate-500">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-6 rounded-xl bg-slate-950 hover:bg-slate-900 text-white px-6 py-2.5 text-sm font-semibold transition cursor-pointer shadow-sm"
            >
              Go to Login
            </button>
          </div>
        ) : (
          <div className="animate-in fade-in duration-200">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                <UserCheck className="h-8 w-8 text-slate-800" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">Welcome, {details?.firstName}!</h2>
              <p className="mt-1 text-sm text-slate-500">Complete your profile onboarding credentials.</p>
              <div className="mt-3 inline-block rounded-lg bg-slate-50 px-3 py-1 font-mono text-xs border border-slate-200 text-slate-700">
                {details?.email}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Create Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Confirm Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950/20"
                />
              </div>

              {passError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-start gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <span>{passError}</span>
                </div>
              )}

              {/* Password complexity checklist */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs text-slate-600">
                <span className="block font-semibold uppercase text-slate-500 mb-1 tracking-wider">Complexity Constraints</span>
                <p className="flex items-center gap-1.5">
                  {rules.length ? <CheckCircle className="h-3.5 w-3.5 text-emerald-700" /> : <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300"></div>}
                  At least 8 characters
                </p>
                <p className="flex items-center gap-1.5">
                  {rules.uppercase ? <CheckCircle className="h-3.5 w-3.5 text-emerald-700" /> : <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300"></div>}
                  One uppercase letter (A-Z)
                </p>
                <p className="flex items-center gap-1.5">
                  {rules.number ? <CheckCircle className="h-3.5 w-3.5 text-emerald-700" /> : <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300"></div>}
                  One numeric character (0-9)
                </p>
                <p className="flex items-center gap-1.5">
                  {rules.special ? <CheckCircle className="h-3.5 w-3.5 text-emerald-700" /> : <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300"></div>}
                  One special character (e.g. !, @, #, $, %)
                </p>
              </div>

              <button
                type="submit"
                disabled={verifying}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 py-3 font-bold text-white disabled:opacity-50 transition cursor-pointer shadow-md"
              >
                <ShieldCheck className="h-5 w-5" />
                {verifying ? 'Setting Up Workspace...' : 'Complete Profile Setup'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingVerification;
