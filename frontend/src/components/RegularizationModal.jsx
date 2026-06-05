import React, { useState } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import api from '../services/api';

const RegularizationModal = ({ isOpen, onClose, onSuccess }) => {
  const [date, setDate] = useState('');
  const [timeIn, setTimeIn] = useState('09:00');
  const [timeOut, setTimeOut] = useState('17:00');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!date || !timeIn || !timeOut || !reason.trim()) {
      alert('Please fill out all fields.');
      return;
    }

    const tIn = new Date(`${date}T${timeIn}:00`);
    const tOut = new Date(`${date}T${timeOut}:00`);

    if (tIn >= tOut) {
      alert('Clock-in time must be before clock-out time.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/attendance/regularize', {
        date,
        requestedTimeIn: tIn.toISOString(),
        requestedTimeOut: tOut.toISOString(),
        reason,
      });

      alert(response.data.message || 'Regularization request submitted.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit regularization request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl relative animate-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent mb-1 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-teal-400" /> Attendance Regularization
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          Request corrections for missed punches or log adjustments for a specific work day.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Select Date</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 text-sm cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Corrected Time In</label>
              <div className="relative">
                <input
                  type="time"
                  required
                  value={timeIn}
                  onChange={(e) => setTimeIn(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 text-sm cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Corrected Time Out</label>
              <div className="relative">
                <input
                  type="time"
                  required
                  value={timeOut}
                  onChange={(e) => setTimeOut(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 text-sm cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Justification / Reason</label>
            <textarea
              rows="3"
              required
              placeholder="e.g. Card check-out failure, client meeting outside office, forgot to punch..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-slate-200 outline-none focus:border-teal-500/50 text-xs resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-slate-850 hover:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 px-5 py-2.5 text-xs font-bold text-black shadow-lg shadow-teal-500/10 transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegularizationModal;
