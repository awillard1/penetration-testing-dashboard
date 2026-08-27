import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { evidenceApi, findingsApi } from "../api/client";
import { SeverityBadge, StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { Select } from "../components/ui/Input";
import MarkdownEditor from "../components/ui/MarkdownEditor";
import Modal from "../components/ui/Modal";
import toast from "react-hot-toast";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { canManageEngagements, canViewEvidence } from "../lib/capabilities";
import { useAuth } from "../useAuth";

const SEVERITIES = ["informational","low","medium","high","critical"].map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));
const STATUSES = ["draft","confirmed","needs_review","ready_for_report","reported","closed","false_positive","retest_passed","retest_failed"]
  .map(v => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));

export default function FindingDetailPage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canEditFinding = canManageEngagements(user);
  const { data: finding } = useQuery({ queryKey: ["finding", id], queryFn: () => findingsApi.get(id!) });
  const [editing, setEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const { data: engagementEvidence = [] } = useQuery({
    queryKey: ["evidence", "finding-editor", finding?.engagement_id],
    queryFn: () => evidenceApi.list({ engagement_id: finding!.engagement_id }),
    enabled: canEditFinding && canViewEvidence(user) && !!finding?.engagement_id,
  });

  const updateMut = useMutation({
    mutationFn: (data: Record<string, string>) => findingsApi.update(id!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finding", id] });
      qc.invalidateQueries({ queryKey: ["findings"] });
      setEditing(false);
      toast.success("Finding updated");
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => findingsApi.remove(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["findings"] });
      toast.success("Finding deleted");
      navigate("/findings");
    },
  });

  if (!finding) return <div className="text-gray-400">Loading…</div>;

  const startEdit = () => { setForm({ severity: finding.severity, status: finding.status, description: finding.description || "", remediation: finding.remediation || "", impact: finding.impact || "", reproduction_steps: finding.reproduction_steps || "" }); setEditing(true); };
  const evidenceInsertOptions = (engagementEvidence as Array<{ id: string; title: string; mime_type?: string }>).map((ev) => {
    const downloadUrl = evidenceApi.downloadUrl(ev.id);
    const markdown = (ev.mime_type || "").startsWith("image/")
      ? `![${ev.title}](${downloadUrl})`
      : `[${ev.title}](${downloadUrl})`;
    return { label: ev.title, value: markdown };
  });

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
        <div className="flex items-center gap-2">
          {canEditFinding && (
            <>
              <Button variant="secondary" size="sm" onClick={editing ? () => setEditing(false) : startEdit}>{editing ? "Cancel" : "Edit"}</Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteModal(true)}
                disabled={deleteMut.isPending}
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-3 bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Severity" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} options={SEVERITIES} />
            <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={STATUSES} />
          </div>
          <MarkdownEditor label="Description" value={form.description || ""} onChange={(value) => setForm(f => ({ ...f, description: value }))} rows={6} insertOptions={evidenceInsertOptions} />
          <MarkdownEditor label="Impact" value={form.impact || ""} onChange={(value) => setForm(f => ({ ...f, impact: value }))} rows={4} insertOptions={evidenceInsertOptions} />
          <MarkdownEditor label="Reproduction Steps" value={form.reproduction_steps || ""} onChange={(value) => setForm(f => ({ ...f, reproduction_steps: value }))} rows={5} insertOptions={evidenceInsertOptions} />
          <MarkdownEditor label="Remediation" value={form.remediation || ""} onChange={(value) => setForm(f => ({ ...f, remediation: value }))} rows={4} insertOptions={evidenceInsertOptions} />
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
      {canEditFinding && showDeleteModal && (
        <Modal title="Delete Finding" onClose={() => setShowDeleteModal(false)} width="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              Delete <span className="font-semibold text-white">{finding.title}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => deleteMut.mutate()}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? "Deleting..." : "Delete Finding"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Section({ title, content }: { title: string; content: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-xs text-gray-400 uppercase mb-2">{title}</h3>
      <div className="text-sm text-gray-300">
        <ReactMarkdown
          components={{
            a: ({ ...props }) => <a {...props} className="text-brand-400 hover:text-brand-300 underline" target="_blank" rel="noreferrer" />,
            code: ({ ...props }) => <code {...props} className="bg-gray-950 rounded px-1 py-0.5 text-xs" />,
            p: ({ ...props }) => <p {...props} className="mb-2 last:mb-0 whitespace-pre-wrap" />,
            ul: ({ ...props }) => <ul {...props} className="list-disc pl-5 mb-2" />,
            ol: ({ ...props }) => <ol {...props} className="list-decimal pl-5 mb-2" />,
            img: ({ ...props }) => <img {...props} className="max-h-96 rounded border border-gray-700 mt-2" />,
            h1: ({ ...props }) => <h1 {...props} className="text-base font-semibold mt-2 mb-1" />,
            h2: ({ ...props }) => <h2 {...props} className="text-sm font-semibold mt-2 mb-1" />,
            h3: ({ ...props }) => <h3 {...props} className="text-sm font-semibold mt-2 mb-1" />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
