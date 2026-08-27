import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Layout from "./components/layout/Layout";
import { useAuth } from "./useAuth";
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

export default function App() {
  const { isAuthenticated, isLoading, user } = useAuth();

  // Keyboard shortcut: Ctrl+K for global search
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

  const isClient = user.role === "client";
  const homePath = isClient ? "/findings" : "/dashboard";

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={homePath} replace />} />
        <Route path="/login" element={<Navigate to={homePath} replace />} />
        {!isClient && <Route path="/dashboard" element={<DashboardPage />} />}
        {!isClient && <Route path="/engagements" element={<EngagementsPage />} />}
        {!isClient && <Route path="/engagements/:id" element={<EngagementDetailPage />} />}
        {!isClient && <Route path="/clients" element={<ClientsPage />} />}
        {!isClient && <Route path="/targets" element={<TargetsPage />} />}
        <Route path="/findings" element={<FindingsPage />} />
        <Route path="/findings/:id" element={<FindingDetailPage />} />
        {!isClient && <Route path="/evidence" element={<EvidencePage />} />}
        {!isClient && <Route path="/credentials" element={<CredentialsPage />} />}
        {!isClient && <Route path="/tasks" element={<TasksPage />} />}
        {!isClient && <Route path="/notes" element={<NotesPage />} />}
        {!isClient && <Route path="/commands" element={<CommandsPage />} />}
        {!isClient && <Route path="/payloads" element={<PayloadsPage />} />}
        {!isClient && <Route path="/links" element={<LinksPage />} />}
        {!isClient && <Route path="/scans" element={<ScansPage />} />}
        {!isClient && <Route path="/activity" element={<ActivityPage />} />}
        {!isClient && <Route path="/reports" element={<ReportsPage />} />}
        {!isClient && <Route path="/settings" element={<SettingsPage />} />}
        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Routes>
    </Layout>
  );
}
