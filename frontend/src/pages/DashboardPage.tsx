import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { engagementsApi, operatorApi, settingsApi, targetApi } from "../api/client";
import { buildOperationalAlerts, endpointCoverageBreakdown, type EndpointRecord } from "../utils/commandCenter";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [selectedTargetId, setSelectedTargetId] = useState("");

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.list });
  const activeEngId = Array.isArray(settings)
    ? settings.find((s: { key: string }) => s.key === "active_engagement_id")?.value
    : null;

  const { data: summary, isLoading } = useQuery({
    queryKey: ["engagement-summary", activeEngId],
    queryFn: () => engagementsApi.summary(activeEngId!),
    enabled: !!activeEngId,
    refetchInterval: 12000,
  });

  const { data: targets = [] } = useQuery({
    queryKey: ["targets", activeEngId],
    queryFn: () => targetApi.list({ engagement_id: activeEngId }),
    enabled: !!activeEngId,
  });

  useEffect(() => {
    if (!selectedTargetId && Array.isArray(targets) && targets.length > 0) {
      setSelectedTargetId(targets[0].id);
    }
  }, [targets, selectedTargetId]);

  const { data: workspace } = useQuery({
    queryKey: ["dashboard-workspace", activeEngId, selectedTargetId],
    queryFn: () => operatorApi.workspace(activeEngId!, selectedTargetId),
    enabled: !!activeEngId && !!selectedTargetId,
    refetchInterval: 8000,
  });

  const { data: jobs } = useQuery({
    queryKey: ["jobs-dashboard", activeEngId],
    queryFn: () => operatorApi.jobs({ engagement_id: activeEngId }),
    enabled: !!activeEngId,
    refetchInterval: 4000,
  });

  const endpoints = useMemo(
    () => (((workspace as { inventory?: { endpoints?: EndpointRecord[] } })?.inventory?.endpoints || []) as EndpointRecord[]),
    [workspace]
  );
  const coverage = endpointCoverageBreakdown(endpoints);
  const alerts = buildOperationalAlerts(summary || {});

  const interestingEndpoints = useMemo(() => {
    return endpoints
      .filter((e) => e.testing_status === "finding" || e.testing_status === "not_tested")
      .slice(0, 8);
  }, [endpoints]);

  if (isLoading) return <div className="text-gray-400">Loading command center…</div>;

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
        <h1 className="text-xl font-bold text-white">No active engagement selected</h1>
        <p className="text-gray-400 max-w-sm">Set an active engagement from Engagements, then return to Command Center.</p>
        <button
          onClick={() => navigate("/engagements")}
          className="px-4 py-2 bg-brand-500 text-black rounded font-medium hover:bg-brand-600"
        >
          Open Engagements
        </button>
      </div>
    );
  }

  const currentTarget = (targets as Array<{ id: string; hostname?: string; ip_address?: string; url?: string }>).find((t) => t.id === selectedTargetId);

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-white">{summary.active_engagement?.name || "Active Engagement"}</h1>
            <p className="text-xs text-gray-400 mt-1">
              Day {summary.day_counter || 0} · {summary.active_engagement?.status || "draft"} · Coverage {summary.coverage_percent || 0}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Testing window: {summary.active_engagement?.testing_window || "not set"}
            </p>
          </div>
          <button onClick={() => navigate(`/engagements/${summary.active_engagement?.id}`)} className="text-xs text-brand-400 hover:text-brand-300">
            Engagement Details →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:col-span-3">
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Targets</h2>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {(targets as Array<{ id: string; hostname?: string; ip_address?: string; url?: string }>).map((t) => {
              const title = t.hostname || t.ip_address || t.url || "target";
              const selected = selectedTargetId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTargetId(t.id)}
                  className={`w-full text-left px-2 py-1.5 rounded text-xs border ${selected ? "bg-brand-500/20 text-brand-300 border-brand-500/40" : "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"}`}
                >
                  {title}
                </button>
              );
            })}
            {(targets as Array<unknown>).length === 0 && <div className="text-xs text-gray-500">No targets yet.</div>}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:col-span-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-300">Current Work</h2>
            {currentTarget && (
              <button
                onClick={() => navigate(`/workspace/${currentTarget.id}?engagementId=${activeEngId}`)}
                className="text-xs text-brand-400 hover:text-brand-300"
              >
                Open Workspace →
              </button>
            )}
          </div>
          <div className="text-xs text-gray-400 mb-2 truncate">
            {currentTarget?.hostname || currentTarget?.ip_address || currentTarget?.url || "Select target"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-gray-800 rounded p-2 text-gray-300">Hosts: {workspace?.inventory?.hosts?.length || 0}</div>
            <div className="bg-gray-800 rounded p-2 text-gray-300">Services: {workspace?.inventory?.services?.length || 0}</div>
            <div className="bg-gray-800 rounded p-2 text-gray-300">Endpoints: {workspace?.inventory?.endpoints?.length || 0}</div>
            <div className="bg-gray-800 rounded p-2 text-gray-300">Credentials: {workspace?.credentials?.length || 0}</div>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {interestingEndpoints.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-xs bg-gray-800 rounded px-2 py-1.5">
                <div className="truncate text-gray-200">
                  <span className="text-brand-300 mr-1">{e.method || "GET"}</span>
                  {e.path}
                </div>
                <span className={`ml-2 ${e.testing_status === "finding" ? "text-red-300" : "text-amber-300"}`}>
                  {e.testing_status === "finding" ? "finding" : "untested"}
                </span>
              </div>
            ))}
            {interestingEndpoints.length === 0 && <div className="text-xs text-gray-500">No queued endpoint highlights for this target.</div>}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:col-span-3">
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Live Jobs</h2>
          <div className="grid grid-cols-2 gap-2 text-xs mb-2">
            <div className="bg-gray-800 rounded p-2 text-gray-300">Running: {jobs?.running || 0}</div>
            <div className="bg-gray-800 rounded p-2 text-gray-300">Failed: {jobs?.failed || 0}</div>
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {(jobs?.jobs || []).slice(0, 8).map((job: { id: string; status: string; command: string; runtime_seconds?: number }) => (
              <div key={job.id} className="bg-gray-800 rounded p-2 text-xs">
                <div className="flex justify-between text-gray-200">
                  <span>{job.status.toUpperCase()}</span>
                  <span className="text-gray-500">{job.runtime_seconds ? `${job.runtime_seconds.toFixed(1)}s` : "—"}</span>
                </div>
                <div className="text-gray-400 truncate mt-1">{job.command}</div>
              </div>
            ))}
            {(!jobs?.jobs || jobs.jobs.length === 0) && <div className="text-xs text-gray-500">No jobs in history.</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:col-span-3">
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Test Queue (Today)</h2>
          <div className="space-y-1 text-xs">
            <div className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">Untested endpoints: {coverage.untested || summary.untested_endpoints || 0}</div>
            <div className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">Authorization / active tests: {coverage.testing}</div>
            <div className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">Retests pending: {summary.pending_retests || 0}</div>
            <div className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">Findings needing review: {summary.pending_review || 0}</div>
            <div className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">Draft findings: {summary.draft_findings || 0}</div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:col-span-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Activity / Discoveries</h2>
          <div className="space-y-1 max-h-52 overflow-y-auto text-xs">
            {(summary.recent_activity || []).map((ev: { id: string; event_type: string; description?: string; created_at: string }) => (
              <div key={ev.id} className="bg-gray-800 rounded px-2 py-1.5">
                <div className="text-gray-200">{ev.event_type}</div>
                {ev.description && <div className="text-gray-400">{ev.description}</div>}
                <div className="text-gray-600">{new Date(ev.created_at).toLocaleString()}</div>
              </div>
            ))}
            {(summary.recent_activity || []).length === 0 && <div className="text-gray-500">No discoveries yet.</div>}
          </div>
          <h3 className="text-xs font-semibold text-gray-400 mt-3 mb-1">Active Alerts</h3>
          <div className="space-y-1">
            {alerts.slice(0, 6).map((alert) => (
              <div key={alert} className="text-xs rounded bg-amber-900/20 border border-amber-700/30 px-2 py-1 text-amber-200">
                ⚠ {alert}
              </div>
            ))}
            {alerts.length === 0 && <div className="text-xs text-gray-500">No active operational alerts.</div>}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:col-span-3">
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-2">
            <button onClick={() => navigate("/findings")} className="bg-gray-800 hover:bg-gray-700 text-xs text-left px-2 py-2 rounded text-gray-200">+ Finding</button>
            <button onClick={() => navigate("/notes")} className="bg-gray-800 hover:bg-gray-700 text-xs text-left px-2 py-2 rounded text-gray-200">+ Note</button>
            <button onClick={() => navigate("/evidence")} className="bg-gray-800 hover:bg-gray-700 text-xs text-left px-2 py-2 rounded text-gray-200">+ Evidence</button>
            <button onClick={() => navigate(currentTarget ? `/workspace/${currentTarget.id}?engagementId=${activeEngId}` : "/targets")} className="bg-gray-800 hover:bg-gray-700 text-xs text-left px-2 py-2 rounded text-gray-200">Open Target Workspace</button>
            <button onClick={() => navigate("/jobs")} className="bg-gray-800 hover:bg-gray-700 text-xs text-left px-2 py-2 rounded text-gray-200">Run Tool / View Jobs</button>
          </div>
        </div>
      </div>
    </div>
  );
}
