import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Layout from "./components/layout/Layout";
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
import TargetWorkspacePage from "./pages/TargetWorkspacePage";
import JobsPage from "./pages/JobsPage";

export default function App() {
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

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/engagements" element={<EngagementsPage />} />
        <Route path="/engagements/:id" element={<EngagementDetailPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/targets" element={<TargetsPage />} />
        <Route path="/workspace/:id" element={<TargetWorkspacePage />} />
        <Route path="/findings" element={<FindingsPage />} />
        <Route path="/findings/:id" element={<FindingDetailPage />} />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route path="/credentials" element={<CredentialsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/commands" element={<CommandsPage />} />
        <Route path="/payloads" element={<PayloadsPage />} />
        <Route path="/links" element={<LinksPage />} />
        <Route path="/scans" element={<ScansPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}
