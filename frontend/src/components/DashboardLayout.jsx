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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Premium Top Navbar */}
      <nav className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 font-bold text-black shadow shadow-teal-500/20">
                  HR
                </div>
                <span className="text-lg font-bold tracking-tight text-white">
                  HRMS <span className="text-teal-400">Platform</span>
                </span>
              </div>

              {/* Navigation Items */}
              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 cursor-pointer ${
                        isActive
                          ? 'bg-teal-500/10 text-teal-400 font-bold'
                          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      }`}
                    >
                      {item.icon}
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="hidden text-xs text-slate-500 sm:inline-block font-mono bg-slate-900 border border-slate-850 px-2.5 py-1 rounded-lg">
                Workspace: <span className="text-slate-300 font-semibold">{user?.tenantId}</span>
              </span>
              
              <NotificationBell />
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition duration-200 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden items-center justify-around border-t border-slate-850/60 bg-slate-950/80 backdrop-blur py-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1 text-[10px] font-medium transition cursor-pointer ${
                  isActive ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Outlet Container */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;
