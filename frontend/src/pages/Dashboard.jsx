import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Shield, ShieldAlert, LogOut, Monitor, ShieldCheck, History, Clock } from 'lucide-react';
import { logout } from '../store/authSlice';
import api from '../services/api';

const Dashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setSessionLoading(true);
    setSessionError('');
    try {
      const response = await api.get('/auth/sessions');
      setSessions(response.data.sessions);
    } catch (err) {
      setSessionError('Failed to fetch active session history.');
    } finally {
      setSessionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error('API logout failed:', err);
    } finally {
      dispatch(logout());
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 font-bold text-white shadow-lg shadow-brand-500/20">
                HR
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                HRMS <span className="text-brand-400">Platform</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-slate-400 sm:inline-block">
                Workspace ID: <span className="font-mono text-slate-300">{user?.tenantId}</span>
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3.5 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition duration-200"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* User Profile Card */}
          <div className="md:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
            <div className="flex flex-col items-center text-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-xl">
                <span className="text-3xl font-bold uppercase">{user?.email[0]}</span>
                <span className="absolute bottom-0 right-0 rounded-full bg-emerald-500 p-1.5 border-2 border-slate-900"></span>
              </div>
              <h3 className="mt-4 text-xl font-bold text-white">{user?.email}</h3>
              
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-400">
                <Shield className="h-3.5 w-3.5" />
                {user?.role}
              </div>
            </div>

            <div className="mt-8 space-y-4 border-t border-slate-800 pt-6 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Security Context:</span>
                <span className="font-semibold text-slate-200">JWT Scoped</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Multi-Tenancy:</span>
                <span className="font-semibold text-emerald-400">Tenant Isolated</span>
              </div>
            </div>
          </div>

          {/* Sessions & Security Auditing Card */}
          <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <History className="h-5 w-5 text-brand-400" />
                <h3 className="text-lg font-bold text-white">Active Login Sessions</h3>
              </div>
              <button
                onClick={fetchSessions}
                className="text-xs font-medium text-brand-400 hover:text-brand-300 hover:underline"
              >
                Refresh Log
              </button>
            </div>

            {sessionLoading ? (
              <div className="flex h-48 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></div>
              </div>
            ) : sessionError ? (
              <div className="mt-4 rounded-lg bg-red-500/10 p-4 text-sm text-red-400">
                {sessionError}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {sessions.map((session, idx) => (
                  <div
                    key={session.id || idx}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/40 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                        <Monitor className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {session.ip === '::1' || session.ip === '127.0.0.1' ? 'Local Machine' : session.ip}
                        </p>
                        <p className="max-w-[280px] truncate text-xs text-slate-500 sm:max-w-md">
                          {session.userAgent}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        <Clock className="h-3 w-3" /> Active
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Expires: {new Date(session.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
