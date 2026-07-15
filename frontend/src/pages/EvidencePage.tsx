import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { evidenceApi, engagementsApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select } from "../components/ui/Input";
import { Upload, FileImage, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

export default function EvidencePage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filterEng, setFilterEng] = useState("");
  const [form, setForm] = useState({ engagement_id: "", title: "", evidence_type: "screenshot" });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: evidence = [] } = useQuery({ queryKey: ["evidence", filterEng], queryFn: () => evidenceApi.list(filterEng ? { engagement_id: filterEng } : {}) });
  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });

  const uploadMut = useMutation({
    mutationFn: () => file ? evidenceApi.upload(form.engagement_id, form.title, form.evidence_type, file) : evidenceApi.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["evidence"] }); setShowModal(false); setFile(null); toast.success("Evidence added"); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => evidenceApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["evidence"] }); toast.success("Deleted"); },
  });

  const engOpts = [{ value: "", label: "All Engagements" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))];
  const evTypes = ["screenshot","http_request","http_response","terminal_output","scan_result","log","file","other"].map(v => ({ value: v, label: v.replace(/_/g, " ") }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Evidence</h1>
        <div className="flex gap-2">
          <Select options={engOpts} value={filterEng} onChange={e => setFilterEng(e.target.value)} />
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}><Upload size={14} /> Add Evidence</Button>
        </div>
      </div>
      <div className="grid gap-2">
        {(evidence as Array<{ id: string; title: string; evidence_type: string; original_filename?: string; sha256?: string; file_size?: number; is_sensitive: boolean }>).map(ev => (
          <div key={ev.id} className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex items-center gap-3">
            <FileImage size={16} className="text-brand-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white truncate">{ev.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{ev.evidence_type} {ev.original_filename && `· ${ev.original_filename}`} {ev.sha256 && `· SHA256: ${ev.sha256.slice(0,12)}…`}</div>
            </div>
            {ev.is_sensitive && <span className="text-xs text-red-300 bg-red-900 px-1.5 py-0.5 rounded">Sensitive</span>}
            <button onClick={() => deleteMut.mutate(ev.id)} className="text-gray-500 hover:text-red-400"><Trash2 size={13}/></button>
          </div>
        ))}
        {(evidence as Array<unknown>).length === 0 && <div className="text-center py-8 text-gray-500">No evidence yet.</div>}
      </div>
      {showModal && (
        <Modal title="Add Evidence" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Select label="Engagement *" value={form.engagement_id} onChange={e => setForm(f => ({ ...f, engagement_id: e.target.value }))} options={[{ value: "", label: "Select…" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))]} />
            <Input label="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <Select label="Type" value={form.evidence_type} onChange={e => setForm(f => ({ ...f, evidence_type: e.target.value }))} options={evTypes} />
            <div>
              <label className="text-xs text-gray-400 block mb-1">File (optional)</label>
              <input ref={fileRef} type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="text-sm text-gray-300 file:bg-gray-700 file:border-0 file:text-gray-200 file:px-2 file:py-1 file:rounded file:mr-2 file:cursor-pointer" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => uploadMut.mutate()} disabled={!form.title || !form.engagement_id}>Add</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
