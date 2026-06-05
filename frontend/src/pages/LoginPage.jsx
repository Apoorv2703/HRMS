import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Mail, Building2, AlertTriangle, Eye, EyeOff, CheckCircle, ShieldCheck } from 'lucide-react';
import { loginStart, loginSuccess, loginFailure, clearError } from '../store/authSlice';
import api from '../services/api';

const LoginPage = () => {
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');

  // Password Expiry States
  const [isExpiredState, setIsExpiredState] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // MFA Challenge States
  const [isMfaState, setIsMfaState] = useState(false);
  const [mfaToken, setMfaToken] = useState('');
  const [tempToken, setTempToken] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(clearError());
    setLocalError('');
    setLocalSuccess('');
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate, dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLocalSuccess('');

    if (!subdomain.trim()) {
      return setLocalError('Company subdomain is required.');
    }
    if (!email.trim()) {
      return setLocalError('Email is required.');
    }
    if (!password) {
      return setLocalError('Password is required.');
    }

    dispatch(loginStart());
    try {
      const response = await api.post('/auth/login', {
        email: email.trim(),
        password,
        subdomain: subdomain.trim(),
      });

      if (response.data.mfaRequired) {
        setIsMfaState(true);
        setTempToken(response.data.tempToken);
        dispatch(clearError());
        return;
      }

      dispatch(loginSuccess(response.data));
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.data?.code === 'PASSWORD_EXPIRED') {
        setIsExpiredState(true);
        setCurrentPassword(password);
        dispatch(clearError());
        setLocalError('Your password has expired. You must change it to gain access.');
      } else {
        const errMsg = err.response?.data?.error || 'Failed to authenticate. Please try again.';
        dispatch(loginFailure(errMsg));
      }
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLocalSuccess('');

    if (!currentPassword) {
      return setLocalError('Current password is required.');
    }
    if (!newPassword) {
      return setLocalError('New password is required.');
    }
    if (newPassword !== confirmPassword) {
      return setLocalError('New passwords do not match.');
    }

    setResetLoading(true);
    try {
      const response = await api.post('/auth/reset-expired-password', {
        subdomain: subdomain.trim(),
        email: email.trim(),
        currentPassword,
        newPassword,
      });

      setLocalSuccess(response.data.message || 'Password updated successfully. Please log in.');
      setIsExpiredState(false);
      setPassword('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setResetLoading(false);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to update password. Try another one.';
      setLocalError(errMsg);
      setResetLoading(false);
    }
  };

  const handleVerifyMfa = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLocalSuccess('');

    if (!mfaToken.trim()) {
      return setLocalError('Verification code is required.');
    }

    setResetLoading(true);
    try {
      const response = await api.post('/auth/verify-mfa', {
        token: mfaToken.trim(),
        tempToken,
      });
      dispatch(loginSuccess(response.data));
      navigate('/dashboard');
    } catch (err) {
      const errMsg = err.response?.data?.error || 'MFA validation failed. Check your authenticator code.';
      setLocalError(errMsg);
      setResetLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-brand-600/10 blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl"></div>

      <div className="relative z-10 w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl shadow-2xl">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold tracking-tight text-white">
            {isMfaState ? (
              <span>Authenticator <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Challenge</span></span>
            ) : isExpiredState ? (
              <span>Reset <span className="bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">Expired Password</span></span>
            ) : (
              <span>Sign in to <span className="bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">HRMS Portal</span></span>
            )}
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            {isMfaState
              ? 'Enter the 6-digit verification code from your authenticator app.'
              : isExpiredState
              ? 'Your company requires regular password updates for security compliance.'
              : 'Enter your workspace credentials to access your dashboard.'}
          </p>
        </div>

        {/* Display Messages */}
        {localSuccess && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <div>{localSuccess}</div>
          </div>
        )}

        {(localError || error) && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>{localError || error}</div>
          </div>
        )}

        {/* MFA Verification Form */}
        {isMfaState ? (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyMfa}>
            <div>
              <label className="block text-center text-sm font-medium text-slate-300">
                MFA Code
              </label>
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <KeyRound className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="000000"
                  maxLength={6}
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ''))}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-800/80 py-3 pl-10 text-center text-xl font-bold tracking-widest text-slate-100 placeholder-slate-550 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsMfaState(false);
                  setMfaToken('');
                  setTempToken('');
                }}
                className="flex-1 justify-center rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-center text-sm font-semibold text-slate-300 hover:bg-slate-750 focus:outline-none"
              >
                Back to Login
              </button>
              <button
                type="submit"
                disabled={resetLoading}
                className="flex-1 justify-center rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-emerald-500 hover:to-teal-500 focus:outline-none disabled:opacity-50"
              >
                {resetLoading ? 'Validating...' : 'Verify OTP'}
              </button>
            </div>
          </form>
        ) : isExpiredState ? (
          /* Expired Password Reset Form */
          <form className="mt-8 space-y-5" onSubmit={handleResetPassword}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300">Current Password</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <KeyRound className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3 text-slate-100 placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">New Password</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <KeyRound className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="New password (complexity rules apply)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3 text-slate-100 placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300">Confirm New Password</label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <KeyRound className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3 text-slate-100 placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsExpiredState(false)}
                className="flex-1 justify-center rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-center text-sm font-semibold text-slate-300 hover:bg-slate-750 focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetLoading}
                className="flex-1 justify-center rounded-lg bg-gradient-to-r from-brand-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-brand-500 hover:to-indigo-500 focus:outline-none disabled:opacity-50"
              >
                {resetLoading ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </form>
        ) : (
          /* Standard Login Form */
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4 rounded-md shadow-sm">
              {/* Subdomain Input */}
              <div>
                <label htmlFor="subdomain" className="block text-sm font-medium text-slate-300">
                  Workspace Subdomain
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Building2 className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    id="subdomain"
                    name="subdomain"
                    type="text"
                    required
                    placeholder="company-name"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    className="block w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-24 text-slate-100 placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <span className="text-sm font-medium text-slate-500">.hrms.com</span>
                  </div>
                </div>
              </div>

              {/* Email Input */}
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-slate-300">
                  Email Address
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="employee@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3 text-slate-100 placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                  Password
                </label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <KeyRound className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-10 text-slate-100 placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-brand-500 focus:ring-brand-500"
                />
                <label htmlFor="remember-me" className="ml-2 block text-slate-400">
                  Remember device
                </label>
              </div>
              <a href="#" className="font-medium text-brand-400 hover:text-brand-300">
                Forgot password?
              </a>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg bg-gradient-to-r from-brand-600 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-brand-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 border-t border-slate-800 pt-6 text-center text-sm">
          <span className="text-slate-500">Need to create a new workspace? </span>
          <Link to="/register-tenant" className="font-semibold text-brand-400 hover:text-brand-300">
            Register Company
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
