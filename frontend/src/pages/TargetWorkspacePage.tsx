import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { operatorApi, commandsApi, targetApi } from "../api/client";
import Button from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Input";

const STATUS_OPTIONS = [
  { value: "not_tested", label: "Not Tested" },
  { value: "testing", label: "Testing" },
  { value: "passed", label: "Passed" },
  { value: "finding", label: "Finding" },
  { value: "na", label: "N/A" },
];

export default function TargetWorkspacePage() {
  const { id: targetId = "" } = useParams();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"inventory" | "methodology" | "commands" | "http">("inventory");
  const [commandText, setCommandText] = useState("");
  const [executionProfile, setExecutionProfile] = useState("linux");
  const [overrideReason, setOverrideReason] = useState("");

  const providedEngagementId = params.get("engagementId") || "";
  const { data: target } = useQuery({ queryKey: ["target", targetId], queryFn: () => targetApi.get(targetId), enabled: !!targetId });
  const engagementId = providedEngagementId || (target as { engagement_id?: string } | undefined)?.engagement_id || "";

  const { data: workspace, refetch: refetchWorkspace } = useQuery({
    queryKey: ["workspace", engagementId, targetId],
    queryFn: () => operatorApi.workspace(engagementId, targetId),
    enabled: !!engagementId && !!targetId,
    refetchInterval: 4000,
  });

  const { data: methodologyProfiles = [] } = useQuery({
    queryKey: ["methodology-profiles"],
    queryFn: () => operatorApi.methodologyProfiles(),
  });

  const { data: commands = [] } = useQuery({ queryKey: ["commands"], queryFn: () => commandsApi.list() });

  const previewMut = useMutation({ mutationFn: (payload: unknown) => operatorApi.commandPreview(payload) });
  const executeMut = useMutation({
    mutationFn: (payload: unknown) => operatorApi.executeCommand(payload),
    onSuccess: () => {
      setOverrideReason("");
      qc.invalidateQueries({ queryKey: ["workspace", engagementId, targetId] });
    },
  });

  const updateMethodologyMut = useMutation({
    mutationFn: (payload: unknown) => operatorApi.upsertMethodologyResult(payload),
    onSuccess: () => refetchWorkspace(),
  });

  const methodMap = useMemo(() => {
    const map = new Map<string, string>();
    ((workspace as { coverage?: { results?: Array<{ item_id: string; status: string }> } })?.coverage?.results || []).forEach((r) => {
      map.set(r.item_id, r.status);
    });
    return map;
  }, [workspace]);

  if (!targetId || !engagementId) return <div className="text-gray-400">Missing target or engagement.</div>;
  if (!workspace) return <div className="text-gray-400">Loading workspace…</div>;

  const rows = workspace.inventory?.endpoints || [];
  const cmdRuns = workspace.command_runs || [];

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h1 className="text-lg font-bold text-white">Target Workspace</h1>
        <p className="text-sm text-gray-400 mt-1">
          {workspace.target?.hostname || workspace.target?.ip_address || workspace.target?.url || targetId}
        </p>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="bg-gray-800 rounded p-2"><span className="text-gray-400">Hosts</span><div className="text-white text-base font-semibold">{workspace.inventory?.hosts?.length || 0}</div></div>
          <div className="bg-gray-800 rounded p-2"><span className="text-gray-400">Services</span><div className="text-white text-base font-semibold">{workspace.inventory?.services?.length || 0}</div></div>
          <div className="bg-gray-800 rounded p-2"><span className="text-gray-400">Endpoints</span><div className="text-white text-base font-semibold">{workspace.inventory?.endpoints?.length || 0}</div></div>
          <div className="bg-gray-800 rounded p-2"><span className="text-gray-400">Coverage</span><div className="text-white text-base font-semibold">{workspace.coverage?.coverage_percent || 0}%</div></div>
          <div className="bg-gray-800 rounded p-2"><span className="text-gray-400">Findings</span><div className="text-white text-base font-semibold">{workspace.findings?.length || 0}</div></div>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { k: "inventory", label: "Inventory" },
          { k: "methodology", label: "Methodology" },
          { k: "commands", label: "Commands & Jobs" },
          { k: "http", label: "HTTP Evidence" },
        ].map((tab) => (
          <Button key={tab.k} size="sm" variant={activeTab === tab.k ? "primary" : "ghost"} onClick={() => setActiveTab(tab.k as typeof activeTab)}>
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "inventory" && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-400 border-b border-gray-800"><th className="px-3 py-2">Method</th><th className="px-3 py-2">Path</th><th className="px-3 py-2">Auth</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Testing</th></tr></thead>
            <tbody>
              {rows.map((e: { id: string; method: string; path: string; auth_requirement?: string; status_code?: number; source_tool?: string; testing_status?: string }) => (
                <tr key={e.id} className="border-b border-gray-800/50">
                  <td className="px-3 py-2 text-brand-300">{e.method}</td>
                  <td className="px-3 py-2 text-gray-200">{e.path}</td>
                  <td className="px-3 py-2 text-gray-400">{e.auth_requirement || "unknown"}</td>
                  <td className="px-3 py-2 text-gray-400">{e.status_code || "—"}</td>
                  <td className="px-3 py-2 text-gray-500">{e.source_tool || "—"}</td>
                  <td className="px-3 py-2 text-gray-300">{e.testing_status || "not_tested"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "methodology" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(methodologyProfiles as Array<{ id: string; name: string; items: Array<{ id: string; title: string }> }>).map((profile) => (
            <div key={profile.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-white mb-2">{profile.name}</h3>
              <div className="space-y-2">
                {profile.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                    <div className="text-xs text-gray-300 md:col-span-2">{item.title}</div>
                    <Select
                      value={methodMap.get(item.id) || "not_tested"}
                      options={STATUS_OPTIONS}
                      onChange={(ev) =>
                        updateMethodologyMut.mutate({
                          engagement_id: engagementId,
                          target_id: targetId,
                          profile_id: profile.id,
                          item_id: item.id,
                          status: ev.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "commands" && (
        <div className="space-y-3">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-3">
            <h3 className="text-sm font-semibold text-white">Run Command (explicit confirmation required)</h3>
            <Select
              label="Template"
              value=""
              options={[{ value: "", label: "Select template…" }, ...(commands as Array<{ id: string; name: string; command_text: string }>).map((c) => ({ value: c.id, label: c.name }))]}
              onChange={(e) => {
                const selected = (commands as Array<{ id: string; command_text: string }>).find((c) => c.id === e.target.value);
                if (selected) setCommandText(selected.command_text);
              }}
            />
            <Textarea label="Command preview / edit" value={commandText} onChange={(e) => setCommandText(e.target.value)} rows={4} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Select label="Execution profile" value={executionProfile} options={["linux", "wsl", "windows"].map((v) => ({ value: v, label: v.toUpperCase() }))} onChange={(e) => setExecutionProfile(e.target.value)} />
              <Input label="Scope override reason (if needed)" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
              <div className="flex items-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    previewMut.mutate({
                      engagement_id: engagementId,
                      target_id: targetId,
                      command_text: commandText,
                      execution_profile: executionProfile,
                    })
                  }
                  disabled={!commandText}
                >
                  Preview
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() =>
                    executeMut.mutate({
                      engagement_id: engagementId,
                      target_id: targetId,
                      command_text: commandText,
                      execution_profile: executionProfile,
                      explicit_confirmation: true,
                      scope_override: Boolean(overrideReason),
                      scope_override_reason: overrideReason || null,
                    })
                  }
                  disabled={!commandText || executeMut.isPending}
                >
                  Confirm & Execute
                </Button>
              </div>
            </div>
            {previewMut.data && (
              <div className="text-xs rounded border border-gray-700 bg-gray-800 p-2 text-gray-300">
                {previewMut.data.scope_warning ? `Scope warning: ${previewMut.data.scope_warning}` : "Scope check passed."}
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-800 text-gray-400"><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Command</th><th className="px-3 py-2 text-left">Runtime</th><th className="px-3 py-2 text-left">Actions</th></tr></thead>
              <tbody>
                {cmdRuns.map((run: { id: string; status: string; command_preview: string; runtime_seconds?: number }) => (
                  <tr key={run.id} className="border-b border-gray-800/50">
                    <td className="px-3 py-2 text-gray-200">{run.status}</td>
                    <td className="px-3 py-2 text-gray-400 truncate max-w-xl">{run.command_preview}</td>
                    <td className="px-3 py-2 text-gray-400">{run.runtime_seconds ? `${run.runtime_seconds.toFixed(1)}s` : "—"}</td>
                    <td className="px-3 py-2">
                      {run.status === "running" ? (
                        <Button size="sm" variant="ghost" onClick={() => operatorApi.stopCommand(run.id).then(() => refetchWorkspace())}>Stop</Button>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "http" && (
        <div className="space-y-3">
          {(workspace.http_messages as Array<{ id: string; method?: string; path?: string; status_code?: number }>).map((msg) => (
            <div key={msg.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">{msg.method} {msg.path} {msg.status_code ? `(${msg.status_code})` : ""}</div>
            </div>
          ))}
          {(workspace.http_messages as Array<unknown>).length === 0 && <div className="text-gray-500 text-sm">No HTTP messages yet.</div>}
        </div>
      )}
    </div>
  );
}
