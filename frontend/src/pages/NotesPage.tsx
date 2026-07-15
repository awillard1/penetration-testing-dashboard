import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notesApi, engagementsApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Plus, FileText, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

const NOTE_TYPES = ["general","daily","web_app","api","network","retest","meeting","methodology"].map(v => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));

export default function NotesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filterEng, setFilterEng] = useState("");
  const [editContent, setEditContent] = useState("");
  const [form, setForm] = useState({ engagement_id: "", title: "", note_type: "general", content: "" });

  const { data: notes = [] } = useQuery({ queryKey: ["notes", filterEng], queryFn: () => notesApi.list(filterEng ? { engagement_id: filterEng } : {}) });
  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });
  const { data: note } = useQuery({ queryKey: ["note", selected], queryFn: () => notesApi.get(selected!), enabled: !!selected });

  const createMut = useMutation({ mutationFn: (data: typeof form) => notesApi.create(data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); setShowModal(false); toast.success("Note created"); } });
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: Record<string, string> }) => notesApi.update(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); qc.invalidateQueries({ queryKey: ["note", selected] }); toast.success("Saved"); } });
  const deleteMut = useMutation({ mutationFn: (id: string) => notesApi.remove(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["notes"] }); setSelected(null); toast.success("Deleted"); } });

  const engOpts = [{ value: "", label: "All" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))];
  type Note = { id: string; title: string; note_type: string; updated_at: string; content?: string };
  const allNotes = notes as Note[];

  const selectNote = (id: string) => { setSelected(id); const n = allNotes.find(n => n.id === id); setEditContent(n?.content || ""); };

  return (
    <div className="flex h-full gap-4" style={{ minHeight: "60vh" }}>
      <div className="w-64 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-bold text-white">Notes</h1>
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}><Plus size={12}/></Button>
        </div>
        <Select options={engOpts} value={filterEng} onChange={e => setFilterEng(e.target.value)} />
        <div className="space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto">
          {allNotes.map(n => (
            <button key={n.id} onClick={() => selectNote(n.id)} className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${selected === n.id ? "bg-brand-500/20 text-brand-400" : "text-gray-300 hover:bg-gray-800"}`}>
              <div className="font-medium truncate">{n.title}</div>
              <div className="text-xs text-gray-500">{n.note_type}</div>
            </button>
          ))}
          {allNotes.length === 0 && <div className="text-xs text-gray-500 text-center py-4">No notes</div>}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        {note ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white">{note.title}</h2>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={() => updateMut.mutate({ id: selected!, data: { content: editContent } })}>Save</Button>
                <Button variant="danger" size="sm" onClick={() => deleteMut.mutate(selected!)}><Trash2 size={12}/></Button>
              </div>
            </div>
            <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="flex-1 font-mono text-xs" style={{ minHeight: "400px", resize: "vertical" }} />
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500"><FileText size={32}/><span className="ml-2">Select a note to edit</span></div>
        )}
      </div>
      {showModal && (
        <Modal title="New Note" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Select label="Engagement" value={form.engagement_id} onChange={e => setForm(f => ({ ...f, engagement_id: e.target.value }))} options={[{ value: "", label: "None" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))]} />
            <Input label="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Select label="Type" value={form.note_type} onChange={e => setForm(f => ({ ...f, note_type: e.target.value }))} options={NOTE_TYPES} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => createMut.mutate(form)} disabled={!form.title}>Create</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
