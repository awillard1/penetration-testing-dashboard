import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { engagementsApi, settingsApi } from "../api/client";
import { StatusBadge } from "../components/ui/Badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Shield, Target, AlertTriangle, FileImage, Key, Radar, CheckSquare, Activity } from "lucide-react";

const SEV_CHART_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#d97706",
  low: "#2563eb",
  informational: "#6b7280",
};

export default function DashboardPage() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.list });
  const activeEngId = Array.isArray(settings)
    ? settings.find((s: { key: string }) => s.key === "active_engagement_id")?.value
    : null;

  const { data: summary, isLoading } = useQuery({
    queryKey: ["engagement-summary", activeEngId],
    queryFn: () => engagementsApi.summary(activeEngId!),
    enabled: !!activeEngId,
  });

  const navigate = useNavigate();

  if (isLoading) return <div className="text-gray-400">Loading dashboard…</div>;

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <Shield size={48} className="text-brand-400" />
        <h1 className="text-xl font-bold text-white">Welcome to PentestDashboard</h1>
        <p className="text-gray-400 max-w-sm">
          Create an engagement to get started, then run the seed script to populate demo data.
        </p>
        <button
          onClick={() => navigate("/engagements")}
          className="px-4 py-2 bg-brand-500 text-black rounded font-medium hover:bg-brand-600"
        >
          Create Engagement
        </button>
      </div>
    );
  }

  const sevData = Object.entries(summary.findings_by_severity || {}).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value: value as number,
    key: name,
  }));

  const statCards = [
    { icon: Target, label: "Targets", value: summary.total_targets, path: "/targets" },
    { icon: AlertTriangle, label: "Findings", value: summary.total_findings, path: "/findings" },
    { icon: FileImage, label: "Evidence", value: summary.evidence_count, path: "/evidence" },
    { icon: Key, label: "Credentials", value: summary.credential_count, path: "/credentials" },
    { icon: Radar, label: "Scans", value: summary.scan_count, path: "/scans" },
    { icon: CheckSquare, label: "Open Tasks", value: summary.open_tasks, path: "/tasks" },
  ];

  return (
    <div className="space-y-6">
      {/* Engagement header */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-gray-500 uppercase mb-1">Active Engagement</p>
            <h1 className="text-lg font-bold text-white">{summary.active_engagement?.name}</h1>
            <div className="flex gap-2 mt-2">
              <StatusBadge status={summary.active_engagement?.status || "draft"} />
              <span className="text-xs text-gray-500">{summary.active_engagement?.engagement_type}</span>
            </div>
          </div>
          <button
            onClick={() => navigate(`/engagements/${summary.active_engagement?.id}`)}
            className="text-xs text-brand-400 hover:text-brand-300"
          >
            View →
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(({ icon: Icon, label, value, path }) => (
          <button
            key={label}
            onClick={() => navigate(path)}
            className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-left hover:border-brand-500/50 transition-colors"
          >
            <Icon size={16} className="text-brand-400 mb-1" />
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-gray-400">{label}</div>
          </button>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Findings by Severity</h3>
          {sevData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={sevData}>
                <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", color: "#f9fafb" }}
                />
                <Bar dataKey="value">
                  {sevData.map((d) => (
                    <Cell key={d.key} fill={SEV_CHART_COLORS[d.key] || "#6b7280"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm">No findings yet</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Activity</h3>
          {summary.recent_activity?.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {summary.recent_activity.map((ev: { id: string; event_type: string; description?: string; created_at: string }) => (
                <div key={ev.id} className="flex items-start gap-2 text-xs">
                  <Activity size={12} className="text-brand-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-gray-300">{ev.event_type}</span>
                    {ev.description && <span className="text-gray-500 ml-1">{ev.description}</span>}
                    <div className="text-gray-600">{new Date(ev.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
