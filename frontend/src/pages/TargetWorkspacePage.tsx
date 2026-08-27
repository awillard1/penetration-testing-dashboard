import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { operatorApi, targetApi } from "../api/client";
import Button from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Input";
import { buildSiteMap, endpointCoverageBreakdown, type EndpointRecord, type SiteMapNode } from "../utils/commandCenter";

const STATUS_OPTIONS = [
  { value: "not_tested", label: "Not Tested" },
  { value: "testing", label: "Testing" },
  { value: "passed", label: "Passed" },
  { value: "finding", label: "Finding" },
  { value: "blocked", label: "Blocked" },
  { value: "na", label: "N/A" },
];

const HTTP_VIEWS = ["request", "response", "pretty", "raw", "headers", "body", "parameters", "cookies", "notes", "diff", "history", "associations"] as const;
type HttpView = (typeof HTTP_VIEWS)[number];

type WorkspaceTab =
  | "overview"
  | "hosts"
  | "services"
  | "web"
  | "sitemap"
  | "apis"
  | "endpoints"
  | "parameters"
  | "http"
  | "methodology"
  | "credentials"
  | "findings"
  | "evidence"
  | "screenshots"
  | "recon"
  | "scans"
  | "commands"
  | "jobs"
  | "loot"
  | "notes"
  | "tasks"
  | "footholds"
  | "attackpaths"
  | "timeline";

type HostRecord = { id: string; hostname?: string; ip_address?: string; source_tool?: string; operating_system?: string };
type ServiceRecord = { id: string; host_id: string; port?: number; protocol?: string; service_name?: string; technology?: string };
type UrlRecord = { id: string; host_id: string; service_id?: string; url: string };
type ParameterRecord = { id: string; endpoint_id: string; location: string; name: string; sample_value?: string };
type FindingRecord = { id: string; title: string; severity: string; status: string };
type EvidenceRecord = { id: string; evidence_type: string; title: string; source_tool?: string };
type NoteRecord = { id: string; title: string; note_type?: string };
type TaskRecord = { id: string; title: string; status: string; priority?: string };
type CredentialRecord = { id: string; domain?: string; username?: string; secret_type: string; is_validated: boolean };
type CommandRunRecord = { id: string; status: string; pid?: number; command_preview: string; runtime_seconds?: number; runner_name?: string };
type HttpMessageRecord = {
  id: string;
  endpoint_id?: string;
  method?: string;
  path?: string;
  status_code?: number;
  content_type?: string;
  request_raw?: string;
  response_raw?: string;
  request_pretty?: string;
  response_pretty?: string;
  source_tool?: string;
};
type CredentialUsageRecord = { id: string; validation_state: string; target_id?: string; endpoint_id?: string; credential_id?: string };

type WorkspacePayload = {
  target?: { hostname?: string; ip_address?: string; url?: string; in_scope?: boolean; id: string };
  inventory?: {
    hosts?: HostRecord[];
    services?: ServiceRecord[];
    urls?: UrlRecord[];
    endpoints?: EndpointRecord[];
    parameters?: ParameterRecord[];
  };
  coverage?: { coverage_percent?: number; results?: Array<{ item_id: string; status: string }>; status_counts?: Record<string, number> };
  credentials?: CredentialRecord[];
  findings?: FindingRecord[];
  evidence?: EvidenceRecord[];
  notes?: NoteRecord[];
  tasks?: TaskRecord[];
  command_runs?: CommandRunRecord[];
  http_messages?: HttpMessageRecord[];
  scan_history?: Array<{ id: string; filename: string; scan_type: string; status: string; imported_at?: string }>;
};

function parsePossibleJson(value?: string) {
  if (!value) return [] as Array<{ key: string; value: string }>;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((v, idx) => ({ key: String(idx), value: String(v) }));
    if (typeof parsed === "object" && parsed) return Object.entries(parsed).map(([k, v]) => ({ key: k, value: String(v) }));
  } catch {
    // ignore
  }
  return value.split("&").filter(Boolean).map((pair) => {
    const [k, v] = pair.split("=");
    return { key: decodeURIComponent(k || ""), value: decodeURIComponent(v || "") };
  });
}

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

function SiteMapTree({ nodes, onSelect, selectedPath }: { nodes: SiteMapNode[]; onSelect: (path: string) => void; selectedPath: string }) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <div key={node.fullPath} className="text-xs">
          <button
            className={`flex items-center gap-2 rounded px-1.5 py-1 ${selectedPath === node.fullPath ? "bg-brand-500/20 text-brand-300" : "text-gray-200 hover:bg-gray-800"}`}
            onClick={() => onSelect(node.fullPath)}
          >
            <span>/{node.name}</span>
            {node.methods.length > 0 && <span className="text-brand-300">{node.methods.join(", ")}</span>}
            {!node.tested && <span className="text-amber-300">untested</span>}
            {node.hasFinding && <span className="text-red-300">finding</span>}
          </button>
          {node.children.length > 0 && (
            <div className="pl-3 border-l border-gray-800 mt-1">
              <SiteMapTree nodes={node.children} onSelect={onSelect} selectedPath={selectedPath} />
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
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("overview");
  const [selectedEndpointId, setSelectedEndpointId] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [httpView, setHttpView] = useState<HttpView>("request");
  const [selectedCredentialId, setSelectedCredentialId] = useState("");
  const [siteMapFilter, setSiteMapFilter] = useState({
    untested: false,
    interesting: false,
    auth: "",
    method: "",
    statusCode: "",
    source: "",
  });
  const [selectedSitePath, setSelectedSitePath] = useState("");
  const [endpointEdit, setEndpointEdit] = useState({ testing_status: "not_tested", auth_requirement: "", notes: "", interesting: false });

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
    refetchInterval: 6000,
  });
  const workspace = (workspaceRaw || {}) as WorkspacePayload;

  const { data: methodologyProfiles = [] } = useQuery({
    queryKey: ["methodology-profiles"],
    queryFn: () => operatorApi.methodologyProfiles(),
  });

  const endpointRows = useMemo(() => workspace.inventory?.endpoints || [], [workspace.inventory?.endpoints]);
  const hostRows = workspace.inventory?.hosts || [];
  const serviceRows = workspace.inventory?.services || [];
  const urlRows = workspace.inventory?.urls || [];
  const parameterRows = workspace.inventory?.parameters || [];
  const findingRows = workspace.findings || [];
  const evidenceRows = workspace.evidence || [];
  const notesRows = workspace.notes || [];
  const tasksRows = workspace.tasks || [];
  const credentialsRows = workspace.credentials || [];
  const cmdRuns = workspace.command_runs || [];
  const httpMessages = workspace.http_messages || [];
  const scans = workspace.scan_history || [];

  const selectedEndpoint = endpointRows.find((e) => e.id === selectedEndpointId) || endpointRows[0];

  const { data: endpointDetail } = useQuery({
    queryKey: ["endpoint-detail", selectedEndpoint?.id],
    queryFn: () => operatorApi.endpointDetail(selectedEndpoint!.id),
    enabled: !!selectedEndpoint?.id,
  });

  const { data: credentialUsagesRaw = [] } = useQuery({
    queryKey: ["credential-usages", selectedCredentialId],
    queryFn: () => operatorApi.credentialUsages(selectedCredentialId),
    enabled: !!selectedCredentialId,
  });
  const credentialUsages = credentialUsagesRaw as CredentialUsageRecord[];

  const updateMethodologyMut = useMutation({ mutationFn: (payload: unknown) => operatorApi.upsertMethodologyResult(payload), onSuccess: () => refetchWorkspace() });
  const updateEndpointMut = useMutation({
    mutationFn: (payload: typeof endpointEdit) => operatorApi.updateEndpoint(selectedEndpoint!.id, payload),
    onSuccess: () => refetchWorkspace(),
  });

  const methodMap = useMemo(() => {
    const map = new Map<string, string>();
    (workspace.coverage?.results || []).forEach((r) => map.set(r.item_id, r.status));
    return map;
  }, [workspace.coverage?.results]);

  const siteMapEndpoints = useMemo(() => {
    return endpointRows.filter((e) => {
      if (siteMapFilter.untested && e.testing_status !== "not_tested") return false;
      if (siteMapFilter.auth && (e.auth_requirement || "") !== siteMapFilter.auth) return false;
      if (siteMapFilter.method && (e.method || "") !== siteMapFilter.method) return false;
      if (siteMapFilter.statusCode && String(e.status_code || "") !== siteMapFilter.statusCode) return false;
      if (siteMapFilter.source && String((e as Record<string, unknown>).source_tool || "") !== siteMapFilter.source) return false;
      if (siteMapFilter.interesting) {
        const endpointProvenance = String((e as Record<string, unknown>).provenance_json || "");
        if (!endpointProvenance.includes("interesting")) return false;
      }
      return true;
    });
  }, [endpointRows, siteMapFilter]);

  const siteMap = buildSiteMap(siteMapEndpoints);
  const coverage = endpointCoverageBreakdown(endpointRows);

  const tabDefs: Array<{ key: WorkspaceTab; label: string; visible: boolean }> = [
    { key: "overview", label: "Overview", visible: true },
    { key: "hosts", label: "Hosts", visible: true },
    { key: "services", label: "Services", visible: true },
    { key: "web", label: "Web", visible: urlRows.length > 0 },
    { key: "sitemap", label: "Site Map", visible: endpointRows.length > 0 },
    { key: "apis", label: "APIs", visible: endpointRows.length > 0 },
    { key: "endpoints", label: "Endpoints", visible: endpointRows.length > 0 },
    { key: "parameters", label: "Parameters", visible: parameterRows.length > 0 },
    { key: "http", label: "HTTP", visible: httpMessages.length > 0 },
    { key: "methodology", label: "Methodology", visible: true },
    { key: "credentials", label: "Credentials", visible: true },
    { key: "findings", label: "Findings", visible: true },
    { key: "evidence", label: "Evidence", visible: true },
    { key: "screenshots", label: "Screenshots", visible: true },
    { key: "recon", label: "Recon", visible: true },
    { key: "scans", label: "Scans", visible: true },
    { key: "commands", label: "Commands", visible: true },
    { key: "jobs", label: "Jobs", visible: true },
    { key: "loot", label: "Loot / Artifacts", visible: true },
    { key: "notes", label: "Notes", visible: true },
    { key: "tasks", label: "Tasks", visible: true },
    { key: "footholds", label: "Footholds / Access", visible: true },
    { key: "attackpaths", label: "Attack Paths", visible: true },
    { key: "timeline", label: "Timeline", visible: true },
  ];

  const selectedMessage = httpMessages.find((m) => m.id === selectedRequestId) || httpMessages[0];

  if (!targetId || !engagementId) return <div className="text-gray-400">Missing target or engagement.</div>;
  if (!workspaceRaw) return <div className="text-gray-400">Loading workspace…</div>;

  return (
    <div className="space-y-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h1 className="text-lg font-bold text-white">Target Workspace</h1>
        <p className="text-sm text-gray-400 mt-1">{workspace.target?.hostname || workspace.target?.ip_address || workspace.target?.url || targetId}</p>
        <div className="mt-3 grid grid-cols-2 md:grid-cols-8 gap-2 text-xs">
          <Stat label="Hosts" value={hostRows.length} />
          <Stat label="Services" value={serviceRows.length} />
          <Stat label="URLs" value={urlRows.length} />
          <Stat label="Endpoints" value={endpointRows.length} />
          <Stat label="Parameters" value={parameterRows.length} />
          <Stat label="Coverage" value={`${workspace.coverage?.coverage_percent || 0}%`} />
          <Stat label="Credentials" value={credentialsRows.length} />
          <Stat label="Findings" value={findingRows.length} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabDefs.filter((t) => t.visible).map((tab) => (
          <Button key={tab.key} size="sm" variant={activeTab === tab.key ? "primary" : "ghost"} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Card title="Identity">
            <div className="text-xs text-gray-300 space-y-1">
              <div>Hostname: {workspace.target?.hostname || "—"}</div>
              <div>IP: {workspace.target?.ip_address || "—"}</div>
              <div>URL: {workspace.target?.url || "—"}</div>
              <div>Scope: {workspace.target?.in_scope ? "In scope" : "Out of scope"}</div>
              <div>Domains/URLs: {urlRows.length}</div>
            </div>
          </Card>
          <Card title="Attack Surface">
            <div className="text-xs text-gray-300 space-y-1">
              <div>Ports/Services: {serviceRows.length}</div>
              <div>Web Endpoints: {endpointRows.length}</div>
              <div>Parameters: {parameterRows.length}</div>
              <div>HTTP Messages: {httpMessages.length}</div>
              <div>Certificates: tracked via scans ({scans.length})</div>
            </div>
          </Card>
          <Card title="Testing & Security">
            <div className="text-xs text-gray-300 space-y-1">
              <div>Coverage: {workspace.coverage?.coverage_percent || 0}%</div>
              <div>Untested Endpoints: {coverage.untested}</div>
              <div>Findings: {findingRows.length}</div>
              <div>Valid Credentials: {credentialsRows.filter((c) => c.is_validated).length}</div>
              <div>Running Jobs: {cmdRuns.filter((r) => r.status === "running").length}</div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "hosts" && <SimpleList title="Hosts" rows={hostRows.map((h) => `${h.hostname || h.ip_address || "host"} · ${h.source_tool || "manual"}`)} />}
      {activeTab === "services" && <SimpleList title="Services" rows={serviceRows.map((s) => `${s.port || "?"}/${s.protocol || "tcp"} ${s.service_name || "service"} ${s.technology ? `· ${s.technology}` : ""}`)} />}
      {activeTab === "web" && <SimpleList title="Web URLs" rows={urlRows.map((u) => u.url)} />}

      {activeTab === "sitemap" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4 bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-2">
            <h3 className="text-sm font-semibold text-gray-300">Site Map Filters</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-1 text-gray-300"><input type="checkbox" checked={siteMapFilter.untested} onChange={(e) => setSiteMapFilter((f) => ({ ...f, untested: e.target.checked }))} /> Untested</label>
              <label className="flex items-center gap-1 text-gray-300"><input type="checkbox" checked={siteMapFilter.interesting} onChange={(e) => setSiteMapFilter((f) => ({ ...f, interesting: e.target.checked }))} /> Interesting</label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={siteMapFilter.auth} onChange={(e) => setSiteMapFilter((f) => ({ ...f, auth: e.target.value }))} options={[{ value: "", label: "Any auth" }, { value: "authenticated", label: "Authenticated" }, { value: "unauthenticated", label: "Unauthenticated" }]} />
              <Select value={siteMapFilter.method} onChange={(e) => setSiteMapFilter((f) => ({ ...f, method: e.target.value }))} options={[{ value: "", label: "Any method" }, { value: "GET", label: "GET" }, { value: "POST", label: "POST" }, { value: "PUT", label: "PUT" }, { value: "PATCH", label: "PATCH" }, { value: "DELETE", label: "DELETE" }]} />
              <Input placeholder="Status code" value={siteMapFilter.statusCode} onChange={(e) => setSiteMapFilter((f) => ({ ...f, statusCode: e.target.value }))} />
              <Input placeholder="Source" value={siteMapFilter.source} onChange={(e) => setSiteMapFilter((f) => ({ ...f, source: e.target.value }))} />
            </div>
            <div className="max-h-[26rem] overflow-auto border border-gray-800 rounded p-2"><SiteMapTree nodes={siteMap} onSelect={setSelectedSitePath} selectedPath={selectedSitePath} /></div>
          </div>
          <div className="lg:col-span-8 bg-gray-900 border border-gray-800 rounded-lg p-3">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Endpoint Nodes</h3>
            <div className="max-h-[30rem] overflow-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-gray-800 text-gray-400"><th className="text-left px-2 py-1">Method</th><th className="text-left px-2 py-1">Path</th><th className="text-left px-2 py-1">Status</th><th className="text-left px-2 py-1">Content</th><th className="text-left px-2 py-1">Auth</th><th className="text-left px-2 py-1">Testing</th><th className="text-left px-2 py-1">Source</th></tr></thead>
                <tbody>
                  {siteMapEndpoints.map((e) => (
                    <tr key={e.id} className={`border-b border-gray-800/50 cursor-pointer ${selectedEndpoint?.id === e.id ? "bg-brand-500/10" : "hover:bg-gray-800/30"}`} onClick={() => { setSelectedEndpointId(e.id); setActiveTab("endpoints"); }}>
                      <td className="px-2 py-1 text-brand-300">{e.method}</td>
                      <td className="px-2 py-1 text-gray-200">{e.path}</td>
                      <td className="px-2 py-1 text-gray-400">{e.status_code || "—"}</td>
                      <td className="px-2 py-1 text-gray-400">{e.content_type || "—"}</td>
                      <td className="px-2 py-1 text-gray-400">{e.auth_requirement || "unknown"}</td>
                      <td className="px-2 py-1 text-gray-300">{e.testing_status || "not_tested"}</td>
                      <td className="px-2 py-1 text-gray-500">{String((e as Record<string, unknown>).source_tool || "—")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {(activeTab === "apis" || activeTab === "endpoints") && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-5 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-gray-800 text-gray-400"><th className="text-left px-2 py-1">Method</th><th className="text-left px-2 py-1">Route</th><th className="text-left px-2 py-1">Test</th></tr></thead>
              <tbody>
                {endpointRows.map((e) => (
                  <tr key={e.id} className={`border-b border-gray-800/50 cursor-pointer ${selectedEndpoint?.id === e.id ? "bg-brand-500/10" : "hover:bg-gray-800/30"}`} onClick={() => setSelectedEndpointId(e.id)}>
                    <td className="px-2 py-1 text-brand-300">{e.method}</td>
                    <td className="px-2 py-1 text-gray-200">{e.path}</td>
                    <td className="px-2 py-1 text-gray-400">{e.testing_status || "not_tested"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lg:col-span-7 bg-gray-900 border border-gray-800 rounded-lg p-3 space-y-3">
            {!selectedEndpoint || !endpointDetail ? (
              <div className="text-gray-500 text-sm">Select an endpoint.</div>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-white">Endpoint Detail · {endpointDetail.endpoint.method} {endpointDetail.endpoint.path}</h3>
                <div className="grid md:grid-cols-2 gap-2 text-xs text-gray-300">
                  <div>Full URL: {endpointDetail.endpoint.path}</div>
                  <div>Content Type: {endpointDetail.endpoint.content_type || "—"}</div>
                  <div>Status Code: {endpointDetail.endpoint.status_code || "—"}</div>
                  <div>Auth Requirement: {endpointDetail.endpoint.auth_requirement || "unknown"}</div>
                  <div>First Seen: {endpointDetail.endpoint.first_seen || "—"}</div>
                  <div>Last Seen: {endpointDetail.endpoint.last_seen || "—"}</div>
                  <div>Last Tested: {endpointDetail.endpoint.last_tested_at || "—"}</div>
                  <div>Source Tool: {endpointDetail.endpoint.source_tool || "—"}</div>
                </div>

                <div className="grid md:grid-cols-2 gap-2">
                  <Select
                    label="Testing State"
                    value={endpointEdit.testing_status || endpointDetail.endpoint.testing_status || "not_tested"}
                    onChange={(e) => setEndpointEdit((f) => ({ ...f, testing_status: e.target.value }))}
                    options={STATUS_OPTIONS}
                  />
                  <Select
                    label="Auth Requirement"
                    value={endpointEdit.auth_requirement || endpointDetail.endpoint.auth_requirement || ""}
                    onChange={(e) => setEndpointEdit((f) => ({ ...f, auth_requirement: e.target.value }))}
                    options={[{ value: "", label: "Unknown" }, { value: "authenticated", label: "Authenticated" }, { value: "unauthenticated", label: "Unauthenticated" }]}
                  />
                </div>
                <label className="text-xs text-gray-300 flex items-center gap-2"><input type="checkbox" checked={endpointEdit.interesting} onChange={(e) => setEndpointEdit((f) => ({ ...f, interesting: e.target.checked }))} /> Mark interesting</label>
                <Textarea label="Notes" value={endpointEdit.notes} onChange={(e) => setEndpointEdit((f) => ({ ...f, notes: e.target.value }))} rows={2} />
                <div className="flex justify-end"><Button size="sm" variant="primary" onClick={() => updateEndpointMut.mutate(endpointEdit)} disabled={updateEndpointMut.isPending}>Save Endpoint</Button></div>

                <div className="grid md:grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-gray-400 mb-1">Parameters</div>
                    {endpointDetail.parameters.map((p: { id: string; location: string; name: string; sample_value?: string }) => <div key={p.id} className="text-gray-200">{p.location} · {p.name} {p.sample_value ? `= ${p.sample_value}` : ""}</div>)}
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="text-gray-400 mb-1">Related</div>
                    <div className="text-gray-200">HTTP: {endpointDetail.http_messages.length}</div>
                    <div className="text-gray-200">Findings: {endpointDetail.findings.length}</div>
                    <div className="text-gray-200">Evidence: {endpointDetail.evidence.length}</div>
                    <div className="text-gray-200">Credentials: {endpointDetail.credentials.length}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "parameters" && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="text-left text-gray-400 border-b border-gray-800"><th className="px-3 py-2">Endpoint</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Sample</th></tr></thead><tbody>{parameterRows.map((p) => <tr key={p.id} className="border-b border-gray-800/50"><td className="px-3 py-2 text-gray-300">{p.endpoint_id}</td><td className="px-3 py-2 text-gray-400">{p.location}</td><td className="px-3 py-2 text-brand-300">{p.name}</td><td className="px-3 py-2 text-gray-500 truncate max-w-64">{p.sample_value || "—"}</td></tr>)}</tbody></table>
        </div>
      )}

      {activeTab === "http" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:col-span-4 max-h-[34rem] overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">HTTP History</h3>
            <div className="space-y-1 text-xs">
              {httpMessages.map((msg) => (
                <button key={msg.id} onClick={() => setSelectedRequestId(msg.id)} className={`w-full text-left rounded px-2 py-1.5 border ${selectedMessage?.id === msg.id ? "bg-brand-500/20 border-brand-500/40 text-brand-300" : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"}`}>
                  {msg.method} {msg.path} {msg.status_code ? `(${msg.status_code})` : ""}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 lg:col-span-8">
            <div className="flex flex-wrap gap-2 mb-3">
              {HTTP_VIEWS.map((view) => <Button key={view} size="sm" variant={httpView === view ? "primary" : "ghost"} onClick={() => setHttpView(view)}>{view.toUpperCase()}</Button>)}
              <Button size="sm" variant="secondary" onClick={() => selectedMessage?.request_raw && navigator.clipboard.writeText(selectedMessage.request_raw)}>Copy Request</Button>
              <Button size="sm" variant="secondary" onClick={() => selectedMessage?.response_raw && navigator.clipboard.writeText(selectedMessage.response_raw)}>Copy Response</Button>
              <Button size="sm" variant="secondary" onClick={() => selectedMessage && navigator.clipboard.writeText(`${selectedMessage.method || "GET"} ${selectedMessage.path || "/"}`)}>Copy URL</Button>
            </div>
            {selectedMessage ? (
              <div className="text-xs">
                {httpView === "request" && <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{selectedMessage.request_raw || "No request"}</pre>}
                {httpView === "response" && <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{selectedMessage.response_raw || "No response"}</pre>}
                {httpView === "pretty" && <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{`${formatJsonCandidate(selectedMessage.request_pretty || selectedMessage.request_raw)}\n\n----\n\n${formatJsonCandidate(selectedMessage.response_pretty || selectedMessage.response_raw)}`}</pre>}
                {httpView === "raw" && <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{`REQUEST\n${selectedMessage.request_raw || ""}\n\nRESPONSE\n${selectedMessage.response_raw || ""}`}</pre>}
                {httpView === "headers" && <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{(selectedMessage.request_raw || "").split("\n\n")[0] || "No headers"}</pre>}
                {httpView === "body" && <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{(selectedMessage.request_raw || "").split("\n\n").slice(1).join("\n\n") || "No body"}</pre>}
                {httpView === "parameters" && <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{JSON.stringify(parsePossibleJson(selectedEndpoint?.query_params), null, 2)}</pre>}
                {httpView === "cookies" && <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{(selectedMessage.request_raw || "").split("\n").filter((l) => l.toLowerCase().startsWith("cookie:")).join("\n") || "No cookies observed"}</pre>}
                {httpView === "notes" && <div className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-300">Attach this request to findings/evidence from the Findings or Evidence tabs.</div>}
                {httpView === "diff" && <div className="grid grid-cols-1 md:grid-cols-2 gap-2"><pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{selectedMessage.request_raw || ""}</pre><pre className="bg-gray-800 border border-gray-700 rounded p-3 text-gray-200 whitespace-pre-wrap max-h-[28rem] overflow-y-auto">{selectedMessage.response_raw || ""}</pre></div>}
                {httpView === "history" && <div className="text-gray-300">Captured messages for target: {httpMessages.length}</div>}
                {httpView === "associations" && <div className="text-gray-300">Endpoint: {selectedMessage.endpoint_id || "unmapped"} · Source: {selectedMessage.source_tool || "manual"}</div>}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Card title="Target Credentials">
            <div className="space-y-1 text-xs">
              {credentialsRows.map((cred) => (
                <button key={cred.id} onClick={() => setSelectedCredentialId(cred.id)} className={`w-full text-left rounded px-2 py-1.5 border ${selectedCredentialId === cred.id ? "bg-brand-500/20 border-brand-500/40 text-brand-300" : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"}`}>
                  {(cred.domain ? `${cred.domain}\\` : "") + (cred.username || "(no-username)")} · {cred.secret_type} · {cred.is_validated ? "valid" : "unknown"}
                </button>
              ))}
            </div>
          </Card>
          <Card title="Service-Centric Usage Records">
            <div className="space-y-1 text-xs">
              {credentialUsages.map((u) => <div key={u.id} className="bg-gray-800 rounded px-2 py-1.5 text-gray-300">{u.validation_state} · endpoint {u.endpoint_id || "—"} · target {u.target_id || "—"}</div>)}
              {credentialUsages.length === 0 && <div className="text-gray-500">Select credential to view usage status matrix.</div>}
            </div>
          </Card>
        </div>
      )}

      {activeTab === "findings" && <SimpleList title="Findings" rows={findingRows.map((f) => `[${f.severity}] ${f.title} (${f.status})`)} onRowClick={(idx) => navigate(`/findings/${findingRows[idx]?.id}`)} />}
      {activeTab === "evidence" && <SimpleList title="Evidence" rows={evidenceRows.map((e) => `${e.title} · ${e.evidence_type}`)} onRowClick={() => navigate("/evidence")} />}
      {activeTab === "screenshots" && <SimpleList title="Screenshots" rows={evidenceRows.filter((e) => e.evidence_type.includes("screenshot") || e.evidence_type.includes("image")).map((e) => e.title)} />}

      {activeTab === "recon" && <SimpleList title="Recon" rows={[`Hosts: ${hostRows.length}`, `Services: ${serviceRows.length}`, `URLs: ${urlRows.length}`, `Endpoints: ${endpointRows.length}`, `Parameters: ${parameterRows.length}`]} />}
      {activeTab === "scans" && <SimpleList title="Scans" rows={scans.map((s) => `${s.filename} · ${s.scan_type} · ${s.status}`)} onRowClick={() => navigate("/scans")} />}
      {activeTab === "commands" && <SimpleList title="Commands" rows={cmdRuns.map((r) => `${r.command_preview} (${r.status})`)} />}
      {activeTab === "jobs" && <SimpleList title="Jobs" rows={cmdRuns.map((r) => `${r.status} · ${r.runner_name || "unassigned"} · ${r.command_preview}`)} onRowClick={() => navigate("/jobs")} />}
      {activeTab === "loot" && <SimpleList title="Loot / Artifacts" rows={["Use Evidence and Scan artifacts linked to this target.", `Evidence records: ${evidenceRows.length}`, `Scans linked: ${scans.length}`]} />}
      {activeTab === "notes" && <SimpleList title="Notes" rows={notesRows.map((n) => `${n.title} · ${n.note_type || "general"}`)} onRowClick={() => navigate("/notes")} />}
      {activeTab === "tasks" && <SimpleList title="Tasks" rows={tasksRows.map((t) => `${t.title} · ${t.status}${t.priority ? ` · ${t.priority}` : ""}`)} onRowClick={() => navigate("/tasks")} />}
      {activeTab === "footholds" && <SimpleList title="Footholds / Access" rows={["Foothold tracking is stored in operator models and shown in engagement operations (UI expansion in progress)."]} />}
      {activeTab === "attackpaths" && <SimpleList title="Attack Paths" rows={["Attack relationships exist in operator models and can be linked from findings/credentials/workspace context."]} />}
      {activeTab === "timeline" && <SimpleList title="Timeline" rows={workspace.notes?.slice(0, 10).map((n) => `${n.title} updated`) || []} />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-800 rounded p-2"><span className="text-gray-400">{label}</span><div className="text-white text-base font-semibold">{value}</div></div>
  );
}

function SimpleList({ title, rows, onRowClick }: { title: string; rows: string[]; onRowClick?: (idx: number) => void }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <h3 className="text-sm font-semibold text-gray-300 mb-2">{title}</h3>
      <div className="space-y-1 text-xs max-h-[26rem] overflow-auto">
        {rows.map((row, idx) => (
          <button key={`${title}-${idx}`} className="w-full text-left bg-gray-800 rounded px-2 py-1.5 text-gray-300 hover:bg-gray-700" onClick={() => onRowClick?.(idx)}>{row}</button>
        ))}
        {rows.length === 0 && <div className="text-gray-500">No records.</div>}
      </div>
    </div>
  );
}
