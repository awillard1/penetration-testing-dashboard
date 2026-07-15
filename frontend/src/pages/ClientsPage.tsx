import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Textarea } from "../components/ui/Input";
import { Plus, Building2 } from "lucide-react";
import toast from "react-hot-toast";

export default function ClientsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", industry: "", notes: "" });
  const { data: clients = [] } = useQuery({ queryKey: ["clients"], queryFn: () => clientsApi.list() });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => clientsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["clients"] }); setShowModal(false); toast.success("Client created"); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Clients</h1>
        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}><Plus size={14} /> New Client</Button>
      </div>
      <div className="grid gap-3">
        {(clients as Array<{ id: string; name: string; industry?: string; is_active: boolean }>).map(c => (
          <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center gap-3">
            <Building2 size={18} className="text-brand-400 flex-shrink-0" />
            <div>
              <div className="font-medium text-white">{c.name}</div>
              {c.industry && <div className="text-xs text-gray-400">{c.industry}</div>}
            </div>
            <span className={`ml-auto text-xs px-2 py-0.5 rounded ${c.is_active ? "text-green-300 bg-green-900" : "text-gray-400 bg-gray-800"}`}>{c.is_active ? "Active" : "Inactive"}</span>
          </div>
        ))}
        {(clients as Array<unknown>).length === 0 && <div className="text-center py-8 text-gray-500">No clients yet.</div>}
      </div>
      {showModal && (
        <Modal title="New Client" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Input label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Industry" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
            <Textarea label="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => createMut.mutate(form)} disabled={!form.name}>Create</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
