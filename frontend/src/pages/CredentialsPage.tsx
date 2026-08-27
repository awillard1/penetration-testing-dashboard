import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { credentialsApi, engagementsApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Plus, Eye, Trash2, Pencil, Copy } from "lucide-react";
import toast from "react-hot-toast";

type CredentialRecord = {
  id: string;
  engagement_id: string;
  target_id?: string;
  username?: string;
  domain?: string;
  secret_type: string;
  source?: string;
  privilege_level?: string;
  is_validated: boolean;
  notes?: string;
  tags?: string;
  created_at?: string;
  updated_at?: string;
};

const secretTypes = ["password", "api_key", "token", "ntlm_hash", "ssh_key", "cookie", "certificate", "connection_string", "other"].map((v) => ({
  value: v,
  label: v.replace(/_/g, " "),
}));

export default function CredentialsPage() {
  const qc = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [query, setQuery] = useState("");
  const [filterEng, setFilterEng] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<CredentialRecord | null>(null);
  const [form, setForm] = useState({
    engagement_id: "",
    target_id: "",
    username: "",
    domain: "",
    secret_type: "password",
    plaintext_secret: "",
    source: "",
    privilege_level: "",
    notes: "",
    tags: "",
    is_validated: false,
  });

  const { data: creds = [] } = useQuery({
    queryKey: ["credentials", filterEng],
    queryFn: () => credentialsApi.list(filterEng ? { engagement_id: filterEng } : {}),
  });
  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => credentialsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credentials"] });
      setShowCreateModal(false);
      toast.success("Credential added");
    },
    onError: () => toast.error("Failed to create credential"),
  });

  const updateMut = useMutation({
    mutationFn: (data: typeof form) => credentialsApi.update(selected!.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credentials"] });
      setShowEditModal(false);
      toast.success("Credential updated");
    },
    onError: () => toast.error("Failed to update credential"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => credentialsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credentials"] });
      setShowDeleteModal(false);
      toast.success("Credential deleted");
    },
    onError: () => toast.error("Failed to delete credential"),
  });

  const revealSecret = async (id: string) => {
    try {
      const { secret } = await credentialsApi.reveal(id);
      setRevealed((r) => ({ ...r, [id]: secret || "(empty)" }));
    } catch {
      toast.error("Failed to reveal secret");
    }
  };

  const engOpts = [{ value: "", label: "All Engagements" }, ...(engagements as Array<{ id: string; name: string }>).map((e) => ({ value: e.id, label: e.name }))];

  const filtered = (creds as CredentialRecord[]).filter((c) => {
    if (!query) return true;
    const hay = `${c.username || ""} ${c.domain || ""} ${c.source || ""} ${c.privilege_level || ""} ${c.secret_type}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const startEdit = (row: CredentialRecord) => {
    setSelected(row);
    setForm({
      engagement_id: row.engagement_id,
      target_id: row.target_id || "",
      username: row.username || "",
      domain: row.domain || "",
      secret_type: row.secret_type,
      plaintext_secret: "",
      source: row.source || "",
      privilege_level: row.privilege_level || "",
      notes: row.notes || "",
      tags: row.tags || "",
      is_validated: !!row.is_validated,
    });
    setShowEditModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Credentials</h1>
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search credentials" className="w-56" />
          <Select options={engOpts} value={filterEng} onChange={(e) => setFilterEng(e.target.value)} />
          <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> Add Credential
          </Button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-400">
              {["Username", "Domain", "Type", "Source", "Privilege", "Validated", "Secret", "Updated", ""].map((h) => (
                <th key={h} className="text-left px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-3 py-2 text-brand-400">{c.username || "—"}</td>
                <td className="px-3 py-2 text-gray-300">{c.domain || "—"}</td>
                <td className="px-3 py-2 text-gray-400">{c.secret_type}</td>
                <td className="px-3 py-2 text-gray-400">{c.source || "—"}</td>
                <td className="px-3 py-2 text-gray-400">{c.privilege_level || "—"}</td>
                <td className="px-3 py-2 text-gray-300">{c.is_validated ? "Yes" : "No"}</td>
                <td className="px-3 py-2">
                  {revealed[c.id] ? (
                    <div className="flex items-center gap-2">
                      <span className="text-green-300 text-xs font-mono max-w-48 truncate">{revealed[c.id]}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(revealed[c.id]).then(() => toast.success("Secret copied"))}
                        className="text-gray-500 hover:text-brand-400"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => revealSecret(c.id)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-400"><Eye size={12} /> Reveal</button>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-500">{c.updated_at ? new Date(c.updated_at).toLocaleDateString() : "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(c)} className="text-gray-500 hover:text-brand-400"><Pencil size={13} /></button>
                    <button onClick={() => { setSelected(c); setShowDeleteModal(true); }} className="text-gray-500 hover:text-red-400"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-8 text-gray-500">No credentials found.</div>}
      </div>

      {showCreateModal && (
        <CredentialModal
          title="Add Credential"
          form={form}
          setForm={setForm}
          engagements={engagements as Array<{ id: string; name: string }>}
          onClose={() => setShowCreateModal(false)}
          onSubmit={() => createMut.mutate(form)}
          pending={createMut.isPending}
        />
      )}

      {showEditModal && (
        <CredentialModal
          title="Edit Credential"
          form={form}
          setForm={setForm}
          engagements={engagements as Array<{ id: string; name: string }>}
          onClose={() => setShowEditModal(false)}
          onSubmit={() => updateMut.mutate(form)}
          pending={updateMut.isPending}
          submitLabel="Save"
        />
      )}

      {showDeleteModal && selected && (
        <Modal title="Delete Credential" onClose={() => setShowDeleteModal(false)} width="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-gray-300">Delete credential <span className="font-semibold text-white">{selected.username || selected.id}</span>? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => deleteMut.mutate(selected.id)} disabled={deleteMut.isPending}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CredentialModal({
  title,
  form,
  setForm,
  engagements,
  onClose,
  onSubmit,
  pending,
  submitLabel = "Add",
}: {
  title: string;
  form: {
    engagement_id: string;
    target_id: string;
    username: string;
    domain: string;
    secret_type: string;
    plaintext_secret: string;
    source: string;
    privilege_level: string;
    notes: string;
    tags: string;
    is_validated: boolean;
  };
  setForm: Dispatch<SetStateAction<{
    engagement_id: string;
    target_id: string;
    username: string;
    domain: string;
    secret_type: string;
    plaintext_secret: string;
    source: string;
    privilege_level: string;
    notes: string;
    tags: string;
    is_validated: boolean;
  }>>;
  engagements: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
  submitLabel?: string;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-3">
        <Select label="Engagement *" value={form.engagement_id} onChange={(e) => setForm((f) => ({ ...f, engagement_id: e.target.value }))} options={[{ value: "", label: "Select…" }, ...engagements.map((e) => ({ value: e.id, label: e.name }))]} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} />
          <Input label="Domain" value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" value={form.secret_type} onChange={(e) => setForm((f) => ({ ...f, secret_type: e.target.value }))} options={secretTypes} />
          <Input label="Target ID" value={form.target_id} onChange={(e) => setForm((f) => ({ ...f, target_id: e.target.value }))} />
        </div>
        <Input label="Secret Value" type="password" value={form.plaintext_secret} onChange={(e) => setForm((f) => ({ ...f, plaintext_secret: e.target.value }))} placeholder="Optional for edit" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Source" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
          <Input label="Privilege" value={form.privilege_level} onChange={(e) => setForm((f) => ({ ...f, privilege_level: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Tags" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
          <label className="flex items-center gap-2 text-sm text-gray-300 mt-6">
            <input type="checkbox" checked={form.is_validated} onChange={(e) => setForm((f) => ({ ...f, is_validated: e.target.checked }))} />
            Validated
          </label>
        </div>
        <Textarea label="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={onSubmit} disabled={!form.engagement_id || pending}>{submitLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
