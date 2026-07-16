import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi, engagementsApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import { StatusBadge } from "../components/ui/Badge";
import { Plus, CheckSquare, Trash2, Pencil } from "lucide-react";
import toast from "react-hot-toast";

const STATUSES = ["backlog","ready","in_progress","blocked","awaiting_client","review","complete","cancelled"].map(v => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));
const PRIORITIES = ["low","normal","high","urgent"].map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));

const STATUS_COL_KEYS = ["backlog","ready","in_progress","blocked","complete"];

const emptyForm = { engagement_id: "", title: "", status: "backlog", priority: "normal", description: "", assigned_user: "" };

export default function TasksPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterEng, setFilterEng] = useState("");
  const [view, setView] = useState<"list"|"kanban">("list");
  const [form, setForm] = useState(emptyForm);

  const { data: tasks = [] } = useQuery({ queryKey: ["tasks", filterEng], queryFn: () => tasksApi.list(filterEng ? { engagement_id: filterEng } : {}) });
  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => tasksApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setShowModal(false); toast.success("Task created"); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => tasksApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); setEditingId(null); toast.success("Task updated"); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Deleted"); },
  });

  type Task = { id: string; title: string; status: string; priority: string; assigned_user?: string; due_date?: string; engagement_id: string; description?: string };
  const engOpts = [{ value: "", label: "All Engagements" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))];
  const allTasks = tasks as Task[];

  const openEdit = (t: Task) => {
    setForm({ engagement_id: t.engagement_id, title: t.title, status: t.status, priority: t.priority, description: t.description || "", assigned_user: t.assigned_user || "" });
    setEditingId(t.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Tasks</h1>
        <div className="flex gap-2">
          <Select options={engOpts} value={filterEng} onChange={e => setFilterEng(e.target.value)} />
          <Button variant={view==="list" ? "primary" : "secondary"} size="sm" onClick={() => setView("list")}>List</Button>
          <Button variant={view==="kanban" ? "primary" : "secondary"} size="sm" onClick={() => setView("kanban")}>Kanban</Button>
          <Button variant="primary" size="sm" onClick={() => { setForm(emptyForm); setShowModal(true); }}><Plus size={14}/> Add Task</Button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="grid grid-cols-5 gap-3 overflow-x-auto pb-2">
          {STATUS_COL_KEYS.map(col => (
            <div key={col} className="bg-gray-900 border border-gray-800 rounded-lg p-3 min-w-[180px]">
              <div className="text-xs text-gray-400 uppercase mb-3 font-semibold">{col.replace(/_/g," ")}</div>
              <div className="space-y-2">
                {allTasks.filter(t => t.status === col).map(t => (
                  <div key={t.id} className="bg-gray-800 rounded p-2 text-xs text-gray-300">
                    <div className="font-medium mb-1">{t.title}</div>
                    <div className="flex gap-1 flex-wrap">
                      {["backlog","ready","in_progress","complete"].map(s => (
                        <button key={s} onClick={() => updateMut.mutate({ id: t.id, data: { status: s } })}
                          className={`text-[10px] px-1 rounded ${t.status===s ? "bg-brand-500 text-black" : "bg-gray-700 text-gray-400"}`}>
                          {s.slice(0,3)}
                        </button>
                      ))}
                      <button onClick={() => openEdit(t)} className="text-gray-500 hover:text-brand-400 ml-auto"><Pencil size={10}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-800 text-xs text-gray-400">{["Title","Status","Priority","Assigned","Due",""].map(h => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
            <tbody>
              {allTasks.map(t => (
                <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-3 py-2 text-white flex items-center gap-2"><CheckSquare size={13} className="text-brand-400"/>{t.title}</td>
                  <td className="px-3 py-2"><StatusBadge status={t.status}/></td>
                  <td className="px-3 py-2"><span className={`text-xs px-1.5 py-0.5 rounded ${t.priority==="urgent"?"bg-red-900 text-red-300":t.priority==="high"?"bg-orange-900 text-orange-300":"bg-gray-800 text-gray-300"}`}>{t.priority}</span></td>
                  <td className="px-3 py-2 text-gray-400">{t.assigned_user || "—"}</td>
                  <td className="px-3 py-2 text-gray-400">{t.due_date || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => openEdit(t)} className="text-gray-500 hover:text-brand-400"><Pencil size={13}/></button>
                      <button onClick={() => deleteMut.mutate(t.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={13}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {allTasks.length === 0 && <div className="text-center py-8 text-gray-500">No tasks yet.</div>}
        </div>
      )}

      {showModal && (
        <Modal title="New Task" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Select label="Engagement *" value={form.engagement_id} onChange={e => setForm(f => ({ ...f, engagement_id: e.target.value }))} options={[{ value: "", label: "Select…" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))]} />
            <Input label="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={STATUSES} />
              <Select label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} options={PRIORITIES} />
            </div>
            <Input label="Assigned To" value={form.assigned_user} onChange={e => setForm(f => ({ ...f, assigned_user: e.target.value }))} />
            <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => createMut.mutate(form)} disabled={!form.title || !form.engagement_id}>Create</Button>
            </div>
          </div>
        </Modal>
      )}

      {editingId && (
        <Modal title="Edit Task" onClose={() => setEditingId(null)}>
          <div className="space-y-3">
            <Select label="Engagement *" value={form.engagement_id} onChange={e => setForm(f => ({ ...f, engagement_id: e.target.value }))} options={[{ value: "", label: "Select…" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))]} />
            <Input label="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={STATUSES} />
              <Select label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} options={PRIORITIES} />
            </div>
            <Input label="Assigned To" value={form.assigned_user} onChange={e => setForm(f => ({ ...f, assigned_user: e.target.value }))} />
            <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => updateMut.mutate({ id: editingId, data: form })} disabled={!form.title || !form.engagement_id}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
