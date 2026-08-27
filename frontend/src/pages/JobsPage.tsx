import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { engagementsApi, operatorApi, settingsApi } from "../api/client";
import { Input, Select } from "../components/ui/Input";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import toast from "react-hot-toast";

export default function JobsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.list });
  const activeEngId = Array.isArray(settings)
    ? settings.find((s: { key: string }) => s.key === "active_engagement_id")?.value
    : null;

  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });
  const engagementId = activeEngId || (engagements as Array<{ id: string }>)[0]?.id;

  const { data: runs = [] } = useQuery({
    queryKey: ["command-runs", engagementId, statusFilter],
    queryFn: () => operatorApi.listCommandRuns({ engagement_id: engagementId, ...(statusFilter ? { status: statusFilter } : {}) }),
    enabled: !!engagementId,
    refetchInterval: 4000,
  });

  const stopMut = useMutation({
    mutationFn: (id: string) => operatorApi.stopCommand(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["command-runs"] });
      toast.success("Job stop requested");
    },
    onError: () => toast.error("Failed to stop job"),
  });

  const filteredRuns = useMemo(() => {
    const records = runs as Array<{
      id: string;
      status: string;
      pid?: number;
      runtime_seconds?: number;
      command_executed?: string;
      command_preview?: string;
      target_id?: string;
      stdout?: string;
      stderr?: string;
      execution_profile?: string;
      created_at?: string;
      started_at?: string;
      ended_at?: string;
      exit_code?: number;
      working_directory?: string;
      output_location?: string;
    }>;
    return records.filter((r) => {
      if (!query) return true;
      return `${r.command_executed || r.command_preview || ""} ${r.status} ${r.target_id || ""}`.toLowerCase().includes(query.toLowerCase());
    });
  }, [runs, query]);

  const selected = filteredRuns.find((r) => r.id === selectedId);

  const counts = {
    running: filteredRuns.filter((r) => r.status === "running").length,
    completed: filteredRuns.filter((r) => r.status === "completed").length,
    failed: filteredRuns.filter((r) => r.status === "failed").length,
    stopped: filteredRuns.filter((r) => r.status === "stopped").length,
  };

  if (!engagementId) return <div className="text-gray-400">Create an engagement to view jobs.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-white">Jobs & Process Sessions</h1>
        <div className="flex gap-2 items-center">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search command or target" className="w-64" />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "", label: "All Statuses" },
              { value: "running", label: "Running" },
              { value: "completed", label: "Completed" },
              { value: "failed", label: "Failed" },
              { value: "stopped", label: "Stopped" },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat label="Running" value={counts.running} />
        <Stat label="Completed" value={counts.completed} />
        <Stat label="Failed" value={counts.failed} />
        <Stat label="Stopped" value={counts.stopped} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-800">
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">PID</th>
              <th className="px-3 py-2">Runtime</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Command</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRuns.map((job) => (
              <tr key={job.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer" onClick={() => setSelectedId(job.id)}>
                <td className="px-3 py-2 text-gray-200">{job.status}</td>
                <td className="px-3 py-2 text-gray-400">{job.pid || "—"}</td>
                <td className="px-3 py-2 text-gray-400">{job.runtime_seconds ? `${job.runtime_seconds.toFixed(1)}s` : "—"}</td>
                <td className="px-3 py-2 text-gray-400">{job.target_id || "—"}</td>
                <td className="px-3 py-2 text-gray-400 truncate max-w-xl">{job.command_executed || job.command_preview || ""}</td>
                <td className="px-3 py-2">
                  {job.status === "running" ? (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        stopMut.mutate(job.id);
                      }}
                      disabled={stopMut.isPending}
                    >
                      Stop
                    </Button>
                  ) : (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRuns.length === 0 && <div className="text-gray-500 text-sm p-4">No jobs recorded yet.</div>}
      </div>

      {selected && (
        <Modal title={`Job Detail · ${selected.status}`} onClose={() => setSelectedId("")} width="max-w-5xl">
          <div className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3 text-xs text-gray-400">
              <div>ID: <span className="text-gray-200 break-all">{selected.id}</span></div>
              <div>Status: <span className="text-gray-200">{selected.status}</span></div>
              <div>Exit Code: <span className="text-gray-200">{selected.exit_code ?? "—"}</span></div>
              <div>PID: <span className="text-gray-200">{selected.pid ?? "—"}</span></div>
              <div>Profile: <span className="text-gray-200">{selected.execution_profile || "—"}</span></div>
              <div>Runtime: <span className="text-gray-200">{selected.runtime_seconds ? `${selected.runtime_seconds.toFixed(1)}s` : "—"}</span></div>
              <div className="md:col-span-3">Command: <span className="text-gray-200">{selected.command_executed || selected.command_preview || ""}</span></div>
              <div className="md:col-span-3">Working Directory: <span className="text-gray-200">{selected.working_directory || "—"}</span></div>
              <div className="md:col-span-3">Output Location: <span className="text-gray-200">{selected.output_location || "—"}</span></div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-400 mb-1">Stdout</div>
                <pre className="h-64 overflow-auto text-xs bg-gray-950 border border-gray-800 rounded p-2 text-gray-200 whitespace-pre-wrap">{selected.stdout || "(no stdout)"}</pre>
              </div>
              <div>
                <div className="text-xs text-gray-400 mb-1">Stderr</div>
                <pre className="h-64 overflow-auto text-xs bg-gray-950 border border-gray-800 rounded p-2 text-red-200 whitespace-pre-wrap">{selected.stderr || "(no stderr)"}</pre>
              </div>
            </div>
            {selected.status === "running" && (
              <div className="flex justify-end">
                <Button variant="danger" size="sm" onClick={() => stopMut.mutate(selected.id)} disabled={stopMut.isPending}>Stop Job</Button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded p-2">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  );
}
