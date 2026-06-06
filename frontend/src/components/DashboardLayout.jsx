import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { LogOut, Home, Users, Network, User, Calendar, Settings, FileText } from 'lucide-react';
import { logout } from '../store/authSlice';
import api from '../services/api';
import NotificationBell from './NotificationBell';

const DashboardLayout = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);

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

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <Home className="h-4 w-4" /> },
    { name: 'Directory', path: '/directory', icon: <Users className="h-4 w-4" /> },
    { name: 'Org Chart', path: '/org-chart', icon: <Network className="h-4 w-4" /> },
    { name: 'Leaves', path: '/leaves', icon: <Calendar className="h-4 w-4" /> },
    { name: 'My Profile', path: '/profile', icon: <User className="h-4 w-4" /> },
  ];

  if (['HR_ADMIN', 'LEADERSHIP', 'MANAGER'].includes(user?.role)) {
    navItems.splice(3, 0, { name: 'Muster Register', path: '/muster', icon: <Calendar className="h-4 w-4" /> });
  }

  // Reports is available to all authenticated users (backend scopes data per role)
  navItems.splice(navItems.length - 1, 0, { name: 'Reports', path: '/reports', icon: <FileText className="h-4 w-4" /> });

  if (user?.role === 'HR_ADMIN') {
    navItems.push({ name: 'Workflow Config', path: '/workflows', icon: <Settings className="h-4 w-4" /> });
  }


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden sticky top-0 z-40 select-none">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 font-bold text-white shadow shadow-slate-950/10 text-sm">
            HR
          </div>
          <span className="text-base font-bold tracking-tight text-slate-950">
            HRMS <span className="text-slate-500 font-medium">Platform</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <button
            onClick={handleLogout}
            className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 bg-white h-screen sticky top-0 p-5 space-y-6 z-40 select-none text-slate-800">
        {/* Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 font-bold text-white shadow shadow-slate-950/10">
            HR
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-950">
            HRMS <span className="text-slate-500 font-medium">Platform</span>
          </span>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 flex flex-col min-h-0 gap-2">
          <div className="flex flex-col gap-1 overflow-y-auto pr-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer border-l-4 ${
                    isActive
                      ? 'bg-slate-100 text-slate-950 border-slate-950 font-bold'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-950 border-transparent'
                  }`}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-1 px-4 py-2 border-t border-slate-100 pt-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notifications</span>
            <NotificationBell />
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-200 pt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs font-mono uppercase">
              {user?.email?.slice(0, 2)}
            </div>
            <div className="overflow-hidden">
              <span className="block text-[11px] font-bold text-slate-800 truncate leading-none mb-1">{user?.email}</span>
              <span className="block text-[9px] font-semibold text-slate-400 uppercase tracking-wider leading-none">{user?.role}</span>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-950 transition duration-200 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Outlet Container */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <main className="flex-1 pb-16 md:pb-0 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Fixed bottom) */}
      <div className="flex md:hidden items-center justify-around border-t border-slate-200 bg-white py-2.5 fixed bottom-0 left-0 right-0 z-40">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-1 text-[9px] font-medium transition cursor-pointer ${
                isActive ? 'text-slate-950 font-bold' : 'text-slate-500 hover:text-slate-800'
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

