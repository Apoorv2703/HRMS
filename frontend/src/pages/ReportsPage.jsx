import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  FileText,
  Download,
  Calendar,
  Users,
  Clock,
  Briefcase,
  Percent,
  Mail,
  Loader2,
  Filter,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import api from '../services/api';

const ReportsPage = () => {
  const { user } = useSelector((state) => state.auth);

  // Filter States
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDayOfMonth = today.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');

  // Dropdown lists
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);

  // Dashboard Metrics
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Active Report Tab
  const [activeReportTab, setActiveReportTab] = useState('headcount');
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Scheduler modal states
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedFrequency, setSchedFrequency] = useState('WEEKLY');
  const [schedRecipients, setSchedRecipients] = useState('');
  const [schedSuccessMsg, setSchedSuccessMsg] = useState('');
  const [schedErrorMsg, setSchedErrorMsg] = useState('');
  const [schedLoading, setSchedLoading] = useState(false);

  const reportTabs = [
    { id: 'headcount', name: 'Headcount Master' },
    { id: 'attendance', name: 'Attendance Summary' },
    { id: 'leaves', name: 'Leave Usage & Balance' },
    { id: 'late-absent', name: 'Late / Absent Log' },
    { id: 'overtime', name: 'Overtime Register' },
    { id: 'attrition', name: 'Attrition Rate' },
  ];

  useEffect(() => {
    fetchMetadata();
    fetchDashboardMetrics();
  }, []);

  useEffect(() => {
    // Only managers/admins can query the tabular report data endpoint
    if (user?.role !== 'EMPLOYEE') {
      fetchReportData();
    }
  }, [activeReportTab, startDate, endDate, department, location, user?.role]);

  const fetchMetadata = async () => {
    try {
      const res = await api.get('/organization');
      // departments = [{name, code, _id}], locations = [{name, address, code, _id}]
      setDepartments(res.data.departments || []);
      setLocations(res.data.locations || []);
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  };

  const fetchDashboardMetrics = async () => {
    setMetricsLoading(true);
    try {
      const res = await api.get('/reports/dashboard');
      setMetrics(res.data.metrics);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  const fetchReportData = async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await api.get('/reports/data', {
        params: {
          type: activeReportTab,
          startDate,
          endDate,
          department,
          location,
        },
      });
      setReportData(res.data);
    } catch (err) {
      setReportError('Could not retrieve report data.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/reports/export', {
        params: {
          type: activeReportTab,
          startDate,
          endDate,
          department,
          location,
        },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeReportTab}_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export CSV file.');
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setSchedLoading(true);
    setSchedSuccessMsg('');
    setSchedErrorMsg('');

    const emails = schedRecipients
      .split(',')
      .map((em) => em.trim())
      .filter((em) => em.length > 0);

    if (emails.length === 0) {
      setSchedErrorMsg('Please enter at least one recipient email.');
      setSchedLoading(false);
      return;
    }

    try {
      await api.post('/reports/schedule', {
        reportType: activeReportTab,
        frequency: schedFrequency,
        recipients: emails,
        department,
        location,
      });

      setSchedSuccessMsg(`Delivery schedule configured for ${activeReportTab} successfully.`);
      setSchedRecipients('');
      setTimeout(() => setShowScheduleModal(false), 2000);
    } catch (err) {
      setSchedErrorMsg(err.response?.data?.error || 'Failed to configure schedule.');
    } finally {
      setSchedLoading(false);
    }
  };

  const renderTableHeaders = () => {
    switch (activeReportTab) {
      case 'headcount':
        return (
          <>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Emp ID</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Name</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Department</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Designation</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Location</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Joining Date</th>
          </>
        );
      case 'attendance':
        return (
          <>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Emp ID</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Name</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Department</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Location</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Present</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Late</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Half Day</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Absent</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Worked Hours</th>
          </>
        );
      case 'leaves':
        return (
          <>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Emp ID</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Name</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Department</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Leave Type</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Allocated</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Used</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Pending</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Remaining</th>
          </>
        );
      case 'late-absent':
        return (
          <>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Emp ID</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Name</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Department</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Location</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Date</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Violation</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Clock In</th>
          </>
        );
      case 'overtime':
        return (
          <>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Emp ID</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Name</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Department</th>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Location</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">OT Hours</th>
          </>
        );
      case 'attrition':
        return (
          <>
            <th className="px-6 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Department</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Joined Count</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Left Count</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Net Change</th>
            <th className="px-6 py-3.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Attrition Rate</th>
          </>
        );
      default:
        return null;
    }
  };

  const renderTableRows = () => {
    if (reportData.length === 0) {
      return (
        <tr>
          <td colSpan={10} className="px-6 py-10 text-center text-slate-500 text-sm">
            No matching report data found for selected filters.
          </td>
        </tr>
      );
    }

    return reportData.map((row, idx) => {
      switch (activeReportTab) {
        case 'headcount':
          return (
            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 text-sm font-semibold text-slate-800">{row.employeeId}</td>
              <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.name}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.department}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.designation}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.location}</td>
              <td className="px-6 py-4 text-sm">
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  row.status === 'ACTIVE' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {row.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-500">{row.joiningDate}</td>
            </tr>
          );
        case 'attendance':
          return (
            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 text-sm font-semibold text-slate-800">{row.employeeId}</td>
              <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.name}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.department}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.location}</td>
              <td className="px-6 py-4 text-center text-sm font-medium text-slate-700">{row.presentDays}</td>
              <td className="px-6 py-4 text-center text-sm font-medium text-amber-600">{row.lateDays}</td>
              <td className="px-6 py-4 text-center text-sm font-medium text-orange-600">{row.halfDays}</td>
              <td className="px-6 py-4 text-center text-sm font-medium text-rose-600">{row.absentDays}</td>
              <td className="px-6 py-4 text-center text-sm font-bold text-slate-900">{row.workedHours} hrs</td>
            </tr>
          );
        case 'leaves':
          return (
            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 text-sm font-semibold text-slate-800">{row.employeeId}</td>
              <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.name}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.department}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.leaveType}</td>
              <td className="px-6 py-4 text-center text-sm font-medium text-slate-700">{row.allocated}</td>
              <td className="px-6 py-4 text-center text-sm font-medium text-teal-600">{row.used}</td>
              <td className="px-6 py-4 text-center text-sm font-medium text-amber-600">{row.pending}</td>
              <td className="px-6 py-4 text-center text-sm font-bold text-slate-900">{row.remaining}</td>
            </tr>
          );
        case 'late-absent':
          return (
            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 text-sm font-semibold text-slate-800">{row.employeeId}</td>
              <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.name}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.department}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.location}</td>
              <td className="px-6 py-4 text-center text-sm text-slate-500">{row.date}</td>
              <td className="px-6 py-4 text-center text-sm">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                  row.status === 'LATE' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}>
                  {row.status}
                </span>
              </td>
              <td className="px-6 py-4 text-center text-sm font-mono text-slate-700">{row.timeIn}</td>
            </tr>
          );
        case 'overtime':
          return (
            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 text-sm font-semibold text-slate-800">{row.employeeId}</td>
              <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.name}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.department}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{row.location}</td>
              <td className="px-6 py-4 text-center text-sm font-bold text-emerald-600">{row.overtimeHours} hrs</td>
            </tr>
          );
        case 'attrition':
          return (
            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-6 py-4 text-sm font-bold text-slate-800">{row.department}</td>
              <td className="px-6 py-4 text-center text-sm font-medium text-emerald-600">+{row.joinedCount}</td>
              <td className="px-6 py-4 text-center text-sm font-medium text-rose-600">-{row.leftCount}</td>
              <td className="px-6 py-4 text-center text-sm font-semibold text-slate-700">{row.netChange}</td>
              <td className="px-6 py-4 text-center text-sm font-bold text-amber-600">{row.attritionRate}</td>
            </tr>
          );
        default:
          return null;
      }
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-slate-900">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <FileText className="h-8 w-8 text-slate-900" />
            {user?.role === 'EMPLOYEE' ? 'My Personal Dashboard' : 'Reporting & Dashboards Center'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {user?.role === 'EMPLOYEE'
              ? 'View your personal attendance stats and leave balance for the current month.'
              : 'Access role-scoped directory, attendance, leaves, overtime registers, and attrition rates.'}
          </p>
        </div>
        {user?.role !== 'EMPLOYEE' && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900 transition duration-200 cursor-pointer shadow-sm"
            >
              <Mail className="h-4 w-4" />
              Schedule Delivery
            </button>
            <button
              onClick={handleExportCSV}
              disabled={reportData.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-5 py-2.5 text-sm font-bold text-white shadow-md transition duration-200 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* KPI dashboard cards */}
      {metricsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"></div>
          ))}
        </div>
      ) : metrics ? (
        user?.role === 'EMPLOYEE' ? (
          // Employee personal KPI cards
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase text-slate-500">Present Days</span>
                <CheckCircle className="h-5 w-5 text-slate-900" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.presentDays ?? 0}</div>
              <div className="text-[10px] text-slate-500 mt-1">This month</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase text-slate-500">Late Days</span>
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="text-2xl font-extrabold text-amber-600 mt-2">{metrics.lateDays ?? 0}</div>
              <div className="text-[10px] text-slate-500 mt-1">This month</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase text-slate-500">Absent Days</span>
                <AlertCircle className="h-5 w-5 text-rose-600" />
              </div>
              <div className="text-2xl font-extrabold text-rose-600 mt-2">{metrics.absentDays ?? 0}</div>
              <div className="text-[10px] text-slate-500 mt-1">This month</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold uppercase text-slate-500">Leave Balance</span>
                <Calendar className="h-5 w-5 text-slate-900" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.remainingLeaves ?? 0}</div>
              <div className="text-[10px] text-slate-500 mt-1">Days remaining</div>
            </div>
          </div>
        ) : (
          // Manager / HR Admin / Leadership KPI cards
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-start text-slate-500">
                <span className="text-xs font-semibold uppercase text-slate-500">Total Headcount</span>
                <Users className="h-5 w-5 text-slate-900" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.headcount ?? 'N/A'}</div>
              <div className="text-[10px] text-slate-500 mt-1">Active staff records</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-start text-slate-500">
                <span className="text-xs font-semibold uppercase text-slate-500">Avg Work Hours</span>
                <Clock className="h-5 w-5 text-slate-900" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.avgWorkHours ?? '0.00'} hrs</div>
              <div className="text-[10px] text-slate-500 mt-1">Per active day (current month)</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-start text-slate-500">
                <span className="text-xs font-semibold uppercase text-slate-500">Total Overtime</span>
                <Briefcase className="h-5 w-5 text-slate-900" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.totalOvertimeHours ?? '0.00'} hrs</div>
              <div className="text-[10px] text-slate-500 mt-1">Accumulated current month</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-start text-slate-500">
                <span className="text-xs font-semibold uppercase text-slate-500">Leaves Today</span>
                <Calendar className="h-5 w-5 text-slate-900" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.activeLeavesToday ?? 0}</div>
              <div className="text-[10px] text-slate-500 mt-1">Approved active requests</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex justify-between items-start text-slate-500">
                <span className="text-xs font-semibold uppercase text-slate-500">Attrition Rate</span>
                <Percent className="h-5 w-5 text-slate-900" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">{metrics.attritionRate ?? '0.0%'}</div>
              <div className="text-[10px] text-slate-500 mt-1">Annualized turnover metric</div>
            </div>
          </div>
        )
      ) : null}

      {/* Filter and tab grid layout — only for non-EMPLOYEE roles */}
      {user?.role !== 'EMPLOYEE' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column: Report categories selector & Filters */}
          <div className="lg:col-span-1 space-y-5">
            {/* Filters Card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-200 pb-2.5">
                <Filter className="h-4 w-4 text-slate-900" />
                Filter Query Options
              </h3>

              {/* Date Range Start */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-slate-950 focus:outline-none"
                />
              </div>

              {/* Date Range End */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-slate-950 focus:outline-none"
                />
              </div>

              {/* Department */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-950 focus:outline-none cursor-pointer"
                >
                  <option value="">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept.code || dept.name} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Location</label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-950 focus:outline-none cursor-pointer"
                >
                  <option value="">All Locations</option>
                  {locations.map((loc) => (
                    <option key={loc.code || loc.name} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Report Tab lists */}
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm flex flex-col gap-1">
              {reportTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveReportTab(tab.id)}
                  className={`w-full text-left rounded-xl px-4 py-3 text-xs font-bold transition duration-200 flex items-center justify-between cursor-pointer ${
                    activeReportTab === tab.id
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-slate-650 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Tabular Preview Sheet */}
          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
              {/* Tab header title */}
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-4.5 flex justify-between items-center">
                <h2 className="text-base font-bold text-slate-900 tracking-wide">
                  {reportTabs.find((t) => t.id === activeReportTab)?.name} Preview
                </h2>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded">
                  Live Data Fetch
                </span>
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-max border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>{renderTableHeaders()}</tr>
                  </thead>
                  <tbody>
                    {reportLoading ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-12 text-center text-slate-500 text-sm">
                          <div className="flex justify-center items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-900" />
                            <span>Aggregating ledger data from system...</span>
                          </div>
                        </td>
                      </tr>
                    ) : reportError ? (
                      <tr>
                        <td colSpan={10} className="px-6 py-10 text-center text-rose-600 text-sm font-semibold">
                          {reportError}
                        </td>
                      </tr>
                    ) : (
                      renderTableRows()
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scheduling report modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-2xl space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Mail className="h-5 w-5 text-slate-900" />
                Schedule Email Summary Reports
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure automatic email delivery of the current report tab at regular frequencies.
              </p>
            </div>

            {schedSuccessMsg && (
              <div className="rounded-xl border border-teal-200 bg-teal-50 p-3.5 text-xs text-teal-850 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-teal-650" />
                {schedSuccessMsg}
              </div>
            )}

            {schedErrorMsg && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-850 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-650" />
                {schedErrorMsg}
              </div>
            )}

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              {/* Report selection display */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Report Tab</label>
                <div className="block w-full rounded-xl bg-slate-100 border border-slate-200 px-4 py-3 text-xs font-bold text-slate-800">
                  {reportTabs.find((t) => t.id === activeReportTab)?.name}
                </div>
              </div>

              {/* Frequency selection */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Frequency</label>
                <select
                  value={schedFrequency}
                  onChange={(e) => setSchedFrequency(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-slate-950 focus:outline-none cursor-pointer"
                >
                  <option value="DAILY">Daily Summary</option>
                  <option value="WEEKLY">Weekly Digest Summary</option>
                  <option value="MONTHLY">Monthly Overview Digest</option>
                </select>
              </div>

              {/* Email recipients */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email Recipients</label>
                <textarea
                  rows={2}
                  required
                  placeholder="manager@company.com, leadership@company.com"
                  value={schedRecipients}
                  onChange={(e) => setSchedRecipients(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-slate-950 focus:outline-none placeholder-slate-400"
                />
                <span className="block text-[9px] text-slate-500">Separate multiple emails using commas.</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 justify-center rounded-xl border border-slate-200 bg-white py-2.5 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus:outline-none cursor-pointer shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schedLoading}
                  className="flex-1 justify-center rounded-xl bg-slate-950 hover:bg-slate-900 text-xs font-bold text-white shadow-md disabled:opacity-50 py-2.5 cursor-pointer"
                >
                  {schedLoading ? 'Configuring...' : 'Activate Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
