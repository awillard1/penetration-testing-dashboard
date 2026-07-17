import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { findingsApi, engagementsApi, evidenceApi } from "../api/client";
import Button from "../components/ui/Button";
import { SeverityBadge, StatusBadge } from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Input, Select } from "../components/ui/Input";
import MarkdownEditor from "../components/ui/MarkdownEditor";
import { Plus, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

const SEVERITIES = ["informational","low","medium","high","critical"].map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));
const STATUSES = ["draft","confirmed","needs_review","ready_for_report","reported","accepted_risk","remediation_in_progress","ready_for_retest","retest_failed","retest_passed","closed","duplicate","false_positive"]
  .map(v => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));

export default function FindingsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [filterSev, setFilterSev] = useState("");
  const [filterEng, setFilterEng] = useState("");
  const [form, setForm] = useState({ engagement_id: "", title: "", severity: "medium", status: "draft", description: "", remediation: "" });

  const { data: findings = [] } = useQuery({ queryKey: ["findings", filterEng, filterSev], queryFn: () => findingsApi.list({ ...(filterEng && { engagement_id: filterEng }), ...(filterSev && { severity: filterSev }) }) });
  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });
  const { data: engagementEvidence = [] } = useQuery({
    queryKey: ["evidence", "finding-create", form.engagement_id],
    queryFn: () => evidenceApi.list({ engagement_id: form.engagement_id }),
    enabled: !!form.engagement_id,
  });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => findingsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["findings"] }); setShowModal(false); toast.success("Finding created"); },
  });

  const engOpts = [{ value: "", label: "All Engagements" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))];
  const sevOpts = [{ value: "", label: "All Severities" }, ...SEVERITIES];
  const evidenceInsertOptions = (engagementEvidence as Array<{ id: string; title: string; mime_type?: string }>).map((ev) => {
    const downloadUrl = evidenceApi.downloadUrl(ev.id);
    const markdown = (ev.mime_type || "").startsWith("image/")
      ? `![${ev.title}](${downloadUrl})`
      : `[${ev.title}](${downloadUrl})`;
    return { label: ev.title, value: markdown };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Findings</h1>
        <div className="flex gap-2">
          <Select options={engOpts} value={filterEng} onChange={e => setFilterEng(e.target.value)} />
          <Select options={sevOpts} value={filterSev} onChange={e => setFilterSev(e.target.value)} />
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}><Plus size={14} /> Add Finding</Button>
        </div>
      </div>
      <div className="space-y-2">
        {(findings as Array<{ id: string; title: string; severity: string; status: string; cwe?: string; date_discovered?: string }>).map(f => (
          <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-brand-500/50 transition-colors" onClick={() => navigate(`/findings/${f.id}`)}>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white truncate">{f.title}</div>
              {f.cwe && <div className="text-xs text-gray-500 mt-0.5">{f.cwe}</div>}
            </div>
            <SeverityBadge severity={f.severity} />
            <StatusBadge status={f.status} />
            <ChevronRight size={14} className="text-gray-500 flex-shrink-0" />
          </div>
        ))}
        {(findings as Array<unknown>).length === 0 && <div className="text-center py-8 text-gray-500">No findings yet.</div>}
      </div>
      {showModal && (
        <Modal title="New Finding" onClose={() => setShowModal(false)} width="max-w-2xl">
          <div className="space-y-3">
            <Select label="Engagement *" value={form.engagement_id} onChange={e => setForm(f => ({ ...f, engagement_id: e.target.value }))} options={[{ value: "", label: "Select…" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))]} />
            <Input label="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Severity" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} options={SEVERITIES} />
              <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={STATUSES} />
            </div>
            <MarkdownEditor label="Description" value={form.description} onChange={(value) => setForm(f => ({ ...f, description: value }))} rows={5} insertOptions={evidenceInsertOptions} />
            <MarkdownEditor label="Remediation" value={form.remediation} onChange={(value) => setForm(f => ({ ...f, remediation: value }))} rows={4} insertOptions={evidenceInsertOptions} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => createMut.mutate(form)} disabled={!form.title || !form.engagement_id}>Create</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
