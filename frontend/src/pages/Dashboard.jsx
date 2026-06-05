import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Shield, ShieldAlert, LogOut, Monitor, ShieldCheck, History, Clock, Key, QrCode } from 'lucide-react';
import { logout, enableMfaSuccess } from '../store/authSlice';
import api from '../services/api';

const Dashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState('');

  // MFA setup states
  const [setupActive, setSetupActive] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

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

  const startMfaSetup = async () => {
    setMfaError('');
    setMfaSuccess('');
    setMfaLoading(true);
    try {
      const response = await api.post('/auth/mfa/setup');
      setQrCodeUrl(response.data.qrCodeUrl);
      setSecretKey(response.data.secret);
      setSetupActive(true);
    } catch (err) {
      setMfaError(err.response?.data?.error || 'Failed to initialize MFA setup.');
    } finally {
      setMfaLoading(false);
    }
  };

  const confirmMfaEnable = async (e) => {
    e.preventDefault();
    setMfaError('');
    setMfaSuccess('');

    if (!mfaCode.trim()) {
      return setMfaError('Please enter the 6-digit code from your app.');
    }

    setMfaLoading(true);
    try {
      await api.post('/auth/mfa/enable', { token: mfaCode.trim() });
      dispatch(enableMfaSuccess());
      setMfaSuccess('MFA activated successfully! Your account is now secured.');
      setSetupActive(false);
      setMfaCode('');
    } catch (err) {
      setMfaError(err.response?.data?.error || 'Verification code failed. Try again.');
    } finally {
      setMfaLoading(false);
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-[calc(100vh-4rem)]">
      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          
          {/* User Profile & Security Settings Card */}
          <div className="md:col-span-1 space-y-8">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
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
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">MFA Status:</span>
                  {user?.mfaEnabled ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full font-semibold">
                      <ShieldCheck className="h-3.5 w-3.5" /> Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full font-semibold">
                      <ShieldAlert className="h-3.5 w-3.5" /> Disabled
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* MFA Action Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-xl shadow-xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="h-5 w-5 text-brand-400" /> Multi-Factor Auth
              </h3>
              
              {mfaSuccess && (
                <div className="mt-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-400">
                  {mfaSuccess}
                </div>
              )}
              {mfaError && (
                <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-400">
                  {mfaError}
                </div>
              )}

              {user?.mfaEnabled ? (
                <p className="mt-4 text-sm text-slate-400">
                  Your login sessions are fully protected with 2FA authenticator codes.
                </p>
              ) : setupActive ? (
                <form onSubmit={confirmMfaEnable} className="mt-4 space-y-4">
                  <p className="text-xs text-slate-400">
                    Scan this QR code in Google Authenticator or Authy, then enter the code.
                  </p>
                  
                  {qrCodeUrl && (
                    <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-lg bg-white p-2">
                      <img src={qrCodeUrl} alt="MFA QR Code" className="h-full w-full" />
                    </div>
                  )}

                  <div className="text-center">
                    <span className="text-[10px] text-slate-500 block">Secret key for manual entry:</span>
                    <code className="text-xs font-mono select-all text-slate-300 bg-slate-950 px-2 py-0.5 rounded">{secretKey}</code>
                  </div>

                  <div>
                    <input
                      type="text"
                      required
                      placeholder="000000"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                      className="block w-full rounded-lg border border-slate-700 bg-slate-950 py-2 text-center text-lg font-bold tracking-widest text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSetupActive(false)}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-800 text-xs font-semibold py-2 hover:bg-slate-750"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={mfaLoading}
                      className="flex-1 rounded-lg bg-emerald-600 text-xs font-semibold py-2 hover:bg-emerald-500 text-white"
                    >
                      {mfaLoading ? 'Activating...' : 'Verify & Enable'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-4">
                  <p className="text-xs text-slate-400 mb-4">
                    Add an extra layer of security by requiring a 6-digit OTP code on login.
                  </p>
                  <button
                    onClick={startMfaSetup}
                    disabled={mfaLoading}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 py-2.5 text-xs font-semibold text-white shadow"
                  >
                    <QrCode className="h-4 w-4" /> Setup Google Authenticator
                  </button>
                </div>
              )}
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
                      <div className="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold">
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
