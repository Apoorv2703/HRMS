import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-2xl text-slate-850">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-200">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h2 className="text-2xl font-bold text-slate-950">Access Denied (403)</h2>
        <p className="text-slate-500">
          You do not have the required role permissions to access this directory or module.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex w-full justify-center rounded-lg bg-slate-950 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-slate-850 focus:outline-none transition cursor-pointer"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};

export default Unauthorized;
