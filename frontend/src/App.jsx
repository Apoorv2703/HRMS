import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
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

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register-tenant" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/onboard" element={<OnboardingVerification />} />

      {/* Protected Routes (Authenticated Access Only) */}
      <Route element={<ProtectedRoute />}>
        {/* Core Layout Routes */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/directory" element={<DirectoryPage />} />
          <Route path="/org-chart" element={<OrgChartPage />} />
          <Route path="/profile" element={<ESSProfilePage />} />
          
          {/* Reports Management Routes */}
          <Route element={<ProtectedRoute allowedRoles={['HR_ADMIN', 'LEADERSHIP', 'MANAGER']} />}>
            <Route path="/muster" element={<MusterPage />} />
          </Route>
          
          {/* Admin Protected Layout Routes */}
          <Route element={<ProtectedRoute allowedRoles={['HR_ADMIN']} />}>
            <Route path="/onboard-staff" element={<OnboardingWizard />} />
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
