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

  const successContent = (
    <div className="w-full max-w-md mx-auto bg-white rounded-[32px] p-8 md:p-12 shadow-2xl border border-slate-100 flex flex-col space-y-6 text-center items-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
        <CheckCircle className="h-10 w-10 text-emerald-500" />
      </div>
      <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
        Registration Successful!
      </h3>
      <p className="text-xs text-slate-400 font-semibold leading-relaxed">
        Your workspace <strong className="text-[#5254f6]">{subdomain}.hrms.com</strong> and HR Admin account are active.
      </p>
      <button
        onClick={() => navigate('/login')}
        className="flex w-full justify-center rounded-full bg-[#5254f6] hover:bg-[#4343db] py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 focus:outline-none transition duration-150 cursor-pointer"
      >
        Go to Login
      </button>
    </div>
  );

  const formContent = (
    <div className="w-full max-w-md mx-auto bg-white rounded-[32px] p-8 md:p-12 shadow-2xl border border-slate-100 flex flex-col space-y-6">
      <div className="text-center">
        <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Register your Company Workspace
        </h3>
        <p className="text-xs text-slate-400 font-semibold mt-2 leading-relaxed">
          Provision a secure, isolated tenant for your organization.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 text-xs text-rose-600 font-semibold">
          <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-500" />
          <div>{error}</div>
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-3.5">
          {/* Company Name */}
          <div>
            <label className="sr-only">Company Name</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Building2 className="h-4.5 w-4.5 text-slate-400" />
              </div>
              <input
                id="company-name"
                type="text"
                required
                placeholder="Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="block w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-[#5254f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5254f6] transition duration-150"
              />
            </div>
          </div>

          {/* Subdomain */}
          <div>
            <label className="sr-only">Requested Subdomain</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Building2 className="h-4.5 w-4.5 text-slate-400" />
              </div>
              <input
                id="subdomain-reg"
                type="text"
                required
                placeholder="Workspace Subdomain"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase())}
                className="block w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-24 text-xs text-slate-800 placeholder-slate-400 focus:border-[#5254f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5254f6] transition duration-150"
              />
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                <span className="text-[11px] font-bold text-slate-450 uppercase tracking-wide">.hrms.com</span>
              </div>
            </div>
          </div>

          {/* Admin Email */}
          <div>
            <label className="sr-only">HR Admin Email</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Mail className="h-4.5 w-4.5 text-slate-400" />
              </div>
              <input
                id="admin-email"
                type="email"
                required
                placeholder="HR Admin Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-[#5254f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5254f6] transition duration-150"
              />
            </div>
          </div>

          {/* Admin Password */}
          <div>
            <label className="sr-only">HR Admin Password</label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <KeyRound className="h-4.5 w-4.5 text-slate-400" />
              </div>
              <input
                id="admin-password"
                type="password"
                required
                placeholder="HR Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-full border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-xs text-slate-800 placeholder-slate-400 focus:border-[#5254f6] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#5254f6] transition duration-150"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex w-full justify-center rounded-full bg-[#5254f6] hover:bg-[#4343db] py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/25 focus:outline-none disabled:opacity-50 transition duration-150 cursor-pointer"
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
      <div className="text-center text-xs font-semibold text-slate-400 pt-2">
        <span>Already have an account? </span>
        <Link to="/login" className="text-[#5254f6] font-extrabold hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );

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

        {/* Right Side: Form / Success Card */}
        {success ? successContent : formContent}

      </div>
    </div>
  );
};

export default RegisterPage;
