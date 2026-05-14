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
        <Route path="/mfa-setup" element={<MFASetup />} />
        <Route path="/mfa-verify" element={<MFAVerify />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Onboarding */}
        <Route path="/individual"  element={<ProtectedRoute><IndividualOnboarding /></ProtectedRoute>} />
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
        <Route path="/dashboard/send" element={
          <ProtectedRoute>
            <DashboardLayout><div>Send Page</div></DashboardLayout>
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