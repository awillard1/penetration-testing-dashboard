import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { payloadsApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Plus, Code2, Copy, Trash2, Pencil } from "lucide-react";
import toast from "react-hot-toast";

const CATEGORIES = ["injection","reverse_shell","xss","xxe","ssti","auth_bypass","file_upload","path_traversal","rce","ssrf","other"].map(v => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));
const ENCODINGS = ["none","base64","url","html","double_url","hex"].map(v => ({ value: v, label: v.replace(/_/g, " ") }));

const emptyForm = { name: "", category: "injection", content: "", description: "", language: "none" };

export default function PayloadsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState({ category: "", q: "" });
  const [form, setForm] = useState(emptyForm);

  const { data: payloads = [] } = useQuery({ queryKey: ["payloads", filter], queryFn: () => payloadsApi.list({ ...(filter.category && { category: filter.category }), ...(filter.q && { q: filter.q }) }) });

  const createMut = useMutation({ mutationFn: (data: typeof form) => payloadsApi.create(data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["payloads"] }); setShowModal(false); toast.success("Payload saved"); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: typeof form }) => payloadsApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["payloads"] }); setEditingId(null); toast.success("Payload updated"); } });
  const deleteMut = useMutation({ mutationFn: (id: string) => payloadsApi.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["payloads"] }) });
  const useMut = useMutation({ mutationFn: (id: string) => payloadsApi.use(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["payloads"] }) });

  type Payload = { id: string; name: string; category: string; content: string; description?: string; language: string; usage_count: number };
  const allPayloads = payloads as Payload[];
  const catOpts = [{ value: "", label: "All Categories" }, ...CATEGORIES];

  const copyPayload = (p: Payload) => {
    navigator.clipboard.writeText(p.content).then(() => toast.success("Copied!"));
    useMut.mutate(p.id);
  };

  const openEdit = (p: Payload) => {
    setForm({ name: p.name, category: p.category, content: p.content, description: p.description || "", language: p.language || "none" });
    setEditingId(p.id);
  };

  const PayloadFormFields = () => (
    <>
      <Input label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} options={CATEGORIES} />
        <Select label="Encoding" value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} options={ENCODINGS} />
      </div>
      <Textarea label="Payload *" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={5} className="font-mono" />
      <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Payload Library</h1>
        <div className="flex gap-2">
          <Input placeholder="Search…" value={filter.q} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} className="w-40" />
          <Select options={catOpts} value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} />
          <Button variant="primary" size="sm" onClick={() => { setForm(emptyForm); setShowModal(true); }}><Plus size={14}/> Add</Button>
        </div>
      </div>
      <div className="grid gap-2">
        {allPayloads.map(p => (
          <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Code2 size={14} className="text-brand-400"/>
                <span className="font-medium text-white text-sm">{p.name}</span>
                <span className="text-xs bg-gray-800 text-gray-400 px-1.5 rounded">{p.category}</span>
                {p.language && p.language !== "none" && <span className="text-xs bg-yellow-900 text-yellow-300 px-1.5 rounded">{p.language}</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span>{p.usage_count}x</span>
                <button onClick={() => copyPayload(p)} className="text-gray-400 hover:text-brand-400 p-1"><Copy size={12}/></button>
                <button onClick={() => openEdit(p)} className="text-gray-500 hover:text-brand-400 p-1"><Pencil size={12}/></button>
                <button onClick={() => deleteMut.mutate(p.id)} className="text-gray-500 hover:text-red-400 p-1"><Trash2 size={12}/></button>
              </div>
            </div>
            <code className="block bg-gray-950 text-green-300 text-xs p-2 rounded font-mono overflow-x-auto whitespace-pre">{p.content}</code>
          </div>
        ))}
        {allPayloads.length === 0 && <div className="text-center py-8 text-gray-500">No payloads yet.</div>}
      </div>
      {showModal && (
        <Modal title="Add Payload" onClose={() => setShowModal(false)} width="max-w-2xl">
          <div className="space-y-3">
            <PayloadFormFields />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => createMut.mutate(form)} disabled={!form.name || !form.content}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
      {editingId && (
        <Modal title="Edit Payload" onClose={() => setEditingId(null)} width="max-w-2xl">
          <div className="space-y-3">
            <PayloadFormFields />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => editingId && updateMut.mutate({ id: editingId, data: form })} disabled={!form.name || !form.content}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
