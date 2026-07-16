import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commandsApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Plus, Terminal, Copy, Trash2, Pencil } from "lucide-react";
import toast from "react-hot-toast";

const CATEGORIES = ["network","web","active_directory","cloud","wireless","mobile","password_cracking","osint","other"].map(v => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));
const OS_OPTS = ["any","linux","windows","macos"].map(v => ({ value: v, label: v }));

const emptyForm = { name: "", category: "network", command_text: "", description: "", tool: "", operating_system: "any" };

export default function CommandsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState({ category: "", q: "" });
  const [form, setForm] = useState(emptyForm);
  const [varMap, setVarMap] = useState<Record<string, string>>({});
  const [selectedCmd, setSelectedCmd] = useState<string | null>(null);

  const { data: commands = [] } = useQuery({ queryKey: ["commands", filter], queryFn: () => commandsApi.list({ ...(filter.category && { category: filter.category }), ...(filter.q && { q: filter.q }) }) });

  const createMut = useMutation({ mutationFn: (data: typeof form) => commandsApi.create(data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["commands"] }); setShowModal(false); toast.success("Command saved"); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: typeof form }) => commandsApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["commands"] }); setEditingId(null); toast.success("Command updated"); } });
  const deleteMut = useMutation({ mutationFn: (id: string) => commandsApi.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["commands"] }) });
  const useMut = useMutation({ mutationFn: (id: string) => commandsApi.use(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["commands"] }) });

  type Cmd = { id: string; name: string; category: string; command_text: string; description?: string; tool?: string; operating_system: string; usage_count: number; is_favorite: boolean };
  const allCmds = commands as Cmd[];
  const catOpts = [{ value: "", label: "All Categories" }, ...CATEGORIES];

  const resolveVars = (cmd: Cmd) => {
    let text = cmd.command_text;
    Object.entries(varMap).forEach(([k, v]) => { text = text.replaceAll(`{{${k}}}`, v); });
    return text;
  };

  const copyCmd = (cmd: Cmd) => {
    const resolved = resolveVars(cmd);
    navigator.clipboard.writeText(resolved).then(() => toast.success("Copied!"));
    useMut.mutate(cmd.id);
  };

  const openEdit = (cmd: Cmd) => {
    setForm({ name: cmd.name, category: cmd.category, command_text: cmd.command_text, description: cmd.description || "", tool: cmd.tool || "", operating_system: cmd.operating_system });
    setEditingId(cmd.id);
  };

  // Extract variables from command text
  const getVars = (text: string) => [...new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];

  const selected = selectedCmd ? allCmds.find(c => c.id === selectedCmd) : null;
  const vars = selected ? getVars(selected.command_text) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Command Library</h1>
        <div className="flex gap-2">
          <Input placeholder="Search…" value={filter.q} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} className="w-40" />
          <Select options={catOpts} value={filter.category} onChange={e => setFilter(f => ({ ...f, category: e.target.value }))} />
          <Button variant="primary" size="sm" onClick={() => { setForm(emptyForm); setShowModal(true); }}><Plus size={14}/> Add</Button>
        </div>
      </div>

      <div className="grid gap-2">
        {allCmds.map(cmd => (
          <div key={cmd.id} className={`bg-gray-900 border rounded-lg p-3 cursor-pointer transition-colors ${selectedCmd === cmd.id ? "border-brand-500/50" : "border-gray-800 hover:border-gray-700"}`} onClick={() => setSelectedCmd(selectedCmd === cmd.id ? null : cmd.id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-brand-400"/>
                <span className="font-medium text-white text-sm">{cmd.name}</span>
                <span className="text-xs text-gray-500">{cmd.tool}</span>
                <span className="text-xs text-gray-600 bg-gray-800 px-1.5 rounded">{cmd.operating_system}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600">{cmd.usage_count}x</span>
                <button onClick={e => { e.stopPropagation(); copyCmd(cmd); }} className="text-gray-400 hover:text-brand-400 p-1"><Copy size={12}/></button>
                <button onClick={e => { e.stopPropagation(); openEdit(cmd); }} className="text-gray-500 hover:text-brand-400 p-1"><Pencil size={12}/></button>
                <button onClick={e => { e.stopPropagation(); deleteMut.mutate(cmd.id); }} className="text-gray-500 hover:text-red-400 p-1"><Trash2 size={12}/></button>
              </div>
            </div>
            {selectedCmd === cmd.id && (
              <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
                {vars.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {vars.map(v => (
                      <Input key={v} label={`{{${v}}}`} value={varMap[v] || ""} onChange={e => setVarMap(m => ({ ...m, [v]: e.target.value }))} placeholder={v} />
                    ))}
                  </div>
                )}
                <code className="block bg-gray-950 text-green-300 text-xs p-3 rounded font-mono whitespace-pre-wrap break-all">{resolveVars(cmd)}</code>
                <Button variant="primary" size="sm" onClick={() => copyCmd(cmd)}><Copy size={12}/> Copy Command</Button>
              </div>
            )}
          </div>
        ))}
        {allCmds.length === 0 && <div className="text-center py-8 text-gray-500">No commands yet.</div>}
      </div>

      {showModal && (
        <Modal title="Add Command" onClose={() => setShowModal(false)} width="max-w-2xl">
          <div className="space-y-3">
            <Input label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} options={CATEGORIES} />
              <Select label="OS" value={form.operating_system} onChange={e => setForm(f => ({ ...f, operating_system: e.target.value }))} options={OS_OPTS} />
            </div>
            <Input label="Tool" value={form.tool} onChange={e => setForm(f => ({ ...f, tool: e.target.value }))} placeholder="nmap, ffuf, etc." />
            <Textarea label="Command *  (use {{variable}} for substitutions)" value={form.command_text} onChange={e => setForm(f => ({ ...f, command_text: e.target.value }))} rows={4} className="font-mono" />
            <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => createMut.mutate(form)} disabled={!form.name || !form.command_text}>Save</Button>
            </div>
          </div>
        </Modal>
      )}

      {editingId && (
        <Modal title="Edit Command" onClose={() => setEditingId(null)} width="max-w-2xl">
          <div className="space-y-3">
            <Input label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} options={CATEGORIES} />
              <Select label="OS" value={form.operating_system} onChange={e => setForm(f => ({ ...f, operating_system: e.target.value }))} options={OS_OPTS} />
            </div>
            <Input label="Tool" value={form.tool} onChange={e => setForm(f => ({ ...f, tool: e.target.value }))} placeholder="nmap, ffuf, etc." />
            <Textarea label="Command *  (use {{variable}} for substitutions)" value={form.command_text} onChange={e => setForm(f => ({ ...f, command_text: e.target.value }))} rows={4} className="font-mono" />
            <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => updateMut.mutate({ id: editingId, data: form })} disabled={!form.name || !form.command_text}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
