import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { targetApi, engagementsApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select } from "../components/ui/Input";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export default function TargetsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [filterEng, setFilterEng] = useState("");
  const [form, setForm] = useState({ engagement_id: "", hostname: "", ip_address: "", port: "", protocol: "tcp", url: "", environment: "production" });
  const { data: targets = [] } = useQuery({ queryKey: ["targets", filterEng], queryFn: () => targetApi.list(filterEng ? { engagement_id: filterEng } : {}) });
  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => targetApi.create({ ...data, port: data.port ? parseInt(data.port) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["targets"] }); setShowModal(false); toast.success("Target created"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => targetApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["targets"] }); toast.success("Deleted"); },
  });

  const engOpts = [{ value: "", label: "All Engagements" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Targets</h1>
        <div className="flex gap-2">
          <Select options={engOpts} value={filterEng} onChange={e => setFilterEng(e.target.value)} />
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}><Plus size={14} /> Add Target</Button>
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-xs text-gray-400">{["Hostname","IP","Port","Protocol","Environment","Scope",""].map(h => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {(targets as Array<{ id: string; hostname?: string; ip_address?: string; url?: string; port?: number; protocol?: string; environment?: string; engagement_id?: string; in_scope: boolean }>).map(t => (
              <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-3 py-2 text-brand-400">
                  <button className="hover:underline" onClick={() => navigate(`/workspace/${t.id}?engagementId=${t.engagement_id || ""}`)}>
                    {t.hostname || t.url || t.ip_address || "Open Workspace"}
                  </button>
                </td>
                <td className="px-3 py-2 text-gray-300">{t.ip_address || "—"}</td>
                <td className="px-3 py-2 text-gray-300">{t.port || "—"}</td>
                <td className="px-3 py-2 text-gray-400">{t.protocol || "—"}</td>
                <td className="px-3 py-2 text-gray-400">{t.environment || "—"}</td>
                <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${t.in_scope ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}>{t.in_scope ? "In Scope" : "Out"}</span></td>
                <td className="px-3 py-2"><button onClick={() => deleteMut.mutate(t.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={13}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {(targets as Array<unknown>).length === 0 && <div className="text-center py-8 text-gray-500">No targets yet.</div>}
      </div>
      {showModal && (
        <Modal title="Add Target" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Select label="Engagement *" value={form.engagement_id} onChange={e => setForm(f => ({ ...f, engagement_id: e.target.value }))} options={[{ value: "", label: "Select…" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))]} />
            <Input label="Hostname" value={form.hostname} onChange={e => setForm(f => ({ ...f, hostname: e.target.value }))} placeholder="app.example.com" />
            <Input label="IP Address" value={form.ip_address} onChange={e => setForm(f => ({ ...f, ip_address: e.target.value }))} placeholder="192.168.1.1" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Port" type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} placeholder="443" />
              <Select label="Protocol" value={form.protocol} onChange={e => setForm(f => ({ ...f, protocol: e.target.value }))} options={["tcp","udp","any"].map(v => ({ value: v, label: v.toUpperCase() }))} />
            </div>
            <Input label="URL" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://app.example.com" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => createMut.mutate(form)} disabled={!form.engagement_id}>Create</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
