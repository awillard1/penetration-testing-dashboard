import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { credentialsApi, engagementsApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select } from "../components/ui/Input";
import { Plus, Eye, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { canRevealSecrets } from "../lib/capabilities";
import { useAuth } from "../useAuth";

export default function CredentialsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filterEng, setFilterEng] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ engagement_id: "", username: "", domain: "", secret_type: "password", plaintext_secret: "", source: "", privilege_level: "" });

  const { data: creds = [] } = useQuery({ queryKey: ["credentials", filterEng], queryFn: () => credentialsApi.list(filterEng ? { engagement_id: filterEng } : {}) });
  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => credentialsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["credentials"] }); setShowModal(false); toast.success("Credential added"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => credentialsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["credentials"] }); toast.success("Deleted"); },
  });
  const revealSecret = async (id: string) => {
    const { secret } = await credentialsApi.reveal(id);
    setRevealed(r => ({ ...r, [id]: secret || "(empty)" }));
  };
  const mayRevealSecrets = canRevealSecrets(user);

  const secretTypes = ["password","api_key","token","ntlm_hash","ssh_key","cookie","certificate","connection_string","other"].map(v => ({ value: v, label: v.replace(/_/g, " ") }));
  const engOpts = [{ value: "", label: "All Engagements" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Credentials</h1>
        <div className="flex gap-2">
          <Select options={engOpts} value={filterEng} onChange={e => setFilterEng(e.target.value)} />
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}><Plus size={14}/> Add Credential</Button>
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-xs text-gray-400">{["Username","Domain","Type","Source","Privilege","Secret",""].map(h => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {(creds as Array<{ id: string; username?: string; domain?: string; secret_type: string; source?: string; privilege_level?: string }>).map(c => (
              <tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-3 py-2 text-brand-400">{c.username || "—"}</td>
                <td className="px-3 py-2 text-gray-300">{c.domain || "—"}</td>
                <td className="px-3 py-2 text-gray-400">{c.secret_type}</td>
                <td className="px-3 py-2 text-gray-400">{c.source || "—"}</td>
                <td className="px-3 py-2 text-gray-400">{c.privilege_level || "—"}</td>
                <td className="px-3 py-2">
                  {revealed[c.id] ? (
                    <span className="text-green-300 text-xs font-mono">{revealed[c.id]}</span>
                  ) : !mayRevealSecrets ? (
                    <span className="text-xs text-gray-500">Restricted</span>
                  ) : (
                    <button onClick={() => revealSecret(c.id)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-400"><Eye size={12}/> Reveal</button>
                  )}
                </td>
                <td className="px-3 py-2"><button onClick={() => deleteMut.mutate(c.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={13}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {(creds as Array<unknown>).length === 0 && <div className="text-center py-8 text-gray-500">No credentials yet.</div>}
      </div>
      {showModal && (
        <Modal title="Add Credential" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Select label="Engagement *" value={form.engagement_id} onChange={e => setForm(f => ({ ...f, engagement_id: e.target.value }))} options={[{ value: "", label: "Select…" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))]} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
              <Input label="Domain" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} />
            </div>
            <Select label="Type" value={form.secret_type} onChange={e => setForm(f => ({ ...f, secret_type: e.target.value }))} options={secretTypes} />
            <Input label="Secret Value" type="password" value={form.plaintext_secret} onChange={e => setForm(f => ({ ...f, plaintext_secret: e.target.value }))} placeholder="Stored encrypted at rest" />
            <Input label="Source" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="e.g. LDAP dump" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => createMut.mutate(form)} disabled={!form.engagement_id}>Add</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
