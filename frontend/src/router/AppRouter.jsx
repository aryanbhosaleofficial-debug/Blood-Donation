import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { RoleRoute } from './RoleRoute.jsx';

// Pages
import { HomePage } from '../pages/HomePage.jsx';
import { LoginPage } from '../pages/auth/LoginPage.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';

// Hospital Pages
import { HospitalDashboardPage } from '../pages/hospital/HospitalDashboardPage.jsx';
import { HospitalProfilePage } from '../pages/hospital/HospitalProfilePage.jsx';
import { CreateRequestPage } from '../pages/hospital/CreateRequestPage.jsx';
import { RequestListPage } from '../pages/hospital/RequestListPage.jsx';
import { RequestDetailPage } from '../pages/hospital/RequestDetailPage.jsx';

// Blood Bank Pages
import { BloodBankProfilePage } from '../pages/blood-bank/BloodBankProfilePage.jsx';
import { InventoryPage } from '../pages/blood-bank/InventoryPage.jsx';
import { IncomingRequestsPage } from '../pages/blood-bank/IncomingRequestsPage.jsx';
import { BloodBankRequestDetailPage } from '../pages/blood-bank/BloodBankRequestDetailPage.jsx';
import { AllocationHistoryPage } from '../pages/blood-bank/AllocationHistoryPage.jsx';

// Donor Pages
import { DonorDashboardPage } from '../pages/donor/DonorDashboardPage.jsx';
import { DonorProfilePage } from '../pages/donor/DonorProfilePage.jsx';
import { DonorAvailabilityPage } from '../pages/donor/DonorAvailabilityPage.jsx';
import { DonorAlertsPage } from '../pages/donor/DonorAlertsPage.jsx';
import { DonorAlertDetailPage } from '../pages/donor/DonorAlertDetailPage.jsx';
import { DonorPledgesPage } from '../pages/donor/DonorPledgesPage.jsx';
import { DonorPledgeDetailPage } from '../pages/donor/DonorPledgeDetailPage.jsx';

// Admin Pages
import { OrganizationVerificationPage } from '../pages/admin/OrganizationVerificationPage.jsx';
import { OperationalMetricsPage } from '../pages/admin/OperationalMetricsPage.jsx';
import { AuditLogsPage } from '../pages/admin/AuditLogsPage.jsx';
import { SurgeDashboardPage } from '../pages/admin/SurgeDashboardPage.jsx';
import { SurgeDetailPage } from '../pages/admin/SurgeDetailPage.jsx';

export function AppRouter() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Main app shell */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />

        {/* Hospital Protected Routes */}
        <Route
          path="/hospital"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['HOSPITAL']}>
                <HospitalDashboardPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospital/profile"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['HOSPITAL']}>
                <HospitalProfilePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospital/requests"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['HOSPITAL']}>
                <RequestListPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospital/requests/new"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['HOSPITAL']}>
                <CreateRequestPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hospital/requests/:requestId"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['HOSPITAL']}>
                <RequestDetailPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Blood Bank Protected Routes */}
        <Route
          path="/blood-bank"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['BLOOD_BANK']}>
                <BloodBankProfilePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/blood-bank/profile"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['BLOOD_BANK']}>
                <BloodBankProfilePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/blood-bank/inventory"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['BLOOD_BANK']}>
                <InventoryPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/blood-bank/requests"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['BLOOD_BANK']}>
                <IncomingRequestsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/blood-bank/requests/:requestId"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['BLOOD_BANK']}>
                <BloodBankRequestDetailPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/blood-bank/allocations"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['BLOOD_BANK']}>
                <AllocationHistoryPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Donor Protected Routes */}
        <Route
          path="/donor"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['DONOR']}>
                <DonorDashboardPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/donor/profile"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['DONOR']}>
                <DonorProfilePage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/donor/availability"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['DONOR']}>
                <DonorAvailabilityPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/donor/alerts"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['DONOR']}>
                <DonorAlertsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/donor/alerts/:alertId"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['DONOR']}>
                <DonorAlertDetailPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/donor/pledges"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['DONOR']}>
                <DonorPledgesPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/donor/pledges/:pledgeId"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['DONOR']}>
                <DonorPledgeDetailPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* Admin Protected Routes */}
        <Route
          path="/admin"
          element={<Navigate to="/admin/organizations" replace />}
        />
        <Route
          path="/admin/organizations"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN']}>
                <OrganizationVerificationPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/metrics"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN']}>
                <OperationalMetricsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-logs"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN']}>
                <AuditLogsPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/surge"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN']}>
                <SurgeDashboardPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/surge/candidates/:candidateId"
          element={
            <ProtectedRoute>
              <RoleRoute allowedRoles={['ADMIN']}>
                <SurgeDetailPage />
              </RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* 404 catch-all */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
