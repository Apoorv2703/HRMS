import React, { useState, useEffect } from 'react';
import { ShieldCheck, Calendar, UserCheck, Trash2, UserPlus, AlertCircle } from 'lucide-react';
import api from '../services/api';

const DelegationSettings = () => {
  const [colleagues, setColleagues] = useState([]);
  const [delegations, setDelegations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Form states
  const [delegateeId, setDelegateeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchActiveDelegations();
    fetchColleagues();
  }, []);

  const fetchActiveDelegations = async () => {
    try {
      const res = await api.get('/workflows/delegate/active');
      setDelegations(res.data || []);
    } catch (err) {
      console.error('Failed to load active delegation rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchColleagues = async () => {
    try {
      const res = await api.get('/employees', { params: { limit: 150 } });
      const list = res.data?.employees || [];
      // Filter out duplicate or empty user accounts, and make sure user exists
      const validColleagues = list.filter(emp => emp.userId && emp.userId._id);
      setColleagues(validColleagues);
    } catch (err) {
      console.error('Failed to retrieve colleagues list:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!delegateeId || !startDate || !endDate) {
      setError('Please fill in all delegation parameters.');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date cannot be after the end date.');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await api.post('/workflows/delegate', {
        delegateeId,
        startDate,
        endDate
      });

      setMessage(res.data?.message || 'Delegation rule configured successfully.');
      setDelegateeId('');
      setStartDate('');
      setEndDate('');
      fetchActiveDelegations();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit delegation request.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure you want to deactivate your active delegation settings?')) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const res = await api.post('/workflows/delegate', { deactivate: true });
      setMessage(res.data?.message || 'Delegations deactivated successfully.');
      fetchActiveDelegations();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to deactivate delegations.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-6 md:p-8 backdrop-blur-md shadow-lg space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-teal-400" />
            Approval Delegation Settings
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Delegate your approval authority to a colleague during a planned vacation or absence. Pending requests will automatically route to them.
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

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Create Delegation Rule */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6 space-y-4">
            <h3 className="text-sm font-bold text-teal-400 border-b border-slate-850 pb-2 flex items-center gap-2">
              <UserPlus className="h-4.5 w-4.5" /> Setup Delegation
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Select Delegate Colleagues
                </label>
                <select
                  value={delegateeId}
                  onChange={(e) => setDelegateeId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 cursor-pointer"
                >
                  <option value="">-- Choose a Colleague --</option>
                  {colleagues.map((col) => (
                    <option key={col._id} value={col.userId._id}>
                      {col.personal?.firstName} {col.personal?.lastName} ({col.userId?.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitLoading}
                className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 text-sm font-bold text-black py-3 shadow-lg shadow-teal-500/10 transition cursor-pointer"
              >
                {submitLoading ? 'Registering...' : 'Delegate Approval Authority'}
              </button>
            </form>
          </div>

          {/* Active Delegation Rule Status */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-6 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-teal-400 border-b border-slate-850 pb-2 flex items-center gap-2">
                <UserCheck className="h-4.5 w-4.5" /> Active Delegation Status
              </h3>

              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent"></div>
                </div>
              ) : delegations.length === 0 ? (
                <div className="rounded-xl border border-slate-850 bg-slate-900/10 p-6 text-center text-slate-400">
                  <AlertCircle className="mx-auto mb-2 h-8 w-8 text-slate-500" />
                  <p className="font-semibold text-sm">No Active Delegations</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Your approval tasks will route normally to you.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {delegations.map((d) => (
                    <div
                      key={d._id}
                      className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-4 space-y-2 border-l-4 border-l-teal-500"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400">
                            DELEGATED TO
                          </span>
                          <span className="text-sm font-bold text-slate-200">
                            {d.delegateeId?.email || 'Colleague'}
                          </span>
                        </div>
                        <span className="text-[10px] text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded font-bold uppercase">
                          Active
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-2 text-xs text-slate-450">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span className="font-mono text-slate-300">
                          {new Date(d.startDate).toLocaleDateString()}
                        </span>
                        <span className="text-slate-500">to</span>
                        <span className="font-mono text-slate-300">
                          {new Date(d.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {delegations.length > 0 && (
              <button
                type="button"
                onClick={handleDeactivate}
                className="w-full mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 hover:text-black py-3 text-xs font-bold text-rose-455 text-rose-400 transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" /> Deactivate Delegation Settings
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DelegationSettings;
