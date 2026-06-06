import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { LogOut, Home, Users, Network, User, Calendar, Settings, FileText, HelpCircle, Briefcase } from 'lucide-react';
import { logout } from '../store/authSlice';
import api from '../services/api';
import NotificationBell from './NotificationBell';

const DashboardLayout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

  const isEmployeeActive = location.pathname === '/directory' || location.pathname === '/org-chart';
  const isAttendanceActive = location.pathname === '/leaves' || location.pathname === '/muster';

  const [employeeExpanded, setEmployeeExpanded] = useState(isEmployeeActive);
  const [attendanceExpanded, setAttendanceExpanded] = useState(isAttendanceActive);

  useEffect(() => {
    if (isEmployeeActive) setEmployeeExpanded(true);
    if (isAttendanceActive) setAttendanceExpanded(true);
  }, [location.pathname, isEmployeeActive, isAttendanceActive]);

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

  // Compile navItems for mobile layout
  const navItems = [
    { name: 'Overview', path: '/dashboard', icon: <Home className="h-4.5 w-4.5" /> },
    { name: 'Directory', path: '/directory', icon: <Users className="h-4.5 w-4.5" /> },
    { name: 'Org Chart', path: '/org-chart', icon: <Network className="h-4.5 w-4.5" /> },
    { name: 'Leaves', path: '/leaves', icon: <Calendar className="h-4.5 w-4.5" /> },
    { name: 'My Profile', path: '/profile', icon: <User className="h-4.5 w-4.5" /> },
  ];

  if (['HR_ADMIN', 'LEADERSHIP', 'MANAGER'].includes(user?.role)) {
    navItems.splice(3, 0, { name: 'Muster', path: '/muster', icon: <Calendar className="h-4.5 w-4.5" /> });
  }

  navItems.splice(navItems.length - 1, 0, { name: 'Reports', path: '/reports', icon: <FileText className="h-4.5 w-4.5" /> });

  if (user?.role === 'HR_ADMIN') {
    navItems.push({ name: 'Workflows', path: '/workflows', icon: <Settings className="h-4.5 w-4.5" /> });
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row font-sans pb-16 md:pb-0">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-150 h-screen sticky top-0 shrink-0 overflow-y-auto select-none">
        {/* Branding header */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
              <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.5 7C8.5 5.61929 9.61929 4.5 11 4.5C12.3807 4.5 13.5 5.61929 13.5 7V10.5C13.5 11.8807 14.6193 13 16 13C17.3807 13 18.5 11.8807 18.5 10.5C18.5 9.11929 17.3807 8 16 8" stroke="#10b981" strokeWidth="3.2" strokeLinecap="round"/>
                <path d="M15.5 17C15.5 18.3807 14.3807 19.5 13 19.5C11.6193 19.5 10.5 18.3807 10.5 17V13.5C10.5 12.1193 9.38071 11 8 11C6.61929 11 5.5 12.1193 5.5 13.5C5.5 14.8807 6.61929 16 8 16" stroke="#0f172a" strokeWidth="3.2" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-xl font-extrabold text-[#0f172a] tracking-tight">StaffX</span>
          </div>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 py-6 space-y-6">
          {/* GENERAL SECTION */}
          <div className="space-y-0.5">
            <span className="px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">
              General
            </span>
            
            {/* Overview */}
            <button
              onClick={() => navigate('/dashboard')}
              className={`flex items-center gap-3 w-full px-6 py-2.5 text-sm font-semibold transition-all duration-150 cursor-pointer border-l-4 ${
                location.pathname === '/dashboard'
                  ? 'bg-[#e8f7f2] text-[#10b981] border-[#10b981] font-bold'
                  : 'text-slate-555 text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-transparent'
              }`}
            >
              <Home className="h-4.5 w-4.5" />
              <span>Overview</span>
            </button>

            {/* Payroll (Dummy menu) */}
            <button
              onClick={() => {}}
              className="flex items-center justify-between w-full px-6 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4.5 w-4.5" />
                <span>Payroll</span>
              </div>
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Employee (Collapsible Parent) */}
            <div>
              <button
                onClick={() => setEmployeeExpanded(!employeeExpanded)}
                className={`flex items-center justify-between w-full px-6 py-2.5 text-sm font-semibold transition-all duration-150 cursor-pointer border-l-4 ${
                  isEmployeeActive
                    ? 'bg-[#e8f7f2] text-[#10b981] border-[#10b981] font-bold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4.5 w-4.5" />
                  <span>Employee</span>
                </div>
                <svg
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-250 ${
                    employeeExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Submenu with lines */}
              {employeeExpanded && (
                <div className="pl-12 pr-6 py-1.5 ml-4 border-l border-slate-100 space-y-2.5 relative">
                  <button
                    onClick={() => navigate('/directory')}
                    className={`flex items-center w-full text-xs font-semibold hover:text-[#10b981] transition cursor-pointer ${
                      location.pathname === '/directory' ? 'text-[#10b981] font-bold' : 'text-slate-500'
                    }`}
                  >
                    Manage Employees
                  </button>
                  <button
                    onClick={() => navigate('/directory')}
                    className={`flex items-center w-full text-xs font-semibold hover:text-[#10b981] transition cursor-pointer ${
                      location.pathname === '/directory' ? 'text-[#10b981] font-bold' : 'text-slate-500'
                    }`}
                  >
                    Directory
                  </button>
                  <button
                    onClick={() => navigate('/org-chart')}
                    className={`flex items-center w-full text-xs font-semibold hover:text-[#10b981] transition cursor-pointer ${
                      location.pathname === '/org-chart' ? 'text-[#10b981] font-bold' : 'text-slate-500'
                    }`}
                  >
                    ORG Chart
                  </button>
                </div>
              )}
            </div>

            {/* Attendance (Parent) */}
            <div>
              <button
                onClick={() => setAttendanceExpanded(!attendanceExpanded)}
                className={`flex items-center justify-between w-full px-6 py-2.5 text-sm font-semibold transition-all duration-150 cursor-pointer border-l-4 ${
                  isAttendanceActive
                    ? 'bg-[#e8f7f2] text-[#10b981] border-[#10b981] font-bold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-4.5 w-4.5" />
                  <span>Attendance</span>
                </div>
                <svg
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-250 ${
                    attendanceExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {attendanceExpanded && (
                <div className="pl-12 pr-6 py-1.5 ml-4 border-l border-slate-100 space-y-2.5">
                  <button
                    onClick={() => navigate('/leaves')}
                    className={`flex items-center w-full text-xs font-semibold hover:text-[#10b981] transition cursor-pointer ${
                      location.pathname === '/leaves' ? 'text-[#10b981] font-bold' : 'text-slate-500'
                    }`}
                  >
                    Leaves (Time Off)
                  </button>
                  {['HR_ADMIN', 'LEADERSHIP', 'MANAGER'].includes(user?.role) && (
                    <button
                      onClick={() => navigate('/muster')}
                      className={`flex items-center w-full text-xs font-semibold hover:text-[#10b981] transition cursor-pointer ${
                        location.pathname === '/muster' ? 'text-[#10b981] font-bold' : 'text-slate-500'
                      }`}
                    >
                      Muster Register
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* MANAGEMENT SECTION */}
          <div className="space-y-0.5">
            <span className="px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">
              Management
            </span>

            {/* Jobs (Dummy dropdown) */}
            <button
              onClick={() => {}}
              className="flex items-center justify-between w-full px-6 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Briefcase className="h-4.5 w-4.5" />
                <span>Jobs</span>
              </div>
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Candidate (Dummy dropdown) */}
            <button
              onClick={() => {}}
              className="flex items-center justify-between w-full px-6 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Users className="h-4.5 w-4.5" />
                <span>Candidate</span>
              </div>
              <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Reports */}
            <button
              onClick={() => navigate('/reports')}
              className={`flex items-center gap-3 w-full px-6 py-2.5 text-sm font-semibold transition-all duration-150 cursor-pointer border-l-4 ${
                location.pathname === '/reports'
                  ? 'bg-[#e8f7f2] text-[#10b981] border-[#10b981] font-bold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-transparent'
              }`}
            >
              <FileText className="h-4.5 w-4.5" />
              <span>Reports</span>
            </button>

            {/* Workflow Config (Shown only to HR_ADMIN) */}
            {user?.role === 'HR_ADMIN' && (
              <button
                onClick={() => navigate('/workflows')}
                className={`flex items-center gap-3 w-full px-6 py-2.5 text-sm font-semibold transition-all duration-150 cursor-pointer border-l-4 ${
                  location.pathname === '/workflows'
                    ? 'bg-[#e8f7f2] text-[#10b981] border-[#10b981] font-bold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-transparent'
                }`}
              >
                <Settings className="h-4.5 w-4.5" />
                <span>Workflow Config</span>
              </button>
            )}
          </div>

          {/* SUPPORT SECTION */}
          <div className="space-y-0.5">
            <span className="px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">
              Support
            </span>

            {/* Profile */}
            <button
              onClick={() => navigate('/profile')}
              className={`flex items-center gap-3 w-full px-6 py-2.5 text-sm font-semibold transition-all duration-150 cursor-pointer border-l-4 ${
                location.pathname === '/profile'
                  ? 'bg-[#e8f7f2] text-[#10b981] border-[#10b981] font-bold'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-transparent'
              }`}
            >
              <User className="h-4.5 w-4.5" />
              <span>My Profile</span>
            </button>

            {/* Help Center */}
            <button
              onClick={() => {}}
              className="flex items-center gap-3 w-full px-6 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent transition cursor-pointer"
            >
              <HelpCircle className="h-4.5 w-4.5 text-slate-400" />
              <span>Help Center</span>
            </button>
          </div>
        </div>

        {/* Footer Area with Sign Out */}
        <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs font-mono uppercase">
              {user?.email?.slice(0, 2)}
            </div>
            <div className="overflow-hidden">
              <span className="block text-[11px] font-bold text-slate-800 truncate leading-none mb-0.5">{user?.email}</span>
              <span className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none">{user?.role}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center gap-1.5 w-full rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2.5 text-xs transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Right Side Area */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Header Row */}
        <header className="flex h-16 items-center justify-between border-b border-slate-100 bg-white px-6 sticky top-0 z-30 select-none">
          {/* Left search */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search"
              className="block rounded-lg border border-slate-200 bg-[#fafafa] py-1.5 pl-9 pr-4 text-sm w-72 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#10b981] focus:border-[#10b981] transition duration-150"
            />
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-slate-500 sm:inline-block font-mono bg-slate-50 border border-slate-150 px-2.5 py-1 rounded-lg">
              Workspace: <span className="text-slate-700 font-semibold">{user?.tenantId}</span>
            </span>
            
            <NotificationBell />
          </div>
        </header>

        {/* Dynamic Page Content Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="flex md:hidden items-center justify-around border-t border-slate-100 bg-white py-2 shadow-inner fixed bottom-0 left-0 right-0 z-40">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 text-[10px] font-medium transition cursor-pointer ${
                isActive ? 'text-[#10b981] font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {item.icon}
              <span>{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardLayout;
