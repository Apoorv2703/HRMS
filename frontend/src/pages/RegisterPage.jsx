import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Mail, KeyRound, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../services/api';

const RegisterPage = () => {
  const [companyName, setCompanyName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!companyName.trim() || !subdomain.trim() || !email.trim() || !password.trim()) {
      setLoading(false);
      return setError('All fields are required.');
    }

    try {
      await api.post('/auth/register-tenant', {
        companyName: companyName.trim(),
        subdomain: subdomain.trim().toLowerCase(),
        email: email.trim().toLowerCase(),
        password,
      });
      setSuccess(true);
      setLoading(false);
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Registration failed. Try a different subdomain.';
      setError(errMsg);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="relative z-10 w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center backdrop-blur-xl shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <CheckCircle className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-white">Registration Successful!</h2>
          <p className="text-slate-400">
            Your workspace <strong className="text-brand-400">{subdomain}.hrms.com</strong> and HR Admin account are active.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="flex w-full justify-center rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-brand-500 focus:outline-none"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 sm:px-6 lg:px-8">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-brand-600/10 blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl"></div>

      <div className="relative z-10 w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center justify-between">
          <Link to="/login" className="flex items-center text-sm font-medium text-slate-400 hover:text-slate-200">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to login
          </Link>
        </div>

        <div>
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-white font-sans">
            Register your <span className="bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">Company Workspace</span>
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Provision a secure, isolated tenant for your organization.
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Company Name */}
            <div>
              <label htmlFor="company-name" className="block text-sm font-medium text-slate-300">
                Company Name
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Building2 className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="company-name"
                  type="text"
                  required
                  placeholder="Redvision Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3 text-slate-100 placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Subdomain */}
            <div>
              <label htmlFor="subdomain-reg" className="block text-sm font-medium text-slate-300">
                Requested Subdomain
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Building2 className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="subdomain-reg"
                  type="text"
                  required
                  placeholder="redvision"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase())}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-24 text-slate-100 placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-sm font-medium text-slate-500">.hrms.com</span>
                </div>
              </div>
            </div>

            {/* Admin Email */}
            <div>
              <label htmlFor="admin-email" className="block text-sm font-medium text-slate-300">
                HR Admin Email
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="admin-email"
                  type="email"
                  required
                  placeholder="admin@redvision.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3 text-slate-100 placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm"
                />
              </div>
            </div>

            {/* Admin Password */}
            <div>
              <label htmlFor="admin-password" className="block text-sm font-medium text-slate-300">
                HR Admin Password
              </label>
              <div className="relative mt-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <KeyRound className="h-5 w-5 text-slate-500" />
                </div>
                <input
                  id="admin-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-slate-700 bg-slate-800/80 py-2.5 pl-10 pr-3 text-slate-100 placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:text-sm"
                />
              </div>
            </div>
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
                'Register Company'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;
