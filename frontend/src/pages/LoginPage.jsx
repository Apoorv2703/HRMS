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

  // SSO config state
  const [ssoConfig, setSsoConfig] = useState(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth);

  // Debounced check for subdomain SSO configuration
  useEffect(() => {
    if (!subdomain.trim() || subdomain.trim().length < 2) {
      setSsoConfig(null);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        const response = await api.get('/auth/sso-config', {
          params: { subdomain: subdomain.trim() }
        });
        setSsoConfig(response.data);
      } catch (err) {
        setSsoConfig(null);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [subdomain]);

  const handleGoogleLogin = (clientId) => {
    localStorage.setItem('workspaceSubdomain', subdomain.trim());
    if (clientId === 'MOCK_CLIENT_ID') {
      const mockEmail = prompt("Enter mock Google email address to authenticate:", `admin@${subdomain.trim()}.com`);
      if (mockEmail) {
        navigate(`/auth/callback/google?code=${encodeURIComponent(mockEmail)}&state=${encodeURIComponent(subdomain.trim())}`);
      }
      return;
    }
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback/google`);
    const scope = encodeURIComponent('openid email profile');
    const state = encodeURIComponent(subdomain.trim());
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
  };



  const handleSamlLogin = (entryPoint) => {
    localStorage.setItem('workspaceSubdomain', subdomain.trim());
    if (entryPoint.startsWith('MOCK_SAML_IDP') || entryPoint.startsWith('mock') || !entryPoint) {
      const mockEmail = prompt("Enter mock SAML email address to authenticate:", `admin@${subdomain.trim()}.com`);
      if (mockEmail) {
        navigate(`/auth/callback/saml?SAMLResponse=MOCK_SAML_ASSERTION:${encodeURIComponent(mockEmail)}&state=${encodeURIComponent(subdomain.trim())}`);
      }
      return;
    }
    window.location.href = `${entryPoint}?subdomain=${encodeURIComponent(subdomain.trim())}`;
  };

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
    <div className="flex min-h-screen w-full bg-[#f8fafc] items-center justify-center p-4 md:p-8 font-sans select-none">
      {/* Centered Login Card */}
      <div className="w-full max-w-[440px] bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-slate-100 flex flex-col space-y-6">
        
        {/* Headings */}
        <div className="text-left">
          <h3 className="text-3xl font-extrabold text-[#101828] tracking-tight">
            {isMfaState ? (
              'MFA Challenge'
            ) : isExpiredState ? (
              'Reset Password'
            ) : (
              'Welcome back'
            )}
          </h3>
          <p className="text-sm font-normal text-slate-500 mt-1.5">
            {isMfaState
              ? 'Enter the 6-digit verification code from your authenticator app.'
              : isExpiredState
              ? 'Your company requires regular password updates for security compliance.'
              : 'Welcome back! Please enter your details.'}
          </p>
        </div>

        {/* Display Messages */}
        {localSuccess && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-xs text-emerald-600 font-semibold">
            <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
            <div>{localSuccess}</div>
          </div>
        )}

        {(localError || error) && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-xs text-rose-600 font-semibold">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-500" />
            <div>{localError || error}</div>
          </div>
        )}

        {/* MFA Verification Form */}
        {isMfaState ? (
          <form className="space-y-5" onSubmit={handleVerifyMfa}>
            <div>
              <label className="block text-sm font-semibold text-[#344054] mb-1.5">Verification Code</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  value={mfaToken}
                  onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ''))}
                  className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 text-center text-lg font-bold tracking-widest text-slate-800 placeholder-slate-400 focus:border-[#101828] focus:ring-1 focus:ring-[#101828] outline-none shadow-sm transition duration-150"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsMfaState(false);
                  setMfaToken('');
                  setTempToken('');
                }}
                className="flex-1 justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 py-3 text-center text-sm font-semibold text-[#344054] focus:outline-none transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetLoading}
                className="flex-1 justify-center rounded-lg bg-[#101828] hover:bg-[#1d2939] py-3 text-center text-sm font-semibold text-white shadow-sm focus:outline-none disabled:opacity-50 transition cursor-pointer"
              >
                {resetLoading ? 'Validating...' : 'Verify'}
              </button>
            </div>
          </form>
        ) : isExpiredState ? (
          /* Expired Password Reset Form */
          <form className="space-y-4" onSubmit={handleResetPassword}>
            <div className="space-y-3.5">
              <div>
                <label className="block text-sm font-semibold text-[#344054] mb-1.5">Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#101828] focus:ring-1 focus:ring-[#101828] outline-none shadow-sm transition duration-150"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#344054] mb-1.5">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="New Password (min 8 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#101828] focus:ring-1 focus:ring-[#101828] outline-none shadow-sm transition duration-150"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#344054] mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#101828] focus:ring-1 focus:ring-[#101828] outline-none shadow-sm transition duration-150"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsExpiredState(false)}
                className="flex-1 justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 py-3 text-center text-sm font-semibold text-[#344054] focus:outline-none transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetLoading}
                className="flex-1 justify-center rounded-lg bg-[#101828] hover:bg-[#1d2939] py-3 text-center text-sm font-semibold text-white shadow-sm focus:outline-none disabled:opacity-50 transition cursor-pointer"
              >
                {resetLoading ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </form>
        ) : (
          /* Standard Login Form */
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3.5">
              {/* Subdomain Input */}
              <div>
                <label className="block text-sm font-semibold text-[#344054] mb-1.5">Workspace Subdomain</label>
                <div className="relative">
                  <input
                    id="subdomain"
                    name="subdomain"
                    type="text"
                    required
                    placeholder="Enter workspace subdomain"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 pr-24 text-sm text-slate-900 placeholder-slate-400 focus:border-[#101828] focus:ring-1 focus:ring-[#101828] outline-none shadow-sm transition duration-150"
                  />
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">.hrms.com</span>
                  </div>
                </div>
              </div>

              {/* Email Input */}
              <div>
                <label className="block text-sm font-semibold text-[#344054] mb-1.5">Email</label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#101828] focus:ring-1 focus:ring-[#101828] outline-none shadow-sm transition duration-150"
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-semibold text-[#344054] mb-1.5">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-[#101828] focus:ring-1 focus:ring-[#101828] outline-none shadow-sm transition duration-150"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-450 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex justify-start">
              <Link
                to={`/forgot-password${subdomain ? `?subdomain=${encodeURIComponent(subdomain)}` : ''}`}
                className="text-sm font-semibold text-[#101828] hover:underline transition duration-150"
              >
                Forgot password
              </Link>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-lg bg-[#101828] hover:bg-[#1d2939] py-3 text-sm font-semibold text-white shadow-sm focus:outline-none disabled:opacity-50 transition duration-150 cursor-pointer"
              >
                {loading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                ) : (
                  'Login'
                )}
              </button>
            </div>
          </form>
        )}

        {/* SSO Options */}
        {ssoConfig && (ssoConfig.googleEnabled || ssoConfig.samlEnabled) && (
          <div className="space-y-3 pt-1">
            {ssoConfig.googleEnabled && (
              <button
                type="button"
                onClick={() => handleGoogleLogin(ssoConfig.googleClientId)}
                className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-[#344054] py-3 shadow-sm transition duration-150 cursor-pointer"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.245-3.12C18.28 1.965 15.485 1 12.24 1 5.922 1 1 5.92 1 12.2s4.922 11.2 11.24 11.2c6.6 0 11-4.64 11-11.2 0-.756-.08-1.332-.178-1.915H12.24z"
                  />
                </svg>
                Sign in with Google
              </button>
            )}
            {ssoConfig.samlEnabled && (
              <button
                type="button"
                onClick={() => handleSamlLogin(ssoConfig.samlEntryPoint)}
                className="w-full flex items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-[#344054] py-3 shadow-sm transition duration-150 cursor-pointer"
              >
                <ShieldCheck className="h-5 w-5 text-slate-400" />
                Sign in with SAML SSO
              </button>
            )}
          </div>
        )}

        {/* Footer Navigation */}
        <div className="text-center text-sm font-normal text-slate-500 pt-2">
          <span>Don't have an account? </span>
          <Link to="/register-tenant" className="text-[#101828] font-bold hover:underline">
            Sign up for free
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
