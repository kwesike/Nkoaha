import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import NavigationLoader from "./auth/NavigationLoader";
import ProtectedRoute from "./auth/ProtectedRoute";
import DashboardLayout from "./dashboard/layout/DashboardLayout";

// ── Lazy-loaded pages — only downloads when the route is visited ──
const SignupSelect                 = lazy(() => import("./auth/SignupSelect"));
const IndividualSignup             = lazy(() => import("./auth/IndividualSignup"));
const OrganizationSignup           = lazy(() => import("./auth/OrganizationSignup"));
const Login                        = lazy(() => import("./auth/Login"));
const MFASetup                     = lazy(() => import("./auth/MFASetup"));
const MFAVerify                    = lazy(() => import("./auth/MFAVerify"));
const ForgotPassword               = lazy(() => import("./auth/ForgotPassword"));
const ResetPassword                = lazy(() => import("./auth/ResetPassword"));
const JoinOrg                      = lazy(() => import("./auth/JoinOrg"));
const MFASetupInvite               = lazy(() => import("./auth/MFASetupInvite"));
const IndividualOnboarding         = lazy(() => import("./auth/IndividualOnboarding"));
const OrganizationOnboarding       = lazy(() => import("./auth/OrganizationOnboarding"));

const IndividualDashboard          = lazy(() => import("./dashboard/IndividualDashboard"));
const OrganizationDashboard        = lazy(() => import("./dashboard/OrganizationDashboard"));
const OrganizationmembersDashboard = lazy(() => import("./dashboard/OrganizationmembersDashboard"));
const OrgMembersPage               = lazy(() => import("./dashboard/Orgmemberspage"));
const OrgAuditPage                 = lazy(() => import("./dashboard/Orgauditpage"));
const PartnershipsPage             = lazy(() => import("./dashboard/PartnershipsPage"));
const BillingPage                  = lazy(() => import("./dashboard/Billingpage"));
const SettingsPage                 = lazy(() => import("./dashboard/Settingspage"));
const InboxPage                    = lazy(() => import("./dashboard/inbox/InboxPage"));
const DocumentsPage                = lazy(() => import("./dashboard/documents/DocumentsPage"));

const AdminOverviewPage            = lazy(() => import("./admin/AdminOverviewPage"));
const AdminUsersPage               = lazy(() => import("./admin/AdminUsersPage"));
const AdminOrganizationsPage       = lazy(() => import("./admin/AdminOrganizationsPage"));
const AdminSubscriptionsPage       = lazy(() => import("./admin/AdminSubscriptionsPage"));
const AdminDocumentsPage           = lazy(() => import("./admin/AdminDocumentsPage"));
const AdminAuditLogsPage           = lazy(() => import("./admin/AdminAuditlogsPage")); // lowercase 'l' matches filename
const SupportInboxPage             = lazy(() => import("./dashboard/support/SupportInboxPage"));
const AdminTeamPage               = lazy(() => import("./admin/AdminTeamPage"));

function PageLoader() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#f5f3ef",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "3px solid #e7e4df", borderTopColor: "#7c3aed",
        animation: "spin 0.7s linear infinite",
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <NavigationLoader />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth */}
          <Route path="/"                       element={<Login />} />
          <Route path="/signup"                 element={<SignupSelect />} />
          <Route path="/signup/individual"      element={<IndividualSignup />} />
          <Route path="/signup/organization"    element={<OrganizationSignup />} />
          <Route path="/mfa"                    element={<MFASetup />} />
          <Route path="/mfa-verify"             element={<MFAVerify />} />
          <Route path="/forgot-password"        element={<ForgotPassword />} />
          <Route path="/reset-password"         element={<ResetPassword />} />
          <Route path="/join-org"               element={<JoinOrg />} />
          <Route path="/mfa-setup"              element={<MFASetupInvite />} />

          {/* Onboarding */}
          <Route path="/individual"   element={<ProtectedRoute><IndividualOnboarding /></ProtectedRoute>} />
          <Route path="/organization" element={<ProtectedRoute><OrganizationOnboarding /></ProtectedRoute>} />

          {/* ── INDIVIDUAL ── */}
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
          <Route path="/dashboard/admin"                 element={<AdminOverviewPage />} />
          <Route path="/dashboard/admin/users"           element={<AdminUsersPage />} />
          <Route path="/dashboard/admin/support"         element={<SupportInboxPage />} />
          <Route path="/dashboard/admin/organizations"   element={<AdminOrganizationsPage />} />
          <Route path="/dashboard/admin/subscriptions"   element={<AdminSubscriptionsPage />} />
          <Route path="/dashboard/admin/documents"       element={<AdminDocumentsPage />} />
          <Route path="/dashboard/admin/audit"           element={<AdminAuditLogsPage />} />
          <Route path="/dashboard/admin/team"            element={<AdminTeamPage />} />

          {/* ── ORGANIZATION ── */}
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

          {/* ── ORGANIZATION MEMBER ── */}
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;