import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { commandsApi, operatorApi, targetApi } from "../api/client";
import Button from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Input";
import { buildSiteMap, endpointCoverageBreakdown, type EndpointRecord, type SiteMapNode } from "../utils/commandCenter";

const STATUS_OPTIONS = [
  { value: "not_tested", label: "Not Tested" },
  { value: "testing", label: "Testing" },
  { value: "passed", label: "Passed" },
  { value: "finding", label: "Finding" },
  { value: "na", label: "N/A" },
];

const HTTP_VIEWS = ["request", "response", "pretty", "raw", "diff", "notes"] as const;
type HttpView = (typeof HTTP_VIEWS)[number];

type WorkspaceTab =
  | "overview"
  | "hosts"
  | "sitemap"
  | "endpoints"
  | "parameters"
  | "requests"
  | "methodology"
  | "credentials"
  | "findings"
  | "evidence"
  | "commands"
  | "jobs"
  | "notes"
  | "tasks"
  | "timeline";

type HostRecord = { id: string; hostname?: string; ip_address?: string; source_tool?: string };
type ServiceRecord = { id: string; port?: number; protocol?: string; service_name?: string; technology?: string };
type ParameterRecord = { id: string; endpoint_id: string; location: string; name: string; sample_value?: string };
type FindingRecord = { id: string; title: string; severity: string; status: string };
type EvidenceRecord = { id: string; evidence_type: string; title: string; source_tool?: string };
type NoteRecord = { id: string; title: string; note_type?: string };
type TaskRecord = { id: string; title: string; status: string; priority?: string };
type CredentialRecord = { id: string; domain?: string; username?: string; secret_type: string; is_validated: boolean };
type CommandRunRecord = { id: string; status: string; pid?: number; command_preview: string; runtime_seconds?: number };
type HttpMessageRecord = {
  id: string;
  method?: string;
  path?: string;
  status_code?: number;
  request_raw?: string;
  response_raw?: string;
  request_pretty?: string;
  response_pretty?: string;
};
type CredentialUsageRecord = { id: string; validation_state: string; target_id?: string; endpoint_id?: string };

type WorkspacePayload = {
  target?: { hostname?: string; ip_address?: string; url?: string };
  inventory?: {
    hosts?: HostRecord[];
    services?: ServiceRecord[];
    endpoints?: EndpointRecord[];
    parameters?: ParameterRecord[];
  };
  coverage?: { coverage_percent?: number; results?: Array<{ item_id: string; status: string }> };
  credentials?: CredentialRecord[];
  findings?: FindingRecord[];
  evidence?: EvidenceRecord[];
  notes?: NoteRecord[];
  tasks?: TaskRecord[];
  command_runs?: CommandRunRecord[];
};

function formatJsonCandidate(content: string | undefined): string {
  if (!content) return "";
  const trimmed = content.trim();
  if (!trimmed) return "";
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return content;
  }
}

function SiteMapTree({ nodes }: { nodes: SiteMapNode[] }) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <div key={node.fullPath} className="text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-200">/{node.name}</span>
            {node.methods.length > 0 && <span className="text-brand-300">{node.methods.join(", ")}</span>}
            {!node.tested && <span className="text-amber-300">untested</span>}
            {node.hasFinding && <span className="text-red-300">finding</span>}
          </div>
          {node.children.length > 0 && (
            <div className="pl-3 border-l border-gray-800 mt-1">
              <SiteMapTree nodes={node.children} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function TargetWorkspacePage() {
  const { id: targetId = "" } = useParams();
  const [params] = useSearchParams();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [commandText, setCommandText] = useState("");
  const [executionProfile, setExecutionProfile] = useState("linux");
  const [overrideReason, setOverrideReason] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [httpView, setHttpView] = useState<HttpView>("request");
  const [selectedCredentialId, setSelectedCredentialId] = useState("");

  const providedEngagementId = params.get("engagementId") || "";
  const { data: target } = useQuery({
    queryKey: ["target", targetId],
    queryFn: () => targetApi.get(targetId),
    enabled: !!targetId,
  });
  const engagementId = providedEngagementId || (target as { engagement_id?: string } | undefined)?.engagement_id || "";

  const { data: workspaceRaw, refetch: refetchWorkspace } = useQuery({
    queryKey: ["workspace", engagementId, targetId],
    queryFn: () => operatorApi.workspace(engagementId, targetId),
    enabled: !!engagementId && !!targetId,
    refetchInterval: 4000,
  });
  const workspace = (workspaceRaw || {}) as WorkspacePayload;

  const { data: methodologyProfiles = [] } = useQuery({
    queryKey: ["methodology-profiles"],
    queryFn: () => operatorApi.methodologyProfiles(),
  });

  const { data: commands = [] } = useQuery({ queryKey: ["commands"], queryFn: () => commandsApi.list() });

  const { data: httpMessagesRaw = [] } = useQuery({
    queryKey: ["http-messages", engagementId, targetId],
    queryFn: () => operatorApi.httpMessages({ engagement_id: engagementId, target_id: targetId }),
    enabled: !!engagementId && !!targetId,
    refetchInterval: 6000,
  });
  const httpMessages = httpMessagesRaw as HttpMessageRecord[];

  const { data: credentialUsagesRaw = [] } = useQuery({
    queryKey: ["credential-usages", selectedCredentialId],
    queryFn: () => operatorApi.credentialUsages(selectedCredentialId),
    enabled: !!selectedCredentialId,
  });
  const credentialUsages = credentialUsagesRaw as CredentialUsageRecord[];

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
    (workspace.coverage?.results || []).forEach((r) => map.set(r.item_id, r.status));
    return map;
  }, [workspace.coverage?.results]);

  if (!targetId || !engagementId) return <div className="text-gray-400">Missing target or engagement.</div>;
  if (!workspaceRaw) return <div className="text-gray-400">Loading workspace…</div>;

  const endpointRows = workspace.inventory?.endpoints || [];
  const cmdRuns = workspace.command_runs || [];
  const hostRows = workspace.inventory?.hosts || [];
  const serviceRows = workspace.inventory?.services || [];
  const parameterRows = workspace.inventory?.parameters || [];
  const findingRows = workspace.findings || [];
  const evidenceRows = workspace.evidence || [];
  const notesRows = workspace.notes || [];
  const tasksRows = workspace.tasks || [];
  const credentialsRows = workspace.credentials || [];

  const siteMap = buildSiteMap(endpointRows);
  const coverage = endpointCoverageBreakdown(endpointRows);

  const tabDefs = [
    { key: "overview", label: "Overview", visible: true },
    { key: "hosts", label: "Hosts / Services", visible: true },
    { key: "sitemap", label: "Site Map", visible: endpointRows.length > 0 },
    { key: "endpoints", label: "Endpoints", visible: endpointRows.length > 0 },
    { key: "parameters", label: "Parameters", visible: parameterRows.length > 0 },
    { key: "requests", label: "Requests", visible: httpMessages.length > 0 },
    { key: "methodology", label: "Methodology", visible: true },
    { key: "credentials", label: "Credentials", visible: true },
    { key: "findings", label: "Findings", visible: true },
    { key: "evidence", label: "Evidence", visible: true },
    { key: "commands", label: "Commands", visible: true },
    { key: "jobs", label: "Jobs", visible: true },
    { key: "notes", label: "Notes", visible: true },
    { key: "tasks", label: "Tasks", visible: true },
    { key: "timeline", label: "Timeline", visible: true },
  ] as const;

  const dynamicTabs: Array<{ key: WorkspaceTab; label: string }> = tabDefs
    .filter((tab) => tab.visible)
    .map((tab) => ({ key: tab.key as WorkspaceTab, label: tab.label }));

  const selectedMessage = httpMessages.find((m) => m.id === selectedRequestId) || httpMessages[0];

  const copy = async (text: string | undefined) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h1 className="text-lg font-bold text-white">Target Workspace</h1>
        <p className="text-sm text-gray-400 mt-1">{workspace.target?.hostname || workspace.target?.ip_address || workspace.target?.url || targetId}</p>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
          <div className="bg-gray-800 rounded p-2"><span className="text-gray-400">Hosts</span><div className="text-white text-base font-semibold">{hostRows.length}</div></div>
          <div className="bg-gray-800 rounded p-2"><span className="text-gray-400">Services</span><div className="text-white text-base font-semibold">{serviceRows.length}</div></div>
          <div className="bg-gray-800 rounded p-2"><span className="text-gray-400">Endpoints</span><div className="text-white text-base font-semibold">{endpointRows.length}</div></div>
          <div className="bg-gray-800 rounded p-2"><span className="text-gray-400">Coverage</span><div className="text-white text-base font-semibold">{workspace.coverage?.coverage_percent || 0}%</div></div>
          <div className="bg-gray-800 rounded p-2"><span className="text-gray-400">Credentials</span><div className="text-white text-base font-semibold">{credentialsRows.length}</div></div>
          <div className="bg-gray-800 rounded p-2"><span className="text-gray-400">Findings</span><div className="text-white text-base font-semibold">{findingRows.length}</div></div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {dynamicTabs.map((tab) => (
          <Button key={tab.key} size="sm" variant={activeTab === tab.key ? "primary" : "ghost"} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Coverage Queue</h3>
            <div className="space-y-1 text-xs text-gray-300">
              <div className="bg-gray-800 rounded px-2 py-1.5">Untested endpoints: {coverage.untested}</div>
              <div className="bg-gray-800 rounded px-2 py-1.5">In progress: {coverage.testing}</div>
              <div className="bg-gray-800 rounded px-2 py-1.5">Passed: {coverage.passed}</div>
              <div className="bg-gray-800 rounded px-2 py-1.5">Findings: {coverage.finding}</div>
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Current Work Surface</h3>
            <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
              {endpointRows.slice(0, 10).map((e) => (
                <div key={e.id} className="bg-gray-800 rounded px-2 py-1.5 text-gray-300 flex justify-between gap-2">
                  <span className="truncate"><span className="text-brand-300">{e.method || "GET"}</span> {e.path}</span>
                  <span className={e.testing_status === "finding" ? "text-red-300" : "text-gray-500"}>{e.testing_status || "not_tested"}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Recent Operational Objects</h3>
            <div className="space-y-1 text-xs">
              {findingRows.slice(0, 5).map((f) => (
                <div key={f.id} className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">[{f.severity}] {f.title}</div>
              ))}
              {findingRows.length === 0 && <div className="text-gray-500">No findings linked to this target.</div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === "hosts" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Hosts</h3>
            <div className="space-y-1 text-xs max-h-72 overflow-y-auto">
              {hostRows.map((h) => (
                <div key={h.id} className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">{h.hostname || h.ip_address || "host"} · {h.source_tool || "unknown"}</div>
              ))}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Services</h3>
            <div className="space-y-1 text-xs max-h-72 overflow-y-auto">
              {serviceRows.map((s) => (
                <div key={s.id} className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">{s.port}/{s.protocol} {s.service_name || "service"} {s.technology ? `· ${s.technology}` : ""}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "sitemap" && <div className="bg-gray-900 border border-gray-800 rounded-lg p-3"><h3 className="text-sm font-semibold text-gray-300 mb-2">Site Map</h3><SiteMapTree nodes={siteMap} /></div>}

      {activeTab === "endpoints" && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="text-left text-gray-400 border-b border-gray-800"><th className="px-3 py-2">Method</th><th className="px-3 py-2">Path</th><th className="px-3 py-2">Auth</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Testing</th><th className="px-3 py-2">Source</th></tr></thead><tbody>{endpointRows.map((e) => <tr key={e.id} className="border-b border-gray-800/50"><td className="px-3 py-2 text-brand-300">{e.method}</td><td className="px-3 py-2 text-gray-200">{e.path}</td><td className="px-3 py-2 text-gray-400">{e.auth_requirement || "unknown"}</td><td className="px-3 py-2 text-gray-400">{e.status_code || "—"}</td><td className="px-3 py-2 text-gray-300">{e.testing_status || "not_tested"}</td><td className="px-3 py-2 text-gray-500">{"source_tool" in e ? String((e as Record<string, unknown>).source_tool || "—") : "—"}</td></tr>)}</tbody></table>
        </div>
      )}

      {activeTab === "parameters" && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="text-left text-gray-400 border-b border-gray-800"><th className="px-3 py-2">Endpoint</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Sample</th></tr></thead><tbody>{parameterRows.map((p) => <tr key={p.id} className="border-b border-gray-800/50"><td className="px-3 py-2 text-gray-300">{p.endpoint_id}</td><td className="px-3 py-2 text-gray-400">{p.location}</td><td className="px-3 py-2 text-brand-300">{p.name}</td><td className="px-3 py-2 text-gray-500 truncate max-w-64">{p.sample_value || "—"}</td></tr>)}</tbody></table>
        </div>
      )}

      {activeTab === "requests" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:col-span-4 max-h-[32rem] overflow-y-auto"><h3 className="text-sm font-semibold text-gray-300 mb-2">Captured Requests</h3><div className="space-y-1 text-xs">{httpMessages.map((msg) => <button key={msg.id} onClick={() => setSelectedRequestId(msg.id)} className={`w-full text-left rounded px-2 py-1.5 border ${selectedMessage?.id === msg.id ? "bg-brand-500/20 border-brand-500/40 text-brand-300" : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"}`}>{msg.method} {msg.path} {msg.status_code ? `(${msg.status_code})` : ""}</button>)}</div></div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:col-span-8">
            <div className="flex flex-wrap gap-2 mb-3">{HTTP_VIEWS.map((view) => <Button key={view} size="sm" variant={httpView === view ? "primary" : "ghost"} onClick={() => setHttpView(view)}>{view.toUpperCase()}</Button>)}<Button size="sm" variant="secondary" onClick={() => copy(selectedMessage?.request_raw)}>Copy Request</Button><Button size="sm" variant="secondary" onClick={() => copy(selectedMessage?.response_raw)}>Copy Response</Button><Button size="sm" variant="secondary" onClick={() => copy(`${selectedMessage?.method || "GET"} ${selectedMessage?.path || "/"}`)}>Copy as cURL Seed</Button></div>
            {selectedMessage ? (
              <div className="text-xs">
                {httpView === "request" && <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{selectedMessage.request_raw || "No request body"}</pre>}
                {httpView === "response" && <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{selectedMessage.response_raw || "No response body"}</pre>}
                {httpView === "pretty" && <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{formatJsonCandidate(selectedMessage.request_pretty || selectedMessage.request_raw)}\n\n----\n\n{formatJsonCandidate(selectedMessage.response_pretty || selectedMessage.response_raw)}</pre>}
                {httpView === "raw" && <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">REQUEST\n{selectedMessage.request_raw || ""}\n\nRESPONSE\n{selectedMessage.response_raw || ""}</pre>}
                {httpView === "diff" && <div className="grid grid-cols-1 md:grid-cols-2 gap-2"><pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{selectedMessage.request_raw || ""}</pre><pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{selectedMessage.response_raw || ""}</pre></div>}
                {httpView === "notes" && <div className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-300">Use this message as evidence, attach to finding, or mark endpoint tested in Methodology.</div>}
              </div>
            ) : <div className="text-gray-500 text-sm">No HTTP messages for this target.</div>}
          </div>
        </div>
      )}

      {activeTab === "methodology" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(methodologyProfiles as Array<{ id: string; name: string; items: Array<{ id: string; title: string }> }>).map((profile) => (
            <div key={profile.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3"><h3 className="text-sm font-semibold text-white mb-2">{profile.name}</h3><div className="space-y-2">{profile.items.map((item) => <div key={item.id} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center"><div className="text-xs text-gray-300 md:col-span-2">{item.title}</div><Select value={methodMap.get(item.id) || "not_tested"} options={STATUS_OPTIONS} onChange={(ev) => updateMethodologyMut.mutate({ engagement_id: engagementId, target_id: targetId, profile_id: profile.id, item_id: item.id, status: ev.target.value })} /></div>)}</div></div>
          ))}
        </div>
      )}

      {activeTab === "credentials" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:col-span-5"><h3 className="text-sm font-semibold text-gray-300 mb-2">Credential Objects</h3><div className="space-y-1 text-xs max-h-80 overflow-y-auto">{credentialsRows.map((cred) => <button key={cred.id} onClick={() => setSelectedCredentialId(cred.id)} className={`w-full text-left rounded px-2 py-1.5 border ${selectedCredentialId === cred.id ? "bg-brand-500/20 border-brand-500/40 text-brand-300" : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"}`}>{cred.domain ? `${cred.domain}\\` : ""}{cred.username || "(unknown)"} · {cred.secret_type} · {cred.is_validated ? "VALID" : "UNVERIFIED"}</button>)}{credentialsRows.length === 0 && <div className="text-gray-500">No credentials associated with this target.</div>}</div></div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:col-span-7"><h3 className="text-sm font-semibold text-gray-300 mb-2">Where-Used / Validation State</h3><div className="space-y-1 text-xs max-h-80 overflow-y-auto">{credentialUsages.map((usage) => <div key={usage.id} className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">{usage.validation_state.toUpperCase()} · target={usage.target_id || "—"} endpoint={usage.endpoint_id || "—"}</div>)}{credentialUsages.length === 0 && <div className="text-gray-500">Select a credential to view operational usage.</div>}</div></div>
        </div>
      )}

      {activeTab === "findings" && <div className="bg-gray-900 border border-gray-800 rounded-lg p-3"><h3 className="text-sm font-semibold text-gray-300 mb-2">Findings</h3><div className="space-y-1 text-xs max-h-80 overflow-y-auto">{findingRows.map((f) => <div key={f.id} className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">[{f.severity}] {f.title} · {f.status}</div>)}{findingRows.length === 0 && <div className="text-gray-500">No findings associated with this target.</div>}</div></div>}

      {activeTab === "evidence" && <div className="bg-gray-900 border border-gray-800 rounded-lg p-3"><h3 className="text-sm font-semibold text-gray-300 mb-2">Evidence & Screenshots</h3><div className="space-y-1 text-xs max-h-80 overflow-y-auto">{evidenceRows.map((e) => <div key={e.id} className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">{e.evidence_type} · {e.title} · {e.source_tool || "manual"}</div>)}{evidenceRows.length === 0 && <div className="text-gray-500">No evidence associated with this target.</div>}</div></div>}

      {activeTab === "commands" && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-3">
          <h3 className="text-sm font-semibold text-white">Command Workbench (explicit confirmation required)</h3>
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
            <div className="flex items-end gap-2"><Button size="sm" variant="ghost" onClick={() => previewMut.mutate({ engagement_id: engagementId, target_id: targetId, command_text: commandText, execution_profile: executionProfile })} disabled={!commandText}>Preview</Button><Button size="sm" variant="primary" onClick={() => executeMut.mutate({ engagement_id: engagementId, target_id: targetId, command_text: commandText, execution_profile: executionProfile, explicit_confirmation: true, scope_override: Boolean(overrideReason), scope_override_reason: overrideReason || null })} disabled={!commandText || executeMut.isPending}>Confirm & Execute</Button></div>
          </div>
          {previewMut.data && <div className="text-xs rounded border border-gray-700 bg-gray-800 p-2 text-gray-300">{previewMut.data.scope_warning ? `Scope warning: ${previewMut.data.scope_warning}` : "Scope check passed."}</div>}
        </div>
      )}

      {activeTab === "jobs" && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="border-b border-gray-800 text-gray-400"><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">PID</th><th className="px-3 py-2 text-left">Command</th><th className="px-3 py-2 text-left">Runtime</th><th className="px-3 py-2 text-left">Actions</th></tr></thead><tbody>{cmdRuns.map((run) => <tr key={run.id} className="border-b border-gray-800/50"><td className="px-3 py-2 text-gray-200">{run.status}</td><td className="px-3 py-2 text-gray-400">{run.pid || "—"}</td><td className="px-3 py-2 text-gray-400 truncate max-w-xl">{run.command_preview}</td><td className="px-3 py-2 text-gray-400">{run.runtime_seconds ? `${run.runtime_seconds.toFixed(1)}s` : "—"}</td><td className="px-3 py-2">{run.status === "running" ? <Button size="sm" variant="ghost" onClick={() => operatorApi.stopCommand(run.id).then(() => refetchWorkspace())}>Stop</Button> : <span className="text-gray-600 text-xs">—</span>}</td></tr>)}</tbody></table>
        </div>
      )}

      {activeTab === "notes" && <div className="bg-gray-900 border border-gray-800 rounded-lg p-3"><h3 className="text-sm font-semibold text-gray-300 mb-2">Notes</h3><div className="space-y-1 text-xs max-h-80 overflow-y-auto">{notesRows.map((n) => <div key={n.id} className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">{n.title} · {n.note_type}</div>)}{notesRows.length === 0 && <div className="text-gray-500">No notes linked to this target.</div>}</div></div>}

      {activeTab === "tasks" && <div className="bg-gray-900 border border-gray-800 rounded-lg p-3"><h3 className="text-sm font-semibold text-gray-300 mb-2">Tasks</h3><div className="space-y-1 text-xs max-h-80 overflow-y-auto">{tasksRows.map((t) => <div key={t.id} className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">{t.title} · {t.status} · {t.priority}</div>)}{tasksRows.length === 0 && <div className="text-gray-500">No tasks linked to this target.</div>}</div></div>}

      {activeTab === "timeline" && <div className="bg-gray-900 border border-gray-800 rounded-lg p-3"><h3 className="text-sm font-semibold text-gray-300 mb-2">Timeline</h3><div className="space-y-1 text-xs text-gray-300">{[...cmdRuns.slice(0, 6), ...findingRows.slice(0, 6)].map((row, idx) => <div key={`${row.id}-${idx}`} className="bg-gray-800 rounded px-2 py-1.5">{"command_preview" in row ? `JOB: ${row.status} · ${row.command_preview}` : `FINDING: [${row.severity}] ${row.title}`}</div>)}</div></div>}
    </div>
  );
}
