import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, type ReactElement } from "react";
import Layout from "./components/layout/Layout";
import { useAuth } from "./useAuth";
import {
  canManageEngagements,
  canManageRunners,
  canRetest,
  canReviewFindings,
  canRunCommands,
  canViewCredentials,
  canViewDashboard,
  canViewEvidence,
  homePathForUser,
} from "./lib/capabilities";
import DashboardPage from "./pages/DashboardPage";
import EngagementsPage from "./pages/EngagementsPage";
import EngagementDetailPage from "./pages/EngagementDetailPage";
import ClientsPage from "./pages/ClientsPage";
import TargetsPage from "./pages/TargetsPage";
import FindingsPage from "./pages/FindingsPage";
import FindingDetailPage from "./pages/FindingDetailPage";
import EvidencePage from "./pages/EvidencePage";
import CredentialsPage from "./pages/CredentialsPage";
import TasksPage from "./pages/TasksPage";
import NotesPage from "./pages/NotesPage";
import CommandsPage from "./pages/CommandsPage";
import PayloadsPage from "./pages/PayloadsPage";
import LinksPage from "./pages/LinksPage";
import ActivityPage from "./pages/ActivityPage";
import ReportsPage from "./pages/ReportsPage";
import ScansPage from "./pages/ScansPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import TargetWorkspacePage from "./pages/TargetWorkspacePage";
import JobsPage from "./pages/JobsPage";
import ReconPage from "./pages/ReconPage";
import MyWorkPage from "./pages/MyWorkPage";
import TestingPage from "./pages/TestingPage";
import RunnersPage from "./pages/RunnersPage";
import ReviewRetestPage from "./pages/ReviewRetestPage";

function guardedRoute(allowed: boolean, element: ReactElement, fallback: string) {
  return allowed ? element : <Navigate to={fallback} replace />;
}

export default function App() {
  const { isAuthenticated, isLoading, user } = useAuth();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const el = document.getElementById("global-search");
        if (el) el.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isLoading) {
    return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">Loading…</div>;
  }

  if (!isAuthenticated || !user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const homePath = homePathForUser(user);
  const canOperate = canManageEngagements(user);
  const canAccessReview = canReviewFindings(user) || canRetest(user);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={homePath} replace />} />
        <Route path="/login" element={<Navigate to={homePath} replace />} />
        <Route path="/dashboard" element={guardedRoute(canViewDashboard(user), <DashboardPage />, homePath)} />
        <Route path="/engagements" element={guardedRoute(canOperate, <EngagementsPage />, homePath)} />
        <Route path="/engagements/:id" element={guardedRoute(canOperate, <EngagementDetailPage />, homePath)} />
        <Route path="/clients" element={guardedRoute(canOperate, <ClientsPage />, homePath)} />
        <Route path="/targets" element={guardedRoute(canOperate, <TargetsPage />, homePath)} />
        <Route path="/workspace/:id" element={guardedRoute(canOperate, <TargetWorkspacePage />, homePath)} />
        <Route path="/findings" element={<FindingsPage />} />
        <Route path="/findings/:id" element={<FindingDetailPage />} />
        <Route path="/evidence" element={guardedRoute(canViewEvidence(user), <EvidencePage />, homePath)} />
        <Route path="/credentials" element={guardedRoute(canViewCredentials(user), <CredentialsPage />, homePath)} />
        <Route path="/tasks" element={guardedRoute(canOperate, <TasksPage />, homePath)} />
        <Route path="/my-work" element={guardedRoute(canOperate, <MyWorkPage />, homePath)} />
        <Route path="/testing" element={guardedRoute(canOperate, <TestingPage />, homePath)} />
        <Route path="/notes" element={guardedRoute(canOperate, <NotesPage />, homePath)} />
        <Route path="/commands" element={guardedRoute(canRunCommands(user), <CommandsPage />, homePath)} />
        <Route path="/payloads" element={guardedRoute(canOperate, <PayloadsPage />, homePath)} />
        <Route path="/links" element={guardedRoute(canOperate, <LinksPage />, homePath)} />
        <Route path="/scans" element={guardedRoute(canOperate, <ScansPage />, homePath)} />
        <Route path="/recon" element={guardedRoute(canOperate, <ReconPage />, homePath)} />
        <Route path="/activity" element={guardedRoute(canOperate, <ActivityPage />, homePath)} />
        <Route path="/reports" element={guardedRoute(canOperate, <ReportsPage />, homePath)} />
        <Route path="/jobs" element={guardedRoute(canRunCommands(user), <JobsPage />, homePath)} />
        <Route path="/settings" element={guardedRoute(canOperate, <SettingsPage />, homePath)} />
        <Route path="/runners" element={guardedRoute(canManageRunners(user), <RunnersPage />, homePath)} />
        <Route path="/review" element={guardedRoute(canAccessReview, <ReviewRetestPage />, homePath)} />
        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Routes>
    </Layout>
  );
}
