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

  const handleMicrosoftLogin = (clientId) => {
    localStorage.setItem('workspaceSubdomain', subdomain.trim());
    if (clientId === 'MOCK_CLIENT_ID') {
      const mockEmail = prompt("Enter mock Microsoft email address to authenticate:", `admin@${subdomain.trim()}.com`);
      if (mockEmail) {
        navigate(`/auth/callback/microsoft?code=${encodeURIComponent(mockEmail)}&state=${encodeURIComponent(subdomain.trim())}`);
      }
      return;
    }
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback/microsoft`);
    const scope = encodeURIComponent('openid email profile User.Read');
    const state = encodeURIComponent(subdomain.trim());
    window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
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
    <div className="flex min-h-screen w-full bg-[#5254f6] items-center justify-center p-4 md:p-8 lg:p-12 font-sans select-none relative overflow-hidden">
      {/* Background decoration circles */}
      <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-white/5 blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-black/10 blur-3xl pointer-events-none"></div>

      {/* Outer Card Wrapper combining Left (Branding) and Right (Form) side by side */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 items-center gap-8 lg:gap-16 relative z-10">
        
        {/* Left Side: Branding and Info */}
        <div className="flex flex-col justify-center text-white p-6 md:p-12 lg:p-16 space-y-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-4">
            <div className="bg-white/20 p-2.5 rounded-2xl backdrop-blur-md shadow-inner">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <path d="M9 10l2 2 4-4" fill="none" />
              </svg>
            </div>
            <span className="text-2xl font-extrabold tracking-tight">Redvision</span>
          </div>

          {/* Slogans */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              Hey, Hello!
            </h1>
            <h2 className="text-lg md:text-xl font-bold text-white/90">
              Simplify Your Workforce Operations
            </h2>
            <p className="text-sm md:text-base text-white/75 max-w-md leading-relaxed font-medium">
              We provide all the tools that can simplify all your employee operations, attendances, regularizations, and workflows without any hassle.
            </p>
          </div>
        </div>

        {/* Right Side: Login White Card */}
        <div className="w-full max-w-md mx-auto bg-white rounded-[32px] p-8 md:p-12 shadow-2xl border border-slate-100 flex flex-col space-y-6">
          <div className="text-center">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {isMfaState ? (
                'MFA Challenge'
              ) : isExpiredState ? (
                'Reset Password'
              ) : (
                'Welcome Back'
              )}
            </h3>
            <p className="text-xs text-slate-400 font-semibold mt-2 leading-relaxed">
              {isMfaState
                ? 'Enter the 6-digit verification code from your authenticator app.'
                : isExpiredState
                ? 'Your company requires regular password updates for security compliance.'
                : "Let's get started by authenticating your workspace."}
            </p>
          </div>

          {/* Display Messages */}
          {localSuccess && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-xs text-emerald-600 font-semibold">
              <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
              <div>{localSuccess}</div>
            </div>
          )}

          {(localError || error) && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-xs text-rose-600 font-semibold">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-500" />
              <div>{localError || error}</div>
            </div>
          )}

          {/* MFA Verification Form */}
          {isMfaState ? (
            <form className="space-y-5" onSubmit={handleVerifyMfa}>
              <div>
                <label className="sr-only">MFA Code</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <KeyRound className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Verification Code"
                    maxLength={6}
                    value={mfaToken}
                    onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, ''))}
                    className="block w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-12 text-center text-lg font-bold tracking-widest text-slate-800 placeholder-slate-400 focus:border-[#5254f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5254f6] transition duration-150"
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
                  className="flex-1 justify-center rounded-full border border-slate-200 bg-slate-50 py-3.5 text-center text-xs font-bold text-slate-650 hover:bg-slate-100 focus:outline-none transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 justify-center rounded-full bg-[#5254f6] hover:bg-[#4343db] py-3.5 text-center text-xs font-bold text-white shadow-lg shadow-indigo-500/10 focus:outline-none disabled:opacity-50 transition cursor-pointer"
                >
                  {resetLoading ? 'Validating...' : 'Verify OTP'}
                </button>
              </div>
            </form>
          ) : isExpiredState ? (
            /* Expired Password Reset Form */
            <form className="space-y-4" onSubmit={handleResetPassword}>
              <div className="space-y-3">
                <div>
                  <label className="sr-only">Current Password</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <KeyRound className="h-4.5 w-4.5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="Current Password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="block w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-[#5254f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5254f6] transition duration-150"
                    />
                  </div>
                </div>

                <div>
                  <label className="sr-only">New Password</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <KeyRound className="h-4.5 w-4.5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="New Password (min 8 chars)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-[#5254f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5254f6] transition duration-150"
                    />
                  </div>
                </div>

                <div>
                  <label className="sr-only">Confirm New Password</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <KeyRound className="h-4.5 w-4.5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="Confirm New Password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-[#5254f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5254f6] transition duration-150"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExpiredState(false)}
                  className="flex-1 justify-center rounded-full border border-slate-200 bg-slate-50 py-3.5 text-center text-xs font-bold text-slate-650 hover:bg-slate-100 focus:outline-none transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 justify-center rounded-full bg-[#5254f6] hover:bg-[#4343db] py-3.5 text-center text-xs font-bold text-white shadow-lg shadow-indigo-500/10 focus:outline-none disabled:opacity-50 transition cursor-pointer"
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
                  <label className="sr-only">Workspace Subdomain</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Building2 className="h-4.5 w-4.5 text-slate-400" />
                    </div>
                    <input
                      id="subdomain"
                      name="subdomain"
                      type="text"
                      required
                      placeholder="Workspace"
                      value={subdomain}
                      onChange={(e) => setSubdomain(e.target.value)}
                      className="block w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-24 text-xs text-slate-800 placeholder-slate-400 focus:border-[#5254f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5254f6] transition duration-150"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                      <span className="text-[11px] font-bold text-slate-450 uppercase tracking-wide">.hrms.com</span>
                    </div>
                  </div>
                </div>

                {/* Email Input */}
                <div>
                  <label className="sr-only">Email Address</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <Mail className="h-4.5 w-4.5 text-slate-400" />
                    </div>
                    <input
                      id="email-address"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="Username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-[#5254f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5254f6] transition duration-150"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="sr-only">Password</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                      <KeyRound className="h-4.5 w-4.5 text-slate-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-10 text-xs text-slate-800 placeholder-slate-400 focus:border-[#5254f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5254f6] transition duration-150"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 hover:text-slate-650 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="text-center">
                <Link
                  to={`/forgot-password${subdomain ? `?subdomain=${encodeURIComponent(subdomain)}` : ''}`}
                  className="text-xs font-bold text-slate-450 hover:text-[#5254f6] hover:underline transition duration-150"
                >
                  Forgot Password?
                </Link>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full justify-center rounded-full bg-[#5254f6] hover:bg-[#4343db] py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 focus:outline-none disabled:opacity-50 transition duration-150 cursor-pointer"
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
          {ssoConfig && (ssoConfig.googleEnabled || ssoConfig.microsoftEnabled || ssoConfig.samlEnabled) && (
            <div className="space-y-4">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100"></div>
                </div>
                <span className="relative bg-white px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Or
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {ssoConfig.googleEnabled && (
                  <button
                    type="button"
                    onClick={() => handleGoogleLogin(ssoConfig.googleClientId)}
                    className="flex items-center justify-center gap-2 rounded-full border border-slate-100 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 px-4 py-2.5 transition duration-150 cursor-pointer"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.579-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.245-3.12C18.28 1.965 15.485 1 12.24 1 5.922 1 1 5.92 1 12.2s4.922 11.2 11.24 11.2c6.6 0 11-4.64 11-11.2 0-.756-.08-1.332-.178-1.915H12.24z"
                      />
                    </svg>
                    Google
                  </button>
                )}
                {ssoConfig.microsoftEnabled && (
                  <button
                    type="button"
                    onClick={() => handleMicrosoftLogin(ssoConfig.microsoftClientId)}
                    className="flex items-center justify-center gap-2 rounded-full border border-slate-100 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-600 px-4 py-2.5 transition duration-150 cursor-pointer"
                  >
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 23 23">
                      <path fill="#f25022" d="M1 1h10v10H1z" />
                      <path fill="#7fba00" d="M12 1h10v10H12z" />
                      <path fill="#00a4ef" d="M1 12h10v10H1z" />
                      <path fill="#ffb900" d="M12 12h10v10H12z" />
                    </svg>
                    Microsoft
                  </button>
                )}
              </div>

              {ssoConfig.samlEnabled && (
                <button
                  type="button"
                  onClick={() => handleSamlLogin(ssoConfig.samlEntryPoint)}
                  className="w-full flex items-center justify-center gap-2 rounded-full border border-slate-100 bg-slate-50 hover:bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-600 transition duration-150 cursor-pointer"
                >
                  <ShieldCheck className="h-4.5 w-4.5 text-slate-400" />
                  SAML Single Sign-On
                </button>
              )}
            </div>
          )}

          {/* Footer Navigation */}
          <div className="text-center text-xs font-semibold text-slate-400 pt-2">
            <span>Don't have an account? </span>
            <Link to="/register-tenant" className="text-[#5254f6] font-extrabold hover:underline">
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
