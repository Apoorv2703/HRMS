import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle } from 'lucide-react';
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

  const successContent = (
    <div className="w-full max-w-[440px] bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-slate-100 flex flex-col space-y-6 text-center items-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
        <CheckCircle className="h-10 w-10 text-emerald-500" />
      </div>
      <h3 className="text-3xl font-extrabold text-[#101828] tracking-tight">
        Registration Successful!
      </h3>
      <p className="text-sm font-normal text-slate-500 mt-1.5 leading-relaxed">
        Your workspace <strong className="text-[#101828] font-bold">{subdomain}.hrms.com</strong> and HR Admin account are active.
      </p>
      <button
        onClick={() => navigate('/login')}
        className="flex w-full justify-center rounded-lg bg-[#101828] hover:bg-[#1d2939] py-3 text-sm font-semibold text-white shadow-sm focus:outline-none transition duration-150 cursor-pointer"
      >
        Go to Login
      </button>
    </div>
  );

  const formContent = (
    <div className="w-full max-w-[440px] bg-white rounded-2xl p-8 sm:p-10 shadow-sm border border-slate-100 flex flex-col space-y-6">
      <div className="text-left">
        <h3 className="text-3xl font-extrabold text-[#101828] tracking-tight">
          Register your Company Workspace
        </h3>
        <p className="text-sm font-normal text-slate-500 mt-1.5">
          Provision a secure, isolated tenant for your organization.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50/50 p-4 text-xs text-rose-600 font-semibold">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-500" />
          <div>{error}</div>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-3.5">
          {/* Company Name */}
          <div>
            <label className="block text-sm font-semibold text-[#344054] mb-1.5">Company Name</label>
            <input
              id="company-name"
              type="text"
              required
              placeholder="e.g. Redvision Corp"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#101828] focus:ring-1 focus:ring-[#101828] outline-none shadow-sm transition duration-150"
            />
          </div>

          {/* Subdomain */}
          <div>
            <label className="block text-sm font-semibold text-[#344054] mb-1.5">Workspace Subdomain</label>
            <div className="relative">
              <input
                id="subdomain-reg"
                type="text"
                required
                placeholder="subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase())}
                className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 pr-24 text-sm text-slate-900 placeholder-slate-400 focus:border-[#101828] focus:ring-1 focus:ring-[#101828] outline-none shadow-sm transition duration-150"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">.hrms.com</span>
              </div>
            </div>
          </div>

          {/* Admin Email */}
          <div>
            <label className="block text-sm font-semibold text-[#344054] mb-1.5">HR Admin Email</label>
            <input
              id="admin-email"
              type="email"
              required
              placeholder="admin@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#101828] focus:ring-1 focus:ring-[#101828] outline-none shadow-sm transition duration-150"
            />
          </div>

          {/* Admin Password */}
          <div>
            <label className="block text-sm font-semibold text-[#344054] mb-1.5">HR Admin Password</label>
            <input
              id="admin-password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#101828] focus:ring-1 focus:ring-[#101828] outline-none shadow-sm transition duration-150"
            />
          </div>
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
              'Register Company'
            )}
          </button>
        </div>
      </form>

      {/* Footer Navigation */}
      <div className="text-center text-sm font-normal text-slate-500 pt-2">
        <span>Already have an account? </span>
        <Link to="/login" className="text-[#101828] font-bold hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-[#f8fafc] items-center justify-center p-4 md:p-8 font-sans select-none">
      {success ? successContent : formContent}
    </div>
  );
};

export default RegisterPage;
