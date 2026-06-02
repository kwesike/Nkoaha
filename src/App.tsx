import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import SignupSelect from "./auth/SignupSelect";
import IndividualSignup from "./auth/IndividualSignup";
import OrganizationSignup from "./auth/OrganizationSignup";
import Login from "./auth/Login";
import MFASetup from "./auth/MFASetup";
import MFAVerify from "./auth/MFAVerify";
import IndividualDashboard from "./dashboard/IndividualDashboard";
import OrganizationDashboard from "./dashboard/OrganizationDashboard";
import OrganizationmembersDashboard from "./dashboard/OrganizationmembersDashboard";
import OrgMembersPage from "./dashboard/Orgmemberspage";
import OrgAuditPage from "./dashboard/Orgauditpage";
import PartnershipsPage from "./dashboard/PartnershipsPage";
import BillingPage from "./dashboard/Billingpage";
import SettingsPage from "./dashboard/Settingspage";
import ForgotPassword from "./auth/ForgotPassword";
import ResetPassword from "./auth/ResetPassword";
import ProtectedRoute from "./auth/ProtectedRoute";
import IndividualOnboarding from "./auth/IndividualOnboarding";
import OrganizationOnboarding from "./auth/OrganizationOnboarding";
import InboxPage from "./dashboard/inbox/InboxPage";
import DashboardLayout from "./dashboard/layout/DashboardLayout";
import DocumentsPage from "./dashboard/documents/DocumentsPage";
import NavigationLoader from "./auth/NavigationLoader";
import JoinOrg from "./auth/JoinOrg";
import MFASetupInvite from "./auth/MFASetupInvite";
import AdminOverviewPage from "./admin/AdminOverviewPage";
import AdminUsersPage from "./admin/AdminUsersPage";
import SupportInboxPage from "./dashboard/support/SupportInboxPage";
import AdminOrganizationsPage from "./admin/AdminOrganizationsPage";
import AdminSubscriptionsPage from "./admin/AdminSubscriptionsPage";
import AdminDocumentsPage from "./admin/AdminDocumentsPage";
import AdminAuditLogsPage from "./admin/AdminAuditlogsPage";

function App() {
  return (
    <BrowserRouter>
      <NavigationLoader />
      <Routes>
        {/* Auth */}
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<SignupSelect />} />
        <Route path="/signup/individual" element={<IndividualSignup />} />
        <Route path="/signup/organization" element={<OrganizationSignup />} />
        <Route path="/mfa" element={<MFASetup />} />
        <Route path="/mfa-verify" element={<MFAVerify />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/join-org" element={<JoinOrg />} />
        <Route path="/mfa-setup" element={<MFASetupInvite />} />

        {/* Onboarding */}
        <Route path="/individual"   element={<ProtectedRoute><IndividualOnboarding /></ProtectedRoute>} />
        <Route path="/organization" element={<ProtectedRoute><OrganizationOnboarding /></ProtectedRoute>} />

        {/* ── INDIVIDUAL DASHBOARD ── */}
        <Route path="/dashboard/individualdashboard" element={
          <ProtectedRoute><IndividualDashboard /></ProtectedRoute>
        } />
        <Route path="/dashboard/individual" element={
          <ProtectedRoute>
            <DashboardLayout><DocumentsPage /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/inbox/inboxpage" element={
          <ProtectedRoute><InboxPage /></ProtectedRoute>
        } />
        <Route path="/dashboard/inbox" element={
          <ProtectedRoute><InboxPage /></ProtectedRoute>
        } />
        <Route path="/dashboard/billing" element={
          <ProtectedRoute><BillingPage /></ProtectedRoute>
        } />
        <Route path="/dashboard/settings" element={
          <ProtectedRoute><SettingsPage /></ProtectedRoute>
        } />

        {/* ── ADMIN PANEL ── */}
        <Route path="/dashboard/admin"              element={<AdminOverviewPage />} />
        <Route path="/dashboard/admin/users"        element={<AdminUsersPage />} />
        <Route path="/dashboard/admin/support"      element={<SupportInboxPage />} />
        <Route path="/dashboard/admin/organizations"  element={<AdminOrganizationsPage />} />
        <Route path="/dashboard/admin/subscriptions"  element={<AdminSubscriptionsPage />} />
        <Route path="/dashboard/admin/documents"      element={<AdminDocumentsPage />} />
        <Route path="/dashboard/admin/audit"          element={<AdminAuditLogsPage />} />

        {/* ── ORGANIZATION DASHBOARD ── */}
        <Route path="/dashboard/organizationdashboard" element={
          <ProtectedRoute><OrganizationDashboard /></ProtectedRoute>
        } />
        <Route path="/dashboard/organization" element={
          <ProtectedRoute>
            <DashboardLayout><DocumentsPage /></DashboardLayout>
          </ProtectedRoute>
        } />
        <Route path="/dashboard/org/members" element={
          <ProtectedRoute><OrgMembersPage /></ProtectedRoute>
        } />
        <Route path="/dashboard/org/audit" element={
          <ProtectedRoute><OrgAuditPage /></ProtectedRoute>
        } />
        <Route path="/dashboard/partnerships" element={
          <ProtectedRoute><PartnershipsPage /></ProtectedRoute>
        } />
        <Route path="/dashboard/overview" element={
          <ProtectedRoute><OrganizationDashboard /></ProtectedRoute>
        } />

        {/* ── ORGANIZATION MEMBER DASHBOARD ── */}
        <Route path="/dashboard/organizationmembersdashboard" element={
          <ProtectedRoute><OrganizationmembersDashboard /></ProtectedRoute>
        } />
        <Route path="/dashboard/member" element={
          <ProtectedRoute>
            <DashboardLayout><DocumentsPage /></DashboardLayout>
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;