import React, { useState, useEffect } from 'react';
import { Mail, BellRing, Smartphone, ClipboardCheck, Save } from 'lucide-react';
import api from '../services/api';

const NotificationPreferences = () => {
  const [email, setEmail] = useState(true);
  const [inApp, setInApp] = useState(true);
  const [push, setPush] = useState(true);
  const [digestEnabled, setDigestEnabled] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await api.get('/notifications/preferences');
      if (res.data) {
        setEmail(res.data.email ?? true);
        setInApp(res.data.inApp ?? true);
        setPush(res.data.push ?? true);
        setDigestEnabled(res.data.digestEnabled ?? false);
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
      setError('Could not retrieve preference configurations.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await api.put('/notifications/preferences', {
        email,
        inApp,
        push,
        digestEnabled,
      });
      setMessage(res.data?.message || 'Notification channels updated successfully.');
      if (res.data?.preferences) {
        setEmail(res.data.preferences.email);
        setInApp(res.data.preferences.inApp);
        setPush(res.data.preferences.push);
        setDigestEnabled(res.data.preferences.digestEnabled);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user preferences.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 md:p-8 backdrop-blur-md shadow-lg space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <BellRing className="h-6 w-6 text-teal-400" />
            Notification Channels & Preferences
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Toggle where you want to receive alerts for leave submissions, punch approvals, weekly summaries, and SLA breach escalations.
          </p>
        </div>

        {message && (
          <div className="rounded-xl border border-teal-500/20 bg-teal-500/10 p-4 text-sm text-teal-300">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="divide-y divide-slate-850">
            {/* Email Channel */}
            <div className="flex items-center justify-between py-4.5">
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-200">Email Alerts</span>
                  <span className="block text-xs text-slate-450 text-slate-500 mt-1 leading-normal">
                    Receive immediate messages directly to your registered work email.
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={email}
                  onChange={(e) => setEmail(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500 peer-checked:after:bg-slate-950"></div>
              </label>
            </div>

            {/* In-App Channel */}
            <div className="flex items-center justify-between py-4.5">
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-slate-400">
                  <BellRing className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-200">In-App Alerts Feed</span>
                  <span className="block text-xs text-slate-450 text-slate-500 mt-1 leading-normal">
                    Display unread indicators and log alerts in the navigation bar bell dropdown.
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={inApp}
                  onChange={(e) => setInApp(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500 peer-checked:after:bg-slate-950"></div>
              </label>
            </div>

            {/* Push Channel */}
            <div className="flex items-center justify-between py-4.5">
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-slate-400">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-200">Browser Push Alerts</span>
                  <span className="block text-xs text-slate-450 text-slate-500 mt-1 leading-normal">
                    Deliver native popups even when the HRMS portal is hidden in a background tab.
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={push}
                  onChange={(e) => setPush(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500 peer-checked:after:bg-slate-950"></div>
              </label>
            </div>

            {/* Daily Digests */}
            <div className="flex items-center justify-between py-4.5">
              <div className="flex items-start gap-3.5">
                <div className="mt-0.5 rounded-lg bg-slate-900 border border-slate-800 p-2.5 text-slate-400">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-slate-200">Email Summaries (Digest)</span>
                  <span className="block text-xs text-slate-450 text-slate-500 mt-1 leading-normal">
                    Combine non-security notifications into a single summary report email.
                  </span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={digestEnabled}
                  onChange={(e) => setDigestEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500 peer-checked:after:bg-slate-950"></div>
              </label>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 px-6 py-3 font-bold text-black shadow-lg shadow-teal-500/10 transition cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Updating...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NotificationPreferences;
