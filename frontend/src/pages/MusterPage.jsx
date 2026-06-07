import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Calendar, Clock, UserCheck, UserX, AlertCircle, Download, Search, BarChart3, HelpCircle } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

const STATUS_MAP = {
  PRESENT: { short: 'P', label: 'Present', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  LATE: { short: 'L', label: 'Late check-in', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  HALF_DAY: { short: 'H', label: 'Half day', color: 'bg-orange-50 border-orange-200 text-orange-700' },
  SHORT_LEAVE: { short: 'SL', label: 'Short leave', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  REGULARIZED: { short: 'R', label: 'Regularized', color: 'bg-teal-50 border-teal-200 text-teal-700' },
  ABSENT: { short: 'A', label: 'Absent', color: 'bg-rose-50 border-rose-200 text-rose-700' },
  WEEKLY_OFF: { short: 'W', label: 'Weekly off', color: 'bg-slate-100 border-slate-200 text-slate-650' },
  HOLIDAY: { short: 'Hol', label: 'Holiday', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  LEAVE: { short: 'LV', label: 'Approved Leave', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  '-': { short: '-', label: 'Future date / No status', color: 'bg-slate-50 border-slate-250 text-slate-400' },
};

const MusterPage = () => {
  const { showToast } = useToast();
  const { user } = useSelector((state) => state.auth);
  
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('grid'); // 'grid', 'overtime', or 'shift-config'
  
  // Data states
  const [gridData, setGridData] = useState([]);
  const [numDays, setNumDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [overtimeSheet, setOvertimeSheet] = useState([]);
  
  // Shift Management Metadata States
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  // Bulk Assign form state
  const [bulkDept, setBulkDept] = useState('');
  const [bulkLoc, setBulkLoc] = useState('');
  const [bulkShiftId, setBulkShiftId] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Rotational Assign form state
  const [rotationalShiftId, setRotationalShiftId] = useState('');
  const [rotationalStart, setRotationalStart] = useState('');
  const [rotationalEnd, setRotationalEnd] = useState('');
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  const [rotationalLoading, setRotationalLoading] = useState(false);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role === 'HR_ADMIN') {
      fetchShiftManagementMetadata();
    }
  }, [user]);

  const fetchShiftManagementMetadata = async () => {
    try {
      const shiftResponse = await api.get('/attendance-config/shifts');
      setShifts(shiftResponse.data || []);

      const orgResponse = await api.get('/organization');
      setDepartments(orgResponse.data.departments || []);
      setLocations(orgResponse.data.locations || []);

      const empResponse = await api.get('/employees', { params: { limit: 100 } });
      setEmployees(empResponse.data.employees || []);
    } catch (err) {
      console.error('Failed to load shift management metadata:', err);
    }
  };

  // Year list selection
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  useEffect(() => {
    fetchMusterData();
  }, [year, month]);

  const fetchMusterData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch grid data
      const musterRes = await api.get(`/attendance/muster?year=${year}&month=${month}`);
      setGridData(musterRes.data.grid || []);
      setNumDays(musterRes.data.numDays || 30);

      // 2. Fetch stats & overtime
      const statsRes = await api.get(`/attendance/stats?year=${year}&month=${month}`);
      setStats(statsRes.data.metrics || null);
      setOvertimeSheet(statsRes.data.overtimeSheet || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load muster data.');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAssign = async (e) => {
    e.preventDefault();
    if (!bulkShiftId) {
      showToast('Please select a shift.', 'warning');
      return;
    }
    if (!bulkDept && !bulkLoc) {
      showToast('Please select either a department or a location.', 'warning');
      return;
    }
    setBulkLoading(true);
    try {
      const response = await api.post('/attendance-config/shifts/assign-to-team', {
        department: bulkDept || undefined,
        location: bulkLoc || undefined,
        shiftId: bulkShiftId,
      });
      showToast(response.data.message, 'success');
      // Reset form & reload grid stats
      setBulkDept('');
      setBulkLoc('');
      setBulkShiftId('');
      fetchMusterData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to bulk assign shift.', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleRotationalAssign = async (e) => {
    e.preventDefault();
    if (!rotationalShiftId) {
      showToast('Please select a shift.', 'warning');
      return;
    }
    if (!rotationalStart || !rotationalEnd) {
      showToast('Please select start and end dates.', 'warning');
      return;
    }
    if (selectedEmpIds.length === 0) {
      showToast('Please select at least one employee.', 'warning');
      return;
    }
    setRotationalLoading(true);
    try {
      const response = await api.post('/attendance-config/shifts/assign-rotational', {
        employeeIds: selectedEmpIds,
        startDate: rotationalStart,
        endDate: rotationalEnd,
        shiftId: rotationalShiftId,
      });
      showToast(response.data.message, 'success');
      // Reset form & reload grid stats
      setRotationalShiftId('');
      setRotationalStart('');
      setRotationalEnd('');
      setSelectedEmpIds([]);
      fetchMusterData();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to assign rotational shift.', 'error');
    } finally {
      setRotationalLoading(false);
    }
  };

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(prev => prev - 1);
    } else {
      setMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(prev => prev + 1);
    } else {
      setMonth(prev => prev + 1);
    }
  };

  const filteredGrid = gridData.filter((emp) => {
    const q = searchQuery.toLowerCase();
    return (
      emp.name.toLowerCase().includes(q) ||
      (emp.employeeId && emp.employeeId.toLowerCase().includes(q))
    );
  });

  const exportMusterCSV = () => {
    if (filteredGrid.length === 0) return;
    
    // Header Row: ID, Name, 1, 2, 3...
    const headers = ['Employee ID', 'Name'];
    for (let d = 1; d <= numDays; d++) {
      headers.push(d.toString());
    }

    // Rows
    const rows = filteredGrid.map(emp => {
      const row = [emp.employeeId || '-', emp.name];
      for (let d = 1; d <= numDays; d++) {
        const dayKey = d.toString().padStart(2, '0');
        row.push(emp.days[dayKey] || '-');
      }
      return row;
    });

    const csvContent = 
      'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Muster_Register_${year}_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-50 text-slate-900 min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 flex items-center gap-2">
              <Calendar className="h-8 w-8 text-slate-950" />
              Muster Register <span className="text-slate-700 font-medium text-lg sm:text-xl"> &amp; Reports</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Analyze monthly attendance logs, calculate aggregate shift durations, and track overtime.
            </p>
          </div>

          {/* Month/Year Navigation Control */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-xl self-start sm:self-center shadow-sm">
            <button
              onClick={handlePrevMonth}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              &larr;
            </button>
            
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-800 outline-none px-2 cursor-pointer focus:text-slate-950"
            >
              {months.map(m => (
                <option key={m.value} value={m.value} className="bg-white text-slate-800">{m.label}</option>
              ))}
            </select>

            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-800 outline-none px-2 cursor-pointer focus:text-slate-950 border-l border-slate-200 pl-3"
            >
              {years.map(y => (
                <option key={y} value={y} className="bg-white text-slate-800">{y}</option>
              ))}
            </select>

            <button
              onClick={handleNextMonth}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              &rarr;
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

        {/* Dashboard Analytics Bar */}
        {stats && (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Total Present</span>
              <span className="text-xl font-extrabold text-emerald-700 mt-1 block">{stats.totalPresent}</span>
              <span className="text-[9px] text-slate-500 mt-1 block">days recorded</span>
            </div>
            
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Late Check-ins</span>
              <span className="text-xl font-extrabold text-amber-700 mt-1 block">{stats.totalLate}</span>
              <span className="text-[9px] text-slate-500 mt-1 block">grace exceeded</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Half-Day Markers</span>
              <span className="text-xl font-extrabold text-orange-700 mt-1 block">{stats.totalHalfDay}</span>
              <span className="text-[9px] text-slate-500 mt-1 block">under threshold</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Short Leaves</span>
              <span className="text-xl font-extrabold text-indigo-700 mt-1 block">{stats.totalShortLeave || 0}</span>
              <span className="text-[9px] text-slate-500 mt-1 block">short shifts</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Absence Days</span>
              <span className="text-xl font-extrabold text-rose-700 mt-1 block">{stats.totalAbsent}</span>
              <span className="text-[9px] text-slate-500 mt-1 block">working days missed</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Avg Daily Hours</span>
              <span className="text-xl font-extrabold text-slate-900 mt-1 block">{stats.avgWorkHours} hrs</span>
              <span className="text-[9px] text-slate-500 mt-1 block">per present shift</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Total Overtime</span>
              <span className="text-xl font-extrabold text-slate-900 mt-1 block">{stats.totalOvertimeHours} hrs</span>
              <span className="text-[9px] text-slate-500 mt-1 block">over standard shifts</span>
            </div>
          </div>
        )}

        {/* Tab Controls & Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex border-b border-slate-200 gap-4">
            <button
              onClick={() => setActiveTab('grid')}
              className={`pb-2.5 text-sm font-bold tracking-wide transition-all border-b-2 cursor-pointer ${
                activeTab === 'grid'
                  ? 'border-slate-950 text-slate-950 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-200'
              }`}
            >
              Muster Grid
            </button>
            <button
              onClick={() => setActiveTab('overtime')}
              className={`pb-2.5 text-sm font-bold tracking-wide transition-all border-b-2 cursor-pointer ${
                activeTab === 'overtime'
                  ? 'border-slate-950 text-slate-950 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-200'
              }`}
            >
              Overtime Sheet
            </button>
            {user?.role === 'HR_ADMIN' && (
              <button
                onClick={() => setActiveTab('shift-config')}
                className={`pb-2.5 text-sm font-bold tracking-wide transition-all border-b-2 cursor-pointer ${
                  activeTab === 'shift-config'
                    ? 'border-teal-500 text-slate-950'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Shift Management
              </button>
            )}
          </div>

          {/* Search and Action Toolbar */}
          <div className="flex items-center gap-3">
            {activeTab === 'grid' && (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search staff name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 w-64 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950/20 transition-colors"
                />
              </div>
            )}

            {activeTab !== 'shift-config' && (
              <button
                onClick={exportMusterCSV}
                disabled={filteredGrid.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 disabled:opacity-50 text-xs font-bold text-white px-4.5 py-2.5 transition duration-150 cursor-pointer shadow-md"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-500 border-t-transparent"></div>
            <p className="text-sm text-slate-400">Loading attendance reports...</p>
          </div>
        ) : activeTab === 'grid' ? (
          
          /* Muster Grid Layout */
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-550 font-bold text-xs uppercase font-mono tracking-wider sticky top-0">
                  <tr>
                    <th className="px-4 py-3 min-w-[200px] border-r border-slate-200 bg-slate-50 sticky left-0 z-10">Employee Details</th>
                    {Array.from({ length: numDays }, (_, i) => i + 1).map((d) => (
                      <th key={d} className="px-2.5 py-3 text-center min-w-[42px] border-r border-slate-200/50">
                        {d.toString().padStart(2, '0')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-mono">
                  {filteredGrid.length === 0 ? (
                    <tr>
                      <td colSpan={numDays + 1} className="px-4 py-16 text-center text-slate-500 italic bg-slate-50">
                        No employees found matching query or recorded for this month.
                      </td>
                    </tr>
                  ) : (
                    filteredGrid.map((emp) => (
                      <tr key={emp._id} className="hover:bg-slate-50 group">
                        
                        {/* Employee Name (Sticky column for easy scrolling) */}
                        <td className="px-4 py-3.5 border-r border-slate-200 bg-white group-hover:bg-slate-50 sticky left-0 z-10">
                          <strong className="text-slate-900 font-sans font-bold block">{emp.name}</strong>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">{emp.employeeId || 'No ID'}</span>
                        </td>
                        
                        {/* Daily Status Cells */}
                        {Array.from({ length: numDays }, (_, i) => i + 1).map((d) => {
                          const dayKey = d.toString().padStart(2, '0');
                          const status = emp.days[dayKey] || '-';
                          const mapped = STATUS_MAP[status] || (status && status !== '-' ? {
                            short: status,
                            label: `Leave (${status})`,
                            color: 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold'
                          } : STATUS_MAP['-']);

                          return (
                            <td key={d} className="p-1 border-r border-slate-200/30 text-center">
                              <div
                                title={`${emp.name} (Day ${dayKey}): ${mapped.label}`}
                                className={`flex h-8 w-full items-center justify-center rounded border text-xs font-bold font-mono transition-transform duration-75 hover:scale-105 select-none ${mapped.color}`}
                              >
                                {mapped.short}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Grid Legend Footer */}
            <div className="border-t border-slate-200 bg-slate-50 p-4 flex flex-wrap gap-x-5 gap-y-2.5 text-xs text-slate-500 font-sans items-center">
              <strong className="text-slate-800">Legend:</strong>
              {Object.entries(STATUS_MAP).filter(([k]) => k !== '-').map(([key, value]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center justify-center h-5 w-8 rounded border text-[10px] font-bold font-mono ${value.color}`}>
                    {value.short}
                  </span>
                  <span>{value.label}</span>
                </div>
              ))}
            </div>
          </div>

        ) : activeTab === 'overtime' ? (
          
          /* Overtime Sheet Tab Layout */
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-slate-900" />
                  Monthly Overtime Sheet
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Accumulated hours exceeding standard shift lengths for {months.find(m => m.value === month)?.label} {year}.
                </p>
              </div>
              <span className="text-xs text-slate-800 bg-slate-100 px-3 py-1 rounded-full font-bold border border-slate-200 uppercase tracking-wide">
                Total Sheet Overtime: {stats?.totalOvertimeHours || '0.00'} hrs
              </span>
            </div>

            {overtimeSheet.length === 0 ? (
              <div className="px-6 py-16 text-center text-slate-500 italic bg-slate-50">
                No overtime recorded for any employee in this month.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                  <div className="col-span-2 font-mono">Employee ID</div>
                  <div className="col-span-6">Employee Name</div>
                  <div className="col-span-4 text-right">Total Overtime Hours</div>
                </div>

                {overtimeSheet.map((ot) => (
                  <div key={ot.employeeId} className="grid grid-cols-12 gap-4 px-6 py-4.5 items-center hover:bg-slate-50">
                    <div className="col-span-2 font-mono font-semibold text-slate-500">{ot.employeeId}</div>
                    <div className="col-span-6 font-bold text-slate-900">{ot.name}</div>
                    <div className="col-span-4 text-right text-base font-black text-slate-900 font-mono">
                      {ot.overtimeHours} <span className="text-xs font-medium text-slate-500 font-sans">hrs</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'shift-config' ? (
          /* Shift Configuration Management Forms */
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Bulk Shift Assignment Card */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xl p-6 space-y-6 text-slate-900">
              <div>
                <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-slate-950" />
                  Bulk Team Shift Assignment
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Assign a default shift in bulk to all active employees in a department, a location, or both.
                </p>
              </div>

              <form onSubmit={handleBulkAssign} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Department</label>
                  <select
                    value={bulkDept}
                    onChange={(e) => setBulkDept(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm p-3 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950/20 transition-colors"
                  >
                    <option value="">All Departments</option>
                    {departments.map((d) => (
                      <option key={d._id || d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Location</label>
                  <select
                    value={bulkLoc}
                    onChange={(e) => setBulkLoc(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm p-3 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950/20 transition-colors"
                  >
                    <option value="">All Locations</option>
                    {locations.map((l) => (
                      <option key={l._id || l.name} value={l.name}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Target Shift *</label>
                  <select
                    value={bulkShiftId}
                    onChange={(e) => setBulkShiftId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm p-3 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950/20 transition-colors"
                  >
                    <option value="">Select Shift</option>
                    {shifts.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.type === 'FLEXIBLE' ? 'Flexible' : `${s.startTime} - ${s.endTime}`})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={bulkLoading}
                  className="w-full rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-sm font-bold text-white py-3 transition duration-150 cursor-pointer shadow"
                >
                  {bulkLoading ? 'Assigning...' : 'Assign Shift to Team'}
                </button>
              </form>
            </div>

            {/* Rotational Shift Scheduler Card */}
            <div className="rounded-2xl border border-slate-200 bg-slate-900/20 backdrop-blur-xl shadow-xl p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-indigo-400" />
                  Rotational Shift Scheduler
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Override shift schedules for selected employees across specific dates.
                </p>
              </div>

              <form onSubmit={handleRotationalAssign} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Start Date *</label>
                    <input
                      type="date"
                      value={rotationalStart}
                      onChange={(e) => setRotationalStart(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm p-3 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950/20 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">End Date *</label>
                    <input
                      type="date"
                      value={rotationalEnd}
                      onChange={(e) => setRotationalEnd(e.target.value)}
                      required
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm p-3 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950/20 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Target Shift *</label>
                  <select
                    value={rotationalShiftId}
                    onChange={(e) => setRotationalShiftId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 text-slate-900 text-sm p-3 outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950/20 transition-colors"
                  >
                    <option value="">Select Shift</option>
                    {shifts.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.type === 'FLEXIBLE' ? 'Flexible' : `${s.startTime} - ${s.endTime}`})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Select Employees *</label>
                    <div className="flex gap-2 text-[10px] font-bold text-slate-950">
                      <button
                        type="button"
                        onClick={() => setSelectedEmpIds(employees.map(e => e._id))}
                        className="hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <span>|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedEmpIds([])}
                        className="hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Search filter for checklist */}
                  <input
                    type="text"
                    placeholder="Filter employees..."
                    onChange={(e) => {
                      const filterVal = e.target.value.toLowerCase();
                      const items = document.querySelectorAll('.emp-check-item');
                      items.forEach(item => {
                        const text = item.textContent.toLowerCase();
                        if (text.includes(filterVal)) {
                          item.classList.remove('hidden');
                        } else {
                          item.classList.add('hidden');
                        }
                      });
                    }}
                    className="w-full mb-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs px-3 py-2 outline-none focus:border-slate-950/20 transition-colors placeholder-slate-400"
                  />

                  {/* Employees Scroll list */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-48 overflow-y-auto space-y-2">
                    {employees.length === 0 ? (
                      <p className="text-xs text-slate-500 italic text-center py-4">No employees loaded.</p>
                    ) : (
                      employees.map((emp) => {
                        const isChecked = selectedEmpIds.includes(emp._id);
                        return (
                          <label
                            key={emp._id}
                            className="emp-check-item flex items-center gap-2.5 rounded-lg hover:bg-slate-250 p-1.5 cursor-pointer text-xs transition duration-75 select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedEmpIds(selectedEmpIds.filter(id => id !== emp._id));
                                } else {
                                  setSelectedEmpIds([...selectedEmpIds, emp._id]);
                                }
                              }}
                              className="rounded border-slate-300 text-slate-950 focus:ring-slate-950 bg-white animate-none"
                            />
                            <span className="flex-1 font-semibold text-slate-700">
                              {emp.personal?.firstName} {emp.personal?.lastName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {emp.employeeId || 'No ID'}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={rotationalLoading}
                  className="w-full rounded-xl bg-slate-950 hover:bg-slate-900 disabled:opacity-50 text-sm font-bold text-white py-3 transition duration-150 cursor-pointer shadow-md"
                >
                  {rotationalLoading ? 'Scheduling...' : 'Schedule Rotational Shift'}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MusterPage;
