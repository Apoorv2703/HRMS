import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Mail, Building2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { loginStart, loginSuccess, loginFailure, clearError } from '../store/authSlice';
import api from '../services/api';

const LoginPage = () => {
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(clearError());
    setLocalError('');
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate, dispatch]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

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
      dispatch(loginSuccess(response.data));
      navigate('/dashboard');
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to authenticate. Please try again.';
      dispatch(loginFailure(errMsg));
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
            Sign in to <span className="bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">HRMS Portal</span>
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Enter your workspace credentials to access your dashboard.
          </p>
        </div>

        {/* Display System Errors or Local Validations */}
        {(localError || error) && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>{localError || error}</div>
          </div>
        )}

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
