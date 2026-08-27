import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scansApi, engagementsApi } from "../api/client";
import Button from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Input";
import Modal from "../components/ui/Modal";
import { Upload, ScanLine, CheckCircle, XCircle, Loader2, Eye, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

type ScanRecord = {
  id: string;
  filename: string;
  scan_type: string;
  status: string;
  imported_findings?: number;
  imported_targets?: number;
  error_count?: number;
  created_at: string;
};

type ScanDetail = ScanRecord & {
  engagement_id: string;
  sha256?: string;
  notes?: string;
  error_log?: string;
  imported_at?: string;
  updated_at?: string;
  results: Array<{
    id: string;
    result_type: string;
    title?: string;
    severity?: string;
    target_id?: string;
    finding_id?: string;
    is_duplicate: boolean;
    data_json?: string;
    created_at?: string;
  }>;
};

const SCAN_TYPES = ["auto", "nmap", "nessus", "nuclei", "ffuf", "burp", "generic_json"].map((v) => ({
  value: v,
  label: v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
}));

export default function ScansPage() {
  const qc = useQueryClient();
  const [filterEng, setFilterEng] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [form, setForm] = useState({ engagement_id: "", scan_type: "auto" });
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: scans = [] } = useQuery({
    queryKey: ["scans", filterEng],
    queryFn: () => scansApi.list(filterEng ? { engagement_id: filterEng } : {}),
  });
  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });

  const { data: selectedScan } = useQuery<ScanDetail>({
    queryKey: ["scan", "detail", selectedId],
    queryFn: () => scansApi.detail(selectedId),
    enabled: !!selectedId,
  });

  useEffect(() => {
    setNotes(selectedScan?.notes || "");
  }, [selectedScan?.id, selectedScan?.notes]);

  const uploadMut = useMutation({
    mutationFn: () => {
      if (!file || !form.engagement_id) throw new Error("Missing file or engagement");
      return scansApi.upload(form.engagement_id, file);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scans"] });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Scan uploaded and imported");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => scansApi.update(selectedId, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scan", "detail", selectedId] });
      qc.invalidateQueries({ queryKey: ["scans"] });
      toast.success("Scan notes updated");
    },
    onError: () => toast.error("Failed to update scan"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => scansApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scans"] });
      setSelectedId("");
      setShowDeleteModal(false);
      toast.success("Scan deleted");
    },
    onError: () => toast.error("Failed to delete scan"),
  });

  const engOpts = [{ value: "", label: "All Engagements" }, ...(engagements as Array<{ id: string; name: string }>).map((e) => ({ value: e.id, label: e.name }))];
  const engCreateOpts = [{ value: "", label: "Select Engagement…" }, ...(engagements as Array<{ id: string; name: string }>).map((e) => ({ value: e.id, label: e.name }))];

  const statusIcon = (s: string) => {
    if (s === "completed") return <CheckCircle size={14} className="text-green-400" />;
    if (s === "failed") return <XCircle size={14} className="text-red-400" />;
    return <Loader2 size={14} className="text-yellow-400 animate-spin" />;
  };

  const allScans = (scans as ScanRecord[]).filter((s) => {
    if (!query) return true;
    return `${s.filename} ${s.scan_type} ${s.status}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Scan Imports</h1>
        <div className="flex gap-2 items-center">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search scans" className="w-56" />
          <Select options={engOpts} value={filterEng} onChange={(e) => setFilterEng(e.target.value)} />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Upload size={14} /> Upload Scan File</h2>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Engagement *" value={form.engagement_id} onChange={(e) => setForm((f) => ({ ...f, engagement_id: e.target.value }))} options={engCreateOpts} />
          <Select label="Scan Type" value={form.scan_type} onChange={(e) => setForm((f) => ({ ...f, scan_type: e.target.value }))} options={SCAN_TYPES} />
        </div>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-gray-300 file:bg-gray-700 file:border-0 file:text-gray-200 file:px-2 file:py-1 file:rounded file:mr-2 file:cursor-pointer flex-1" />
          <Button variant="primary" size="sm" onClick={() => uploadMut.mutate()} disabled={!file || !form.engagement_id || uploadMut.isPending}>
            {uploadMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload
          </Button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-xs text-gray-400">
              {["File", "Type", "Status", "Targets", "Findings", "Errors", "Date", ""].map((h) => (
                <th key={h} className="text-left px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allScans.map((s) => (
              <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer" onClick={() => { setSelectedId(s.id); setNotes(""); }}>
                <td className="px-3 py-2 text-white flex items-center gap-2"><ScanLine size={13} className="text-brand-400" />{s.filename}</td>
                <td className="px-3 py-2 text-gray-400">{s.scan_type}</td>
                <td className="px-3 py-2"><div className="flex items-center gap-1">{statusIcon(s.status)}<span className="text-xs text-gray-300">{s.status}</span></div></td>
                <td className="px-3 py-2 text-gray-400">{s.imported_targets ?? "—"}</td>
                <td className="px-3 py-2 text-gray-400">{s.imported_findings ?? "—"}</td>
                <td className="px-3 py-2 text-gray-400">{s.error_count ?? 0}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(s.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2"><Eye size={13} className="text-gray-500" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {allScans.length === 0 && <div className="text-center py-8 text-gray-500">No scans imported yet.</div>}
      </div>

      {selectedScan && (
        <Modal title={`Scan Detail · ${selectedScan.filename}`} onClose={() => setSelectedId("")} width="max-w-4xl">
          <div className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3 text-xs text-gray-400">
              <div>Status: <span className="text-gray-200">{selectedScan.status}</span></div>
              <div>Type: <span className="text-gray-200">{selectedScan.scan_type}</span></div>
              <div>SHA-256: <span className="text-gray-200 break-all">{selectedScan.sha256 || "—"}</span></div>
              <div>Targets Imported: <span className="text-gray-200">{selectedScan.imported_targets ?? 0}</span></div>
              <div>Findings Imported: <span className="text-gray-200">{selectedScan.imported_findings ?? 0}</span></div>
              <div>Errors: <span className="text-gray-200">{selectedScan.error_count ?? 0}</span></div>
            </div>

            <Textarea
              label="Operator Notes"
              value={notes || selectedScan.notes || ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
            <div className="flex justify-between">
              <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}><Trash2 size={13} /> Delete Scan</Button>
              <Button variant="primary" size="sm" onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>Save Notes</Button>
            </div>

            {selectedScan.error_log && (
              <div>
                <div className="text-xs text-red-300 mb-1">Import Error Log</div>
                <pre className="max-h-40 overflow-auto text-xs bg-gray-950 border border-gray-800 rounded p-2 text-red-200 whitespace-pre-wrap">{selectedScan.error_log}</pre>
              </div>
            )}

            <div>
              <div className="text-xs text-gray-400 mb-1">Parsed Results ({selectedScan.results.length})</div>
              <div className="max-h-64 overflow-auto border border-gray-800 rounded">
                <table className="w-full text-xs">
                  <thead className="border-b border-gray-800 text-gray-400">
                    <tr>
                      <th className="text-left px-2 py-1">Type</th>
                      <th className="text-left px-2 py-1">Title</th>
                      <th className="text-left px-2 py-1">Severity</th>
                      <th className="text-left px-2 py-1">Target</th>
                      <th className="text-left px-2 py-1">Finding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedScan.results.map((r) => (
                      <tr key={r.id} className="border-b border-gray-800/40">
                        <td className="px-2 py-1 text-gray-300">{r.result_type}</td>
                        <td className="px-2 py-1 text-gray-300">{r.title || "—"}</td>
                        <td className="px-2 py-1 text-gray-300">{r.severity || "—"}</td>
                        <td className="px-2 py-1 text-gray-400">{r.target_id || "—"}</td>
                        <td className="px-2 py-1 text-gray-400">{r.finding_id || "—"}</td>
                      </tr>
                    ))}
                    {selectedScan.results.length === 0 && (
                      <tr><td className="px-2 py-2 text-gray-500" colSpan={5}>No parsed scan results stored for this import.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showDeleteModal && selectedScan && (
        <Modal title="Delete Scan" onClose={() => setShowDeleteModal(false)} width="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-gray-300">Delete scan <span className="font-semibold text-white">{selectedScan.filename}</span>? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => deleteMut.mutate(selectedScan.id)} disabled={deleteMut.isPending}>Delete</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
