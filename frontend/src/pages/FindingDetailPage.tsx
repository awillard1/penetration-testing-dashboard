import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { findingsApi } from "../api/client";
import { SeverityBadge, StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { Select, Textarea } from "../components/ui/Input";
import toast from "react-hot-toast";
import { useState } from "react";

const SEVERITIES = ["informational","low","medium","high","critical"].map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));
const STATUSES = ["draft","confirmed","needs_review","ready_for_report","reported","closed","false_positive","retest_passed","retest_failed"]
  .map(v => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));

export default function FindingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: finding } = useQuery({ queryKey: ["finding", id], queryFn: () => findingsApi.get(id!) });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const updateMut = useMutation({
    mutationFn: (data: Record<string, string>) => findingsApi.update(id!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["finding", id] }); setEditing(false); toast.success("Finding updated"); },
  });

  if (!finding) return <div className="text-gray-400">Loading…</div>;

  const startEdit = () => { setForm({ severity: finding.severity, status: finding.status, description: finding.description || "", remediation: finding.remediation || "", impact: finding.impact || "", reproduction_steps: finding.reproduction_steps || "" }); setEditing(true); };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{finding.title}</h1>
          <div className="flex gap-2 mt-1">
            <SeverityBadge severity={finding.severity} />
            <StatusBadge status={finding.status} />
            {finding.cwe && <span className="text-xs text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">{finding.cwe}</span>}
            <span className="text-xs text-gray-500">v{finding.version}</span>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={editing ? () => setEditing(false) : startEdit}>{editing ? "Cancel" : "Edit"}</Button>
      </div>

      {editing ? (
        <div className="space-y-3 bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Severity" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} options={SEVERITIES} />
            <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={STATUSES} />
          </div>
          <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={5} />
          <Textarea label="Impact" value={form.impact} onChange={e => setForm(f => ({ ...f, impact: e.target.value }))} rows={3} />
          <Textarea label="Reproduction Steps" value={form.reproduction_steps} onChange={e => setForm(f => ({ ...f, reproduction_steps: e.target.value }))} rows={4} />
          <Textarea label="Remediation" value={form.remediation} onChange={e => setForm(f => ({ ...f, remediation: e.target.value }))} rows={3} />
          <Button variant="primary" size="sm" onClick={() => updateMut.mutate(form)}>Save Changes</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {finding.description && <Section title="Description" content={finding.description} />}
          {finding.impact && <Section title="Impact" content={finding.impact} />}
          {finding.reproduction_steps && <Section title="Reproduction Steps" content={finding.reproduction_steps} />}
          {finding.remediation && <Section title="Remediation" content={finding.remediation} />}
          {finding.references && <Section title="References" content={finding.references} />}
        </div>
      )}
    </div>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-xs text-gray-400 uppercase mb-2">{title}</h3>
      <p className="text-sm text-gray-300 whitespace-pre-wrap">{content}</p>
    </div>
  );
}
