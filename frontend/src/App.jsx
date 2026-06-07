import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { loginSuccess, logout } from './store/authSlice';
import api from './services/api';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import Unauthorized from './pages/Unauthorized';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import DirectoryPage from './pages/DirectoryPage';
import OnboardingWizard from './pages/OnboardingWizard';
import OnboardingVerification from './pages/OnboardingVerification';
import ESSProfilePage from './pages/ESSProfilePage';
import OrgChartPage from './pages/OrgChartPage';
import MusterPage from './pages/MusterPage';
import LeaveDashboardPage from './pages/LeaveDashboardPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import WorkflowConfigPage from './pages/WorkflowConfigPage';
import ReportsPage from './pages/ReportsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

let checkSessionPromise = null;

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    const checkSession = async () => {
      if (!checkSessionPromise) {
        checkSessionPromise = api.post('/auth/refresh-token', {}, { withCredentials: true })
          .then((res) => {
            checkSessionPromise = null;
            return res.data;
          })
          .catch((err) => {
            checkSessionPromise = null;
            throw err;
          });
      }

      try {
        const data = await checkSessionPromise;
        dispatch(loginSuccess(data));
      } catch (err) {
        dispatch(logout());
      }
    };
    checkSession();
  }, [dispatch]);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register-tenant" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/onboard" element={<OnboardingVerification />} />
      <Route path="/auth/callback/:provider" element={<AuthCallbackPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Protected Routes (Authenticated Access Only) */}
      <Route element={<ProtectedRoute />}>
        {/* Core Layout Routes */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/directory" element={<DirectoryPage />} />
          <Route path="/org-chart" element={<OrgChartPage />} />
          <Route path="/profile" element={<ESSProfilePage />} />
          <Route path="/leaves" element={<LeaveDashboardPage />} />
          
          {/* Muster — Manager/Admin only */}
          <Route element={<ProtectedRoute allowedRoles={['HR_ADMIN', 'LEADERSHIP', 'MANAGER']} />}>
            <Route path="/muster" element={<MusterPage />} />
          </Route>

          {/* Reports — all authenticated roles (scoped per role on backend) */}
          <Route path="/reports" element={<ReportsPage />} />
          
          {/* Admin Protected Layout Routes */}
          <Route element={<ProtectedRoute allowedRoles={['HR_ADMIN']} />}>
            <Route path="/onboard-staff" element={<OnboardingWizard />} />
            <Route path="/workflows" element={<WorkflowConfigPage />} />
          </Route>
        </Route>
      </Route>

      {/* Wildcard Fallbacks */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
