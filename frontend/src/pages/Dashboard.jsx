import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { LogOut, Monitor, History, Clock } from 'lucide-react';
import { logout } from '../store/authSlice';
import api from '../services/api';
import AttendanceWidget from '../components/AttendanceWidget';
import { useToast } from '../context/ToastContext';

const Dashboard = () => {
  const { showToast } = useToast();
  const [sessions, setSessions] = useState([]);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState('');

  // Attendance Regularization states
  const [pendingRegularizations, setPendingRegularizations] = useState([]);
  const [regLoading, setRegLoading] = useState(false);
  const [reviewComments, setReviewComments] = useState({});

  // Leave approval states
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [reviewLeaveComments, setReviewLeaveComments] = useState({});

  // Active approvals sub-tab
  const [activeApprovalTab, setActiveApprovalTab] = useState('attendance'); // 'attendance' or 'leaves'

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    fetchSessions();
    if (user?.role === 'MANAGER' || user?.role === 'HR_ADMIN') {
      fetchPendingRegularizations();
      fetchPendingLeaves();
    }
  }, [user]);

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

  const fetchPendingRegularizations = async () => {
    setRegLoading(true);
    try {
      const response = await api.get('/attendance/regularize/pending');
      setPendingRegularizations(response.data);
    } catch (err) {
      console.error('Failed to load pending regularizations:', err);
    } finally {
      setRegLoading(false);
    }
  };

  const fetchPendingLeaves = async () => {
    setLeavesLoading(true);
    try {
      const response = await api.get('/leaves/pending');
      setPendingLeaves(response.data);
    } catch (err) {
      console.error('Failed to load pending leaves:', err);
    } finally {
      setLeavesLoading(false);
    }
  };

  const handleReviewRegularization = async (recordId, action) => {
    const comment = reviewComments[recordId] || '';
    try {
      const response = await api.post(`/attendance/regularize/${recordId}/review`, { action, comment });
      showToast(response.data.message, 'success');
      fetchPendingRegularizations();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit review action.', 'error');
    }
  };

  const handleReviewLeave = async (id, action) => {
    const comment = reviewLeaveComments[id] || '';
    try {
      const response = await api.post(`/leaves/requests/${id}/review`, { action, comment });
      showToast(response.data.message, 'success');
      setReviewLeaveComments(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      fetchPendingLeaves();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to submit review action.', 'error');
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
    <div className="bg-slate-50 text-slate-900 min-h-[calc(100vh-4rem)]">
      {/* Attendance Portal */}
      <AttendanceWidget />

      {/* Main Container */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">





        {/* Unified Team Approvals Center (Managers & Admins only) */}
        {(user?.role === 'MANAGER' || user?.role === 'HR_ADMIN') && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-5 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <History className="h-5 w-5 text-slate-950" />
                <h3 className="text-lg font-bold text-slate-950">Team Approvals Center</h3>
              </div>
              <button
                onClick={() => { fetchPendingRegularizations(); fetchPendingLeaves(); }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-950 transition flex items-center gap-1 cursor-pointer"
              >
                Refresh Queues
              </button>
            </div>

            {/* Sub-tab navigation */}
            <div className="flex border-b border-slate-200 gap-4 text-xs font-bold uppercase tracking-wider">
              <button
                onClick={() => setActiveApprovalTab('attendance')}
                className={`pb-2 transition border-b-2 cursor-pointer ${
                  activeApprovalTab === 'attendance' ? 'border-slate-950 text-slate-950 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Attendance Corrections ({pendingRegularizations.length})
              </button>
              <button
                onClick={() => setActiveApprovalTab('leaves')}
                className={`pb-2 transition border-b-2 cursor-pointer ${
                  activeApprovalTab === 'leaves' ? 'border-slate-950 text-slate-950 font-bold' : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Leave Requests ({pendingLeaves.length})
              </button>
            </div>

            {/* Tab 1: Attendance Corrections */}
            {activeApprovalTab === 'attendance' && (
              <div>
                {regLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-955 border-t-transparent"></div>
                  </div>
                ) : pendingRegularizations.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
                    No pending attendance corrections to review.
                  </p>
                ) : (
                  <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                    {pendingRegularizations.map((rec) => (
                      <div key={rec._id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 text-sm">
                        <div className="flex justify-between border-b border-slate-150 pb-2">
                          <div>
                            <strong className="text-slate-900 block">
                              {rec.employeeId?.personal?.firstName} {rec.employeeId?.personal?.lastName}
                            </strong>
                            <span className="text-[10px] text-slate-500 font-mono uppercase">Date: {rec.date}</span>
                          </div>
                          <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700 uppercase tracking-wide h-fit font-mono">
                            Pending Correction
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-white p-2.5 rounded-lg border border-slate-200">
                          <div>
                            <span className="text-[9px] text-slate-500 block font-sans">PROPOSED IN</span>
                            <span className="text-slate-800">
                              {new Date(rec.regularization.requestedTimeIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block font-sans">PROPOSED OUT</span>
                            <span className="text-slate-800">
                              {new Date(rec.regularization.requestedTimeOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-650 bg-white p-2 rounded-lg border border-slate-200">
                          <strong className="text-slate-800 block text-[10px] uppercase font-sans mb-1">Reason:</strong>
                          {rec.regularization.reason}
                        </div>

                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            placeholder="Add review feedback/comments (optional)..."
                            value={reviewComments[rec._id] || ''}
                            onChange={(e) => setReviewComments({
                              ...reviewComments,
                              [rec._id]: e.target.value
                            })}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                          />
                          <div className="flex justify-end gap-2 text-xs font-bold">
                            <button
                              onClick={() => handleReviewRegularization(rec._id, 'REJECT')}
                              className="rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 text-rose-700 transition cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleReviewRegularization(rec._id, 'APPROVE')}
                              className="rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 text-emerald-700 transition cursor-pointer"
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Leave Requests */}
            {activeApprovalTab === 'leaves' && (
              <div>
                {leavesLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-955 border-t-transparent"></div>
                  </div>
                ) : pendingLeaves.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
                    No pending team leave requests to review.
                  </p>
                ) : (
                  <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
                    {pendingLeaves.map((req) => {
                      const empName = `${req.employeeId?.personal?.firstName} ${req.employeeId?.personal?.lastName}`;
                      return (
                        <div key={req._id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3 text-sm">
                          <div className="flex justify-between border-b border-slate-150 pb-2">
                            <div>
                              <strong className="text-slate-900 block">{empName}</strong>
                              <span className="text-[10px] text-slate-500 font-mono uppercase">
                                {req.leaveTypeId?.code || 'LEAVE'} &bull; {req.totalDays} {req.totalDays === 1 ? 'Day' : 'Days'}
                              </span>
                            </div>
                            <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 uppercase tracking-wide h-fit font-mono">
                              Pending Leave
                            </span>
                          </div>

                          <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 space-y-1.5">
                            <p><strong>Timeline:</strong> <span className="font-mono">{req.startDate} to {req.endDate}</span> {req.halfDay && `(Half-Day ${req.halfDaySession})`}</p>
                            {req.lopDays > 0 && (
                              <p className="text-rose-700 font-bold">Includes {req.lopDays} Loss of Pay (LOP) days.</p>
                            )}
                          </div>

                          <div className="text-xs text-slate-650 bg-white p-2 rounded-lg border border-slate-200">
                            <strong className="text-slate-800 block text-[10px] uppercase font-sans mb-1">Reason:</strong>
                            {req.reason}
                          </div>

                          <div className="space-y-2 pt-1">
                            <input
                              type="text"
                              placeholder="Add review feedback/comments (optional)..."
                              value={reviewLeaveComments[req._id] || ''}
                              onChange={(e) => setReviewLeaveComments({
                                ...reviewLeaveComments,
                                [req._id]: e.target.value
                              })}
                              className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
                            />
                            <div className="flex justify-end gap-2 text-xs font-bold">
                              <button
                                onClick={() => handleReviewLeave(req._id, 'REJECT')}
                                className="rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 text-rose-700 transition cursor-pointer"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleReviewLeave(req._id, 'APPROVE')}
                                className="rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 text-emerald-700 transition cursor-pointer"
                              >
                                Approve
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sessions & Security Auditing Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl text-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <History className="h-5 w-5 text-slate-950" />
              <h3 className="text-lg font-bold text-slate-950">Active Login Sessions</h3>
            </div>
            <button
              onClick={fetchSessions}
              className="text-xs font-bold text-slate-600 hover:text-slate-950 hover:underline transition cursor-pointer"
            >
              Refresh Log
            </button>
          </div>

          {sessionLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-950 border-t-transparent"></div>
            </div>
          ) : sessionError ? (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {sessionError}
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {sessions.map((session, idx) => (
                <div
                  key={session.id || idx}
                  className="flex items-center justify-between rounded-xl border border-slate-150 bg-slate-50 p-4 hover:border-slate-200 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      <Monitor className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {session.ip === '::1' || session.ip === '127.0.0.1' ? 'Local Machine' : session.ip}
                      </p>
                      <p className="max-w-[280px] truncate text-xs text-slate-500 sm:max-w-md">
                        {session.userAgent}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                      <Clock className="h-3 w-3" /> Active
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500 font-mono">
                      Expires: {new Date(session.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

export default Dashboard;
