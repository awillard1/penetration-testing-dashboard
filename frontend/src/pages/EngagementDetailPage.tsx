import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { engagementsApi, settingsApi } from "../api/client";
import { StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import toast from "react-hot-toast";
import { Star, Trash2 } from "lucide-react";

const STATUSES = ["draft", "planning", "active", "paused", "awaiting_client", "reporting", "retesting", "complete", "archived"].map((v) => ({
  value: v,
  label: v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
}));

const TYPES = [
  "web_application",
  "api",
  "internal_network",
  "external_network",
  "wireless",
  "cloud",
  "mobile",
  "social_engineering",
  "physical",
  "red_team",
  "purple_team",
  "configuration_review",
  "vulnerability_assessment",
  "source_code_review",
  "other",
].map((v) => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) }));

export default function EngagementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    status: "draft",
    engagement_type: "other",
    description: "",
    primary_tester: "",
    start_date: "",
    end_date: "",
    testing_window: "",
    scope_notes: "",
    out_of_scope_notes: "",
    rules_of_engagement: "",
    authorization_notes: "",
  });

  const { data: eng } = useQuery({ queryKey: ["engagement", id], queryFn: () => engagementsApi.get(id!) });
  const { data: summary } = useQuery({ queryKey: ["engagement-summary", id], queryFn: () => engagementsApi.summary(id!) });

  useEffect(() => {
    if (!eng) return;
    setForm({
      name: eng.name || "",
      status: eng.status || "draft",
      engagement_type: eng.engagement_type || "other",
      description: eng.description || "",
      primary_tester: eng.primary_tester || "",
      start_date: eng.start_date || "",
      end_date: eng.end_date || "",
      testing_window: eng.testing_window || "",
      scope_notes: eng.scope_notes || "",
      out_of_scope_notes: eng.out_of_scope_notes || "",
      rules_of_engagement: eng.rules_of_engagement || "",
      authorization_notes: eng.authorization_notes || "",
    });
  }, [eng]);

  const setActiveMut = useMutation({
    mutationFn: () => settingsApi.set("active_engagement_id", id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Set as active engagement");
    },
    onError: () => toast.error("Failed to set active engagement"),
  });

  const updateMut = useMutation({
    mutationFn: () => engagementsApi.update(id!, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engagement", id] });
      qc.invalidateQueries({ queryKey: ["engagements"] });
      qc.invalidateQueries({ queryKey: ["engagement-summary", id] });
      toast.success("Engagement updated");
      setEditing(false);
    },
    onError: () => toast.error("Failed to update engagement"),
  });

  const deleteMut = useMutation({
    mutationFn: () => engagementsApi.remove(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["engagements"] });
      window.location.href = "/engagements";
    },
    onError: () => toast.error("Failed to delete engagement"),
  });

  if (!eng) return <div className="text-gray-400">Loading…</div>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{eng.name}</h1>
          <div className="flex gap-2 mt-1">
            <StatusBadge status={eng.status} />
            <span className="text-xs text-gray-500">{eng.engagement_type?.replace(/_/g, " ")}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setActiveMut.mutate()}>
            <Star size={14} /> Set Active
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            ["Targets", summary.total_targets],
            ["Findings", summary.total_findings],
            ["Evidence", summary.evidence_count],
            ["Credentials", summary.credential_count],
            ["Scans", summary.scan_count],
            ["Open Tasks", summary.open_tasks],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-gray-900 border border-gray-800 rounded p-3 text-center">
              <div className="text-2xl font-bold text-white">{value as number}</div>
              <div className="text-xs text-gray-400">{label as string}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Details</h2>

        {editing ? (
          <div className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <Select label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} options={STATUSES} />
              <Select label="Type" value={form.engagement_type} onChange={(e) => setForm((f) => ({ ...f, engagement_type: e.target.value }))} options={TYPES} />
              <Input label="Primary Tester" value={form.primary_tester} onChange={(e) => setForm((f) => ({ ...f, primary_tester: e.target.value }))} />
              <Input label="Start Date" type="date" value={form.start_date || ""} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
              <Input label="End Date" type="date" value={form.end_date || ""} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            </div>
            <Input label="Testing Window" value={form.testing_window} onChange={(e) => setForm((f) => ({ ...f, testing_window: e.target.value }))} />
            <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <Textarea label="Scope Notes" rows={2} value={form.scope_notes} onChange={(e) => setForm((f) => ({ ...f, scope_notes: e.target.value }))} />
            <Textarea label="Out of Scope Notes" rows={2} value={form.out_of_scope_notes} onChange={(e) => setForm((f) => ({ ...f, out_of_scope_notes: e.target.value }))} />
            <Textarea label="Rules of Engagement" rows={3} value={form.rules_of_engagement} onChange={(e) => setForm((f) => ({ ...f, rules_of_engagement: e.target.value }))} />
            <Textarea label="Authorization Notes" rows={2} value={form.authorization_notes} onChange={(e) => setForm((f) => ({ ...f, authorization_notes: e.target.value }))} />
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => updateMut.mutate()} disabled={updateMut.isPending || !form.name}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-1">Description</p>
              <p className="text-gray-300 whitespace-pre-wrap">{eng.description || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Primary Tester</p>
              <p className="text-gray-300">{eng.primary_tester || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Testing Window</p>
              <p className="text-gray-300">{eng.testing_window || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Dates</p>
              <p className="text-gray-300">{eng.start_date || "—"} → {eng.end_date || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Scope Notes</p>
              <p className="text-gray-300 whitespace-pre-wrap">{eng.scope_notes || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Out of Scope</p>
              <p className="text-gray-300 whitespace-pre-wrap">{eng.out_of_scope_notes || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Rules of Engagement</p>
              <p className="text-gray-300 whitespace-pre-wrap">{eng.rules_of_engagement || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Authorization Notes</p>
              <p className="text-gray-300 whitespace-pre-wrap">{eng.authorization_notes || "—"}</p>
            </div>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <Modal title="Delete Engagement" onClose={() => setShowDeleteModal(false)} width="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-gray-300">Delete <span className="font-semibold text-white">{eng.name}</span>? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>
                {deleteMut.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
