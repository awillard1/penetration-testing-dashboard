import { useQuery } from "@tanstack/react-query";
import { engagementsApi, operatorApi, settingsApi } from "../api/client";

export default function JobsPage() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.list });
  const activeEngId = Array.isArray(settings)
    ? settings.find((s: { key: string }) => s.key === "active_engagement_id")?.value
    : null;

  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });
  const engagementId = activeEngId || (engagements as Array<{ id: string }>)[0]?.id;

  const { data } = useQuery({
    queryKey: ["jobs-dashboard", engagementId],
    queryFn: () => operatorApi.jobs({ engagement_id: engagementId }),
    enabled: !!engagementId,
    refetchInterval: 4000,
  });

  if (!engagementId) return <div className="text-gray-400">Create an engagement to view jobs.</div>;

  const jobs = (data as { jobs?: Array<{ id: string; status: string; pid?: number; runtime_seconds?: number; command?: string }> })?.jobs || [];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-white">Jobs & Process Sessions</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-gray-900 border border-gray-800 rounded p-2"><div className="text-xs text-gray-500">Running</div><div className="text-xl font-bold text-white">{(data as { running?: number })?.running || 0}</div></div>
        <div className="bg-gray-900 border border-gray-800 rounded p-2"><div className="text-xs text-gray-500">Completed</div><div className="text-xl font-bold text-white">{(data as { completed?: number })?.completed || 0}</div></div>
        <div className="bg-gray-900 border border-gray-800 rounded p-2"><div className="text-xs text-gray-500">Failed</div><div className="text-xl font-bold text-white">{(data as { failed?: number })?.failed || 0}</div></div>
        <div className="bg-gray-900 border border-gray-800 rounded p-2"><div className="text-xs text-gray-500">Stopped</div><div className="text-xl font-bold text-white">{(data as { stopped?: number })?.stopped || 0}</div></div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">PID</th>
              <th className="px-3 py-2">Runtime</th>
              <th className="px-3 py-2">Command</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-b border-gray-800/50">
                <td className="px-3 py-2 text-gray-200">{job.status}</td>
                <td className="px-3 py-2 text-gray-400">{job.pid || "—"}</td>
                <td className="px-3 py-2 text-gray-400">{job.runtime_seconds ? `${job.runtime_seconds.toFixed(1)}s` : "—"}</td>
                <td className="px-3 py-2 text-gray-400 truncate max-w-xl">{job.command || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && <div className="text-gray-500 text-sm p-4">No jobs recorded yet.</div>}
      </div>
    </div>
  );
}
