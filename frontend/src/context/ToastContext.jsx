import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  // Resolve matching icons and Tailwind styles
  const getToastStyle = (type) => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
          bgColor: 'bg-white/90 border-emerald-100 shadow-emerald-500/10',
          textColor: 'text-slate-800',
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />,
          bgColor: 'bg-white/90 border-rose-100 shadow-rose-500/10',
          textColor: 'text-slate-800',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
          bgColor: 'bg-white/90 border-amber-100 shadow-amber-500/10',
          textColor: 'text-slate-800',
        };
      case 'info':
      default:
        return {
          icon: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
          bgColor: 'bg-white/90 border-blue-100 shadow-blue-500/10',
          textColor: 'text-slate-800',
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Portal Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map((toast) => {
          const { icon, bgColor, textColor } = getToastStyle(toast.type);
          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 rounded-2xl border p-4 shadow-xl backdrop-blur-md transition-all duration-350 transform translate-y-0 opacity-100 animate-slide-in pointer-events-auto ${bgColor} ${textColor}`}
              role="alert"
            >
              {icon}
              <div className="flex-1 text-xs font-semibold leading-5 pr-1">
                {toast.message}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-650 transition shrink-0 cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
