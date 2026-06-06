import React, { useState, useEffect, useRef } from 'react';
import { Bell, MailOpen, AlertCircle, Calendar, ShieldAlert, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 30 seconds for live updates
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    setIsOpen(false);
    if (!notif.isRead) {
      try {
        await api.put(`/notifications/${notif._id}/read`);
        // Refresh local list
        setNotifications(prev =>
          prev.map(n => n._id === notif._id ? { ...n, isRead: true } : n)
        );
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }
    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;

    try {
      await Promise.all(unread.map(n => api.put(`/notifications/${n._id}/read`)));
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getIcon = (type) => {
    switch (type) {
      case 'LEAVE_SUBMITTED':
      case 'REGULARIZATION_SUBMITTED':
        return <Calendar className="h-4 w-4 text-amber-600" />;
      case 'LEAVE_APPROVED':
      case 'REGULARIZATION_APPROVED':
        return <Calendar className="h-4 w-4 text-emerald-600" />;
      case 'SLA_BREACH':
        return <ShieldAlert className="h-4 w-4 text-rose-600" />;
      case 'CRITICAL_SECURITY':
        return <ShieldAlert className="h-4 w-4 text-red-600 animate-pulse" />;
      default:
        return <AlertCircle className="h-4 w-4 text-slate-700" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition duration-200 cursor-pointer"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-950 text-[9px] font-black text-white shadow shadow-slate-950/20 animate-in zoom-in-50">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 md:right-auto md:left-0 mt-3 w-80 sm:w-96 rounded-2xl border border-slate-250 bg-white p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-3 duration-250">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <span className="text-sm font-bold text-slate-950 flex items-center gap-1.5">
              Notifications
              {unreadCount > 0 && (
                <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-black text-slate-800">
                  {unreadCount} new
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              >
                <MailOpen className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 mt-1 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs italic">
                You have no notifications at this time.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-3 p-3 transition duration-150 cursor-pointer hover:bg-slate-50 rounded-xl ${
                    !notif.isRead ? 'bg-slate-50/60' : ''
                  }`}
                >
                  <div className="mt-0.5 rounded bg-slate-50 p-1.5 border border-slate-100">
                    {getIcon(notif.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-1">
                      <h4 className={`text-xs text-slate-700 truncate ${!notif.isRead ? 'font-bold text-slate-950' : ''}`}>
                        {notif.title}
                      </h4>
                      <span className="text-[9px] text-slate-400 whitespace-nowrap font-mono">
                        {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed break-words line-clamp-2">
                      {notif.message}
                    </p>
                    {notif.link && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-950 font-bold mt-1.5 hover:underline">
                        View Details <ArrowRight className="h-2 w-2" />
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
