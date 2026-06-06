import React, { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import RegularizationModal from './RegularizationModal';

const AttendanceWidget = () => {
  const [time, setTime] = useState(new Date());
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch today's attendance record
  useEffect(() => {
    fetchTodayRecord();
  }, []);

  const fetchTodayRecord = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get('/attendance/today', { params: { date: today } });
      setAttendance(response.data);
    } catch (err) {
      console.error('Failed to load today\'s attendance status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePunch = async () => {
    setPunching(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Optional: fetch browser location if permitted
      let location = null;
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          location = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
        } catch (e) {
          console.warn('Geolocation access failed/timed out, punching without coordinates.');
        }
      }

      const response = await api.post('/attendance/punch', {
        date: today,
        time: new Date().toISOString(),
        location,
      });

      alert(response.data.message);
      setAttendance(response.data.record);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to complete punch action.');
    } finally {
      setPunching(false);
    }
  };

  const formatClock = (d) => {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const isClockedIn = attendance && attendance.punches && attendance.punches.length > 0 && 
                      attendance.punches[attendance.punches.length - 1].type === 'IN';

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PRESENT':
        return <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">Present</span>;
      case 'LATE':
        return <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">Late Check-in</span>;
      case 'HALF_DAY':
        return <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">Half Day</span>;
      case 'WEEKLY_OFF':
        return <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200">Weekly Off</span>;
      case 'HOLIDAY':
        return <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">Holiday</span>;
      case 'REGULARIZED':
        return <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 border border-teal-200">Regularized</span>;
      default:
        return <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">Absent</span>;
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex items-center justify-center h-48">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg space-y-4 text-slate-850">
      {/* Live Timer Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-slate-950 animate-pulse" />
          <span className="text-sm font-semibold text-slate-800">Attendance Portal</span>
        </div>
        <span className="font-mono text-lg font-bold text-slate-950 tracking-wider">
          {formatClock(time)}
        </span>
      </div>

      {/* Main Punch Action Interface */}
      <div className="flex flex-col items-center justify-center py-4 space-y-3">
        <button
          onClick={handlePunch}
          disabled={punching}
          className={`group relative flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 shadow-xl transition-all duration-300 cursor-pointer disabled:opacity-50 ${
            isClockedIn
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 hover:scale-105'
              : 'border-slate-950/40 bg-slate-50 text-slate-950 hover:bg-slate-100 hover:scale-105'
          }`}
        >
          {isClockedIn ? (
            <>
              <LogOut className="h-7 w-7 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Clock Out</span>
            </>
          ) : (
            <>
              <LogIn className="h-7 w-7 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Clock In</span>
            </>
          )}
        </button>

        <div className="text-center">
          <span className="text-xs text-slate-500 block">Today's Status</span>
          <div className="mt-1">{getStatusBadge(attendance?.status || 'ABSENT')}</div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-2 text-[10px] text-slate-950 hover:underline cursor-pointer block mx-auto font-bold"
          >
            Request Correction / Regularize
          </button>
        </div>
      </div>

      {/* Shift Metrics Info */}
      {attendance && attendance.totalWorkMinutes > 0 && (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 border border-slate-150 text-xs font-mono text-center">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-sans">Worked Duration</span>
            <strong className="text-slate-800 block mt-0.5">
              {Math.floor(attendance.totalWorkMinutes / 60)}h {attendance.totalWorkMinutes % 60}m
            </strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block uppercase font-sans">Overtime</span>
            <strong className="text-slate-950 block mt-0.5">
              {Math.floor(attendance.overtimeMinutes / 60)}h {attendance.overtimeMinutes % 60}m
            </strong>
          </div>
        </div>
      )}

      {/* Daily Punch Logs list */}
      <div className="space-y-2">
        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Punch Log Records</span>
        {!attendance || !attendance.punches || attendance.punches.length === 0 ? (
          <span className="block text-xs text-slate-500 italic p-2 bg-slate-50 rounded-lg text-center border border-slate-150">
            No punch logs logged for today.
          </span>
        ) : (
          <div className="max-h-24 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
            {attendance.punches.map((p, idx) => (
              <div
                key={p._id || idx}
                className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-150 hover:border-slate-200 transition font-mono text-slate-700"
              >
                <span className={`font-semibold ${p.type === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {p.type === 'IN' ? 'Clocked In' : 'Clocked Out'}
                </span>
                <span>
                  {new Date(p.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <RegularizationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchTodayRecord}
      />
    </div>
  );
};

export default AttendanceWidget;
