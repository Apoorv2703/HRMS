import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center backdrop-blur-xl shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold text-white">Access Denied (403)</h2>
        <p className="text-slate-400">
          You do not have the required role permissions to access this directory or module.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex w-full justify-center rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-slate-950 shadow-lg hover:bg-brand-500 focus:outline-none"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;
