import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Calendar, Clock, UserCheck, UserX, AlertCircle, PlusCircle, CheckCircle2, ListTodo, Settings, Briefcase, RefreshCw, BadgeAlert, ShieldCheck } from 'lucide-react';
import api from '../services/api';

const STATUS_BADGES = {
  PENDING: { label: 'Pending Review', color: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
  APPROVED: { label: 'Approved', color: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
  REJECTED: { label: 'Rejected', color: 'bg-rose-500/10 border-rose-500/20 text-rose-400' },
  CANCELLED: { label: 'Cancelled', color: 'bg-slate-800/40 border-slate-800 text-slate-500' },
};

const LeaveDashboardPage = () => {
  const { user } = useSelector((state) => state.auth);

  const [activeTab, setActiveTab] = useState('my-leaves'); // 'my-leaves', 'approvals', 'hr-config'
  
  // Data States
  const [balances, setBalances] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  // Apply Request form states
  const [applyType, setApplyType] = useState('');
  const [applyStart, setApplyStart] = useState('');
  const [applyEnd, setApplyEnd] = useState('');
  const [applyHalfDay, setApplyHalfDay] = useState(false);
  const [applyHalfDaySession, setApplyHalfDaySession] = useState('MORNING');
  const [applyReason, setApplyReason] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  
  // HR Leave Type policy states
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCode, setNewTypeCode] = useState('');
  const [newTypeEntitled, setNewTypeEntitled] = useState(12);
  const [newTypeHalfDay, setNewTypeHalfDay] = useState(true);
  const [newTypeNegative, setNewTypeNegative] = useState(false);
  const [newTypeCarry, setNewTypeCarry] = useState(0);
  const [policyLoading, setPolicyLoading] = useState(false);
  
  // HR Manual adjustment states
  const [adjEmpId, setAdjEmpId] = useState('');
  const [adjTypeId, setAdjTypeId] = useState('');
  const [adjAction, setAdjAction] = useState('CREDIT');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjLoading, setAdjLoading] = useState(false);

  // SAML configuration states
  const [samlEnabled, setSamlEnabled] = useState(false);
  const [samlEntryPoint, setSamlEntryPoint] = useState('');
  const [samlIssuer, setSamlIssuer] = useState('');
  const [samlCert, setSamlCert] = useState('');
  const [samlLoading, setSamlLoading] = useState(false);

  // Review comment state
  const [reviewComments, setReviewComments] = useState({});
  const [reviewLoading, setReviewLoading] = useState({});

  // General UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);

  useEffect(() => {
    fetchUserData();
    if (user?.role === 'HR_ADMIN' || user?.role === 'MANAGER') {
      fetchManagerData();
    }
    if (user?.role === 'HR_ADMIN') {
      fetchAdminData();
    }
  }, [user]);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const balanceRes = await api.get('/leaves/balances');
      setBalances(balanceRes.data || []);

      const requestsRes = await api.get('/leaves/my-requests');
      setMyRequests(requestsRes.data || []);

      const typesRes = await api.get('/leaves/types');
      setLeaveTypes(typesRes.data || []);
    } catch (err) {
      console.error(err);
      setError('Failed to retrieve user leave records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchManagerData = async () => {
    try {
      const pendingRes = await api.get('/leaves/pending');
      setPendingRequests(pendingRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminData = async () => {
    try {
      const empRes = await api.get('/employees', { params: { limit: 100 } });
      setEmployees(empRes.data.employees || []);

      // Fetch active SAML config
      const subdomain = localStorage.getItem('workspaceSubdomain');
      if (subdomain) {
        const ssoRes = await api.get('/auth/sso-config', { params: { subdomain } });
        setSamlEnabled(ssoRes.data.samlEnabled || false);
        setSamlEntryPoint(ssoRes.data.samlEntryPoint || '');
        setSamlIssuer(ssoRes.data.samlIssuer || '');
        setSamlCert(ssoRes.data.samlCert || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateSamlConfig = async (e) => {
    e.preventDefault();
    setSamlLoading(true);
    try {
      const response = await api.put('/auth/sso-config/saml', {
        enabled: samlEnabled,
        entryPoint: samlEntryPoint,
        issuer: samlIssuer,
        cert: samlCert,
      });
      alert(response.data.message || 'SAML settings updated successfully.');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update SAML configuration.');
    } finally {
      setSamlLoading(false);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    if (!applyType || !applyStart || !applyEnd || !applyReason) {
      alert('Please fill out all required fields.');
      return;
    }
    setApplyLoading(true);
    try {
      const response = await api.post('/leaves/apply', {
        leaveTypeId: applyType,
        startDate: applyStart,
        endDate: applyEnd,
        halfDay: applyHalfDay,
        halfDaySession: applyHalfDay ? applyHalfDaySession : null,
        reason: applyReason,
      });
      alert(response.data.message || 'Leave requested successfully.');
      setShowApplyModal(false);
      
      // Reset form
      setApplyType('');
      setApplyStart('');
      setApplyEnd('');
      setApplyHalfDay(false);
      setApplyReason('');

      // Reload
      fetchUserData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit leave application.');
    } finally {
      setApplyLoading(false);
    }
  };

  const handleCancelLeave = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      const response = await api.post(`/leaves/requests/${id}/cancel`);
      alert(response.data.message || 'Leave request cancelled successfully.');
      fetchUserData();
      if (user?.role === 'HR_ADMIN' || user?.role === 'MANAGER') {
        fetchManagerData();
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel request.');
    }
  };

  const handleReviewRequest = async (id, action) => {
    const comment = reviewComments[id] || '';
    setReviewLoading(prev => ({ ...prev, [id]: true }));
    try {
      const response = await api.post(`/leaves/requests/${id}/review`, { action, comment });
      alert(response.data.message || `Leave request successfully ${action.toLowerCase()}d.`);
      
      // Clear review input state
      setReviewComments(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      // Reload data queues
      fetchUserData();
      fetchManagerData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to review request.');
    } finally {
      setReviewLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleCreatePolicy = async (e) => {
    e.preventDefault();
    if (!newTypeName || !newTypeCode) {
      alert('Name and Code are required.');
      return;
    }
    setPolicyLoading(true);
    try {
      const response = await api.post('/leaves/types', {
        name: newTypeName,
        code: newTypeCode.toUpperCase(),
        annualEntitlement: newTypeEntitled,
        allowHalfDay: newTypeHalfDay,
        allowNegativeBalance: newTypeNegative,
        carryForwardLimit: newTypeCarry,
      });
      alert(response.data.message || 'Leave policy created successfully.');
      
      // Reset form
      setNewTypeName('');
      setNewTypeCode('');
      setNewTypeEntitled(12);
      setNewTypeHalfDay(true);
      setNewTypeNegative(false);
      setNewTypeCarry(0);

      // Reload
      fetchUserData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create leave policy.');
    } finally {
      setPolicyLoading(false);
    }
  };

  const handleAdjustBalance = async (e) => {
    e.preventDefault();
    if (!adjEmpId || !adjTypeId || !adjAmount || !adjReason) {
      alert('All fields are required.');
      return;
    }
    setAdjLoading(true);
    try {
      const response = await api.post('/leaves/balances/adjust', {
        employeeId: adjEmpId,
        leaveTypeId: adjTypeId,
        adjustmentType: adjAction,
        amount: adjAmount,
        reason: adjReason,
      });
      alert(response.data.message || 'Balance adjusted successfully.');

      // Reset form
      setAdjEmpId('');
      setAdjTypeId('');
      setAdjAction('CREDIT');
      setAdjAmount('');
      setAdjReason('');

      // Reload
      fetchUserData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to adjust balance.');
    } finally {
      setAdjLoading(false);
    }
  };

  return (
    <div className="bg-slate-950 text-slate-100 min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Calendar className="h-8 w-8 text-teal-400" />
              Leave Management <span className="text-teal-400 font-medium text-lg sm:text-xl"> &amp; Allowances</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Apply for time off, verify active leave balances, and review team approval queues.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { fetchUserData(); if (user?.role !== 'EMPLOYEE') fetchManagerData(); }}
              className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:text-teal-400 text-slate-400 transition"
              title="Refresh Data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowApplyModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-xs font-bold text-white px-4.5 py-2.5 transition duration-150 cursor-pointer shadow"
            >
              <PlusCircle className="h-4 w-4" /> Request Leave
            </button>
          </div>
        </div>

        {/* Error Callout */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400 flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Selection Navigation */}
        <div className="flex border-b border-slate-850 gap-4">
          <button
            onClick={() => setActiveTab('my-leaves')}
            className={`pb-2.5 text-sm font-bold tracking-wide transition-all border-b-2 cursor-pointer ${
              activeTab === 'my-leaves' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            My Leaves &amp; History
          </button>
          {(user?.role === 'MANAGER' || user?.role === 'HR_ADMIN') && (
            <button
              onClick={() => setActiveTab('approvals')}
              className={`pb-2.5 text-sm font-bold tracking-wide transition-all border-b-2 cursor-pointer relative ${
                activeTab === 'approvals' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Team Approvals
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-3 h-4 w-4 rounded-full bg-amber-500 text-[9px] font-black text-slate-950 flex items-center justify-center animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          )}
          {user?.role === 'HR_ADMIN' && (
            <button
              onClick={() => setActiveTab('hr-config')}
              className={`pb-2.5 text-sm font-bold tracking-wide transition-all border-b-2 cursor-pointer ${
                activeTab === 'hr-config' ? 'border-teal-500 text-teal-400' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Admin Controls
            </button>
          )}
        </div>

        {/* Loader */}
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
            <p className="text-sm text-slate-400">Loading leave registers...</p>
          </div>
        ) : activeTab === 'my-leaves' ? (
          
          /* ====================================================
             TAB 1: MY LEAVES & HISTORY (ESS)
             ==================================================== */
          <div className="space-y-8 animate-none">
            {/* Balance Grid Cards */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-450 text-slate-400 mb-4 flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-teal-400" /> Current Leave Balances
              </h2>
              {balances.length === 0 ? (
                <div className="rounded-2xl border border-slate-850 bg-slate-900/10 p-6 text-center text-slate-500 italic">
                  No active leave balances allocated to your profile.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {balances.map((bal) => {
                    const available = bal.allocated + bal.carriedForward - bal.used - bal.pendingApproval;
                    return (
                      <div key={bal._id} className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur shadow hover:border-slate-700 transition">
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-full inline-block mb-3">
                          {bal.leaveTypeId?.code || 'LEAVE'}
                        </span>
                        <h3 className="text-base font-bold text-slate-100">{bal.leaveTypeId?.name}</h3>
                        <div className="mt-4 flex items-baseline justify-between border-t border-slate-800/60 pt-3">
                          <div>
                            <span className="text-2xl font-black text-white">{available}</span>
                            <span className="text-[10px] text-slate-500 ml-1">days free</span>
                          </div>
                          <div className="text-right text-xs text-slate-400">
                            <p>Allocated: {bal.allocated + bal.carriedForward}</p>
                            <p>Taken: {bal.used} | Locked: {bal.pendingApproval}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* My Request History Table */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-teal-400" /> Leave Application Timeline
              </h2>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-xl shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold text-xs uppercase font-mono tracking-wider">
                      <tr>
                        <th className="px-6 py-3">Leave Type</th>
                        <th className="px-6 py-3">Duration Dates</th>
                        <th className="px-6 py-3 text-center">Net Working Days</th>
                        <th className="px-6 py-3 text-center">Loss of Pay (LOP)</th>
                        <th className="px-6 py-3">Application Reason</th>
                        <th className="px-6 py-3">Review Status</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 bg-slate-950/20">
                      {myRequests.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-500 italic bg-slate-950/10">
                            You have not submitted any leave requests yet.
                          </td>
                        </tr>
                      ) : (
                        myRequests.map((req) => {
                          const badge = STATUS_BADGES[req.status] || STATUS_BADGES.PENDING;
                          return (
                            <tr key={req._id} className="hover:bg-slate-900/40 transition">
                              <td className="px-6 py-4 font-bold text-slate-200">
                                {req.leaveTypeId?.name} ({req.leaveTypeId?.code})
                              </td>
                              <td className="px-6 py-4 text-xs font-mono text-slate-350 text-slate-300">
                                {req.startDate} to {req.endDate}
                                {req.halfDay && <span className="block text-[10px] text-teal-400 mt-0.5">Half-Day ({req.halfDaySession})</span>}
                              </td>
                              <td className="px-6 py-4 text-center font-bold text-slate-100">
                                {req.totalDays}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {req.lopDays > 0 ? (
                                  <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20">
                                    {req.lopDays} LOP
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-500">-</span>
                                )}
                              </td>
                              <td className="px-6 py-4 max-w-xs truncate text-xs text-slate-400" title={req.reason}>
                                {req.reason}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${badge.color}`}>
                                  {badge.label}
                                </span>
                                {req.approverComment && (
                                  <span className="block text-[10px] text-slate-500 mt-1 italic">
                                    Reply: {req.approverComment}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                {['PENDING', 'APPROVED'].includes(req.status) && (
                                  <button
                                    onClick={() => handleCancelLeave(req._id)}
                                    className="rounded-lg bg-slate-900 hover:bg-rose-950/20 border border-slate-800 hover:border-rose-500/30 text-[10px] font-bold text-slate-400 hover:text-rose-400 px-3 py-1.5 transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'approvals' ? (
          
          /* ====================================================
             TAB 2: TEAM APPROVALS (MANAGER/ADMIN)
             ==================================================== */
          <div className="space-y-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-450 text-slate-400 flex items-center gap-1.5">
              <ListTodo className="h-4 w-4 text-teal-400" /> Pending Leave Approvals
            </h2>
            {pendingRequests.length === 0 ? (
              <div className="rounded-2xl border border-slate-850 bg-slate-900/10 p-12 text-center text-slate-500 italic">
                No leave requests pending your review.
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {pendingRequests.map((req) => {
                  const empName = `${req.employeeId?.personal?.firstName} ${req.employeeId?.personal?.lastName}`;
                  const isLoad = reviewLoading[req._id] || false;
                  return (
                    <div key={req._id} className="rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-xl p-6 space-y-4 shadow hover:border-slate-700 transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <strong className="text-base font-bold text-white block">{empName}</strong>
                          <span className="text-[10px] text-slate-550 text-slate-500 uppercase tracking-wider">Employee ID: {req.employeeId?.employeeId}</span>
                        </div>
                        <span className="text-xs font-mono font-bold text-teal-400 bg-teal-500/10 px-3 py-1 rounded-full border border-teal-500/20">
                          {req.leaveTypeId?.code} - {req.totalDays} {req.totalDays === 1 ? 'day' : 'days'}
                        </span>
                      </div>

                      <div className="rounded-xl bg-slate-950/40 border border-slate-850 p-3.5 space-y-2 text-xs text-slate-300">
                        <p><strong>Timeline:</strong> <span className="font-mono">{req.startDate} to {req.endDate}</span> {req.halfDay && '(Half-Day)'}</p>
                        {req.lopDays > 0 && (
                          <p className="text-rose-400 font-bold flex items-center gap-1">
                            <BadgeAlert className="h-3.5 w-3.5" /> Includes {req.lopDays} Loss of Pay (LOP) days.
                          </p>
                        )}
                        <p><strong>Reason:</strong> "{req.reason}"</p>
                      </div>

                      <div className="space-y-3">
                        <textarea
                          placeholder="Add approver reply/comment (optional)..."
                          value={reviewComments[req._id] || ''}
                          onChange={(e) => setReviewComments(prev => ({ ...prev, [req._id]: e.target.value }))}
                          className="w-full rounded-xl border border-slate-800 bg-slate-950/60 text-slate-200 text-xs p-3.5 outline-none focus:border-teal-500/40 transition-colors placeholder:text-slate-650"
                          rows="2"
                        />
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleReviewRequest(req._id, 'APPROVE')}
                            disabled={isLoad}
                            className="flex-1 flex justify-center items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white py-2.5 transition duration-150 cursor-pointer disabled:opacity-50"
                          >
                            <UserCheck className="h-4 w-4" /> Approve
                          </button>
                          <button
                            onClick={() => handleReviewRequest(req._id, 'REJECT')}
                            disabled={isLoad}
                            className="flex-1 flex justify-center items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white py-2.5 transition duration-150 cursor-pointer disabled:opacity-50"
                          >
                            <UserX className="h-4 w-4" /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'hr-config' ? (
          
          /* ====================================================
             TAB 3: ADMIN CONTROLS (HR ADMIN ONLY)
             ==================================================== */
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Policy Creator Panel */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-xl p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-teal-400" /> Configure Leave Policy
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Define new leave rules and dynamically allocate initial balances to active staff.
                </p>
              </div>

              <form onSubmit={handleCreatePolicy} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Leave Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Annual Leave"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Leave Code *</label>
                    <input
                      type="text"
                      placeholder="e.g. AL"
                      value={newTypeCode}
                      onChange={(e) => setNewTypeCode(e.target.value)}
                      required
                      maxLength="5"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Annual Entitlement (Days)</label>
                    <input
                      type="number"
                      value={newTypeEntitled}
                      onChange={(e) => setNewTypeEntitled(Number(e.target.value))}
                      min="0"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Max Carry Forward (Days)</label>
                    <input
                      type="number"
                      value={newTypeCarry}
                      onChange={(e) => setNewTypeCarry(Number(e.target.value))}
                      min="0"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-800/60 pt-3">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-350 text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newTypeHalfDay}
                      onChange={(e) => setNewTypeHalfDay(e.target.checked)}
                      className="rounded border-slate-800 text-teal-600 focus:ring-teal-500 bg-slate-900"
                    />
                    Allow Half-Day Requests
                  </label>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-350 text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newTypeNegative}
                      onChange={(e) => setNewTypeNegative(e.target.checked)}
                      className="rounded border-slate-800 text-teal-600 focus:ring-teal-500 bg-slate-900"
                    />
                    Allow Unpaid Balance Deficits (LOP)
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={policyLoading}
                  className="w-full rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-sm font-bold text-white py-3 transition duration-150 cursor-pointer shadow"
                >
                  {policyLoading ? 'Creating...' : 'Create Leave Type'}
                </button>
              </form>
            </div>

            {/* Manual Adjustment Panel */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-xl p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <BadgeAlert className="h-5 w-5 text-indigo-400" /> Manual Balance Override
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Adjust an employee's leave balance directly (Credit or Debit shifts).
                </p>
              </div>

              <form onSubmit={handleAdjustBalance} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Target Employee *</label>
                  <select
                    value={adjEmpId}
                    onChange={(e) => setAdjEmpId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 transition-colors"
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp._id} value={emp._id} className="bg-slate-900">
                        {emp.personal?.firstName} {emp.personal?.lastName} ({emp.employeeId || 'No ID'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Leave Type *</label>
                    <select
                      value={adjTypeId}
                      onChange={(e) => setAdjTypeId(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 transition-colors"
                    >
                      <option value="">Select Leave Type</option>
                      {leaveTypes.map(type => (
                        <option key={type._id} value={type._id} className="bg-slate-900">
                          {type.name} ({type.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Adjustment Action *</label>
                    <select
                      value={adjAction}
                      onChange={(e) => setAdjAction(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 transition-colors"
                    >
                      <option value="CREDIT">Credit (Add days)</option>
                      <option value="DEBIT">Debit (Subtract days)</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Days Amount *</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      placeholder="e.g. 1.5"
                      value={adjAmount}
                      onChange={(e) => setAdjAmount(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 transition-colors"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Audit Comment/Reason *</label>
                    <input
                      type="text"
                      placeholder="e.g. Carry-forward adjustment"
                      value={adjReason}
                      onChange={(e) => setAdjReason(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={adjLoading}
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-bold text-white py-3 transition duration-150 cursor-pointer shadow"
                >
                  {adjLoading ? 'Adjusting...' : 'Perform Balance Override'}
                </button>
              </form>
            </div>

            {/* SAML SSO Configuration Panel */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/20 backdrop-blur-xl p-6 space-y-6 lg:col-span-2">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-brand-400" /> SAML Single Sign-On (SSO)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure SAML assertions to authenticate enterprise users via Okta, Entra ID, or other IdPs.
                </p>
              </div>

              <form onSubmit={handleUpdateSamlConfig} className="space-y-4">
                <div className="flex border-b border-slate-800/60 pb-3 items-center">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={samlEnabled}
                      onChange={(e) => setSamlEnabled(e.target.checked)}
                      className="rounded border-slate-800 text-brand-500 focus:ring-brand-500 bg-slate-950"
                    />
                    Enable SAML Authentication for Workspace
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">SAML Entrypoint URL</label>
                    <input
                      type="url"
                      placeholder="e.g. https://company.okta.com/app/exk.../sso/saml"
                      value={samlEntryPoint}
                      onChange={(e) => setSamlEntryPoint(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 text-sm p-3 outline-none focus:border-brand-500/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">SAML Issuer (Entity ID)</label>
                    <input
                      type="text"
                      placeholder="e.g. http://www.okta.com/exk..."
                      value={samlIssuer}
                      onChange={(e) => setSamlIssuer(e.target.value)}
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 text-sm p-3 outline-none focus:border-brand-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">X.509 Certificate (PEM Format)</label>
                  <textarea
                    placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
                    value={samlCert}
                    onChange={(e) => setSamlCert(e.target.value)}
                    rows="4"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/50 text-slate-100 text-xs p-3 outline-none focus:border-brand-500/50 transition-colors font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={samlLoading}
                  className="w-full rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-sm font-bold text-slate-950 py-3 transition duration-150 cursor-pointer shadow"
                >
                  {samlLoading ? 'Saving Settings...' : 'Save SAML Settings'}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {/* ====================================================
           MODAL DIALOG: REQUEST LEAVE APPLICATION FORM
           ==================================================== */}
        {showApplyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-6 shadow-2xl animate-none">
              <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-teal-400" /> Apply for Time Off
                </h3>
                <button
                  onClick={() => setShowApplyModal(false)}
                  className="text-slate-400 hover:text-white font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleApplyLeave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Leave Type *</label>
                  <select
                    value={applyType}
                    onChange={(e) => setApplyType(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 transition-colors"
                  >
                    <option value="">Select leave category</option>
                    {leaveTypes.filter(t => t.isActive).map(type => (
                      <option key={type._id} value={type._id}>
                        {type.name} ({type.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Start Date *</label>
                    <input
                      type="date"
                      value={applyStart}
                      onChange={(e) => setApplyStart(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">End Date *</label>
                    <input
                      type="date"
                      value={applyEnd}
                      onChange={(e) => setApplyEnd(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-100 text-sm p-3 outline-none focus:border-teal-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex border-t border-slate-850 pt-3 items-center justify-between">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={applyHalfDay}
                      onChange={(e) => setApplyHalfDay(e.target.checked)}
                      className="rounded border-slate-800 text-teal-600 focus:ring-teal-500 bg-slate-950"
                    />
                    Is this a Half-Day Leave?
                  </label>

                  {applyHalfDay && (
                    <select
                      value={applyHalfDaySession}
                      onChange={(e) => setApplyHalfDaySession(e.target.value)}
                      className="rounded-lg border border-slate-800 bg-slate-950 text-slate-200 text-xs p-1.5 focus:border-teal-500"
                    >
                      <option value="MORNING">Morning Session</option>
                      <option value="AFTERNOON">Afternoon Session</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Reason / Comments *</label>
                  <textarea
                    placeholder="Provide detailed description of leave request..."
                    value={applyReason}
                    onChange={(e) => setApplyReason(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 text-slate-200 text-xs p-3.5 outline-none focus:border-teal-500/50 transition-colors"
                    rows="3"
                  />
                </div>

                <div className="flex gap-3 border-t border-slate-850 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowApplyModal(false)}
                    className="flex-1 rounded-xl border border-slate-800 hover:bg-slate-850 text-xs font-bold text-slate-400 py-3 transition duration-150 cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={applyLoading}
                    className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-xs font-bold text-white py-3 transition duration-150 cursor-pointer shadow text-center"
                  >
                    {applyLoading ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveDashboardPage;
