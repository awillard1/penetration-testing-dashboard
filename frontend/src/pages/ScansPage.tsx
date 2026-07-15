import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scansApi, engagementsApi } from "../api/client";
import Button from "../components/ui/Button";
import { Select } from "../components/ui/Input";
import { Upload, ScanLine, CheckCircle, XCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const SCAN_TYPES = ["auto","nmap","nessus","nuclei","ffuf","burp","generic_json"].map(v => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));

export default function ScansPage() {
  const qc = useQueryClient();
  const [filterEng, setFilterEng] = useState("");
  const [form, setForm] = useState({ engagement_id: "", scan_type: "auto" });
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: scans = [] } = useQuery({ queryKey: ["scans", filterEng], queryFn: () => scansApi.list(filterEng ? { engagement_id: filterEng } : {}) });
  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });

  const uploadMut = useMutation({
    mutationFn: () => {
      if (!file || !form.engagement_id) throw new Error("Missing file or engagement");
      return scansApi.upload(form.engagement_id, form.scan_type, file);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scans"] }); setFile(null); if (fileRef.current) fileRef.current.value = ""; toast.success("Scan uploaded and imported"); },
    onError: (e: Error) => toast.error(e.message),
  });

  type ScanRecord = { id: string; original_filename: string; scan_type: string; status: string; findings_count?: number; targets_count?: number; created_at: string; errors?: string };
  const allScans = scans as ScanRecord[];
  const engOpts = [{ value: "", label: "All Engagements" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))];
  const engCreateOpts = [{ value: "", label: "Select Engagement…" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))];

  const statusIcon = (s: string) => {
    if (s === "completed") return <CheckCircle size={14} className="text-green-400"/>;
    if (s === "failed") return <XCircle size={14} className="text-red-400"/>;
    return <Loader2 size={14} className="text-yellow-400 animate-spin"/>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Scan Imports</h1>
        <Select options={engOpts} value={filterEng} onChange={e => setFilterEng(e.target.value)} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Upload size={14}/> Upload Scan File</h2>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Engagement *" value={form.engagement_id} onChange={e => setForm(f => ({ ...f, engagement_id: e.target.value }))} options={engCreateOpts} />
          <Select label="Scan Type" value={form.scan_type} onChange={e => setForm(f => ({ ...f, scan_type: e.target.value }))} options={SCAN_TYPES} />
        </div>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="text-sm text-gray-300 file:bg-gray-700 file:border-0 file:text-gray-200 file:px-2 file:py-1 file:rounded file:mr-2 file:cursor-pointer flex-1" />
          <Button variant="primary" size="sm" onClick={() => uploadMut.mutate()} disabled={!file || !form.engagement_id || uploadMut.isPending}>
            {uploadMut.isPending ? <Loader2 size={13} className="animate-spin"/> : <Upload size={13}/>} Upload
          </Button>
        </div>
        <p className="text-xs text-gray-500">Supported: Nmap XML, Nessus .nessus, Nuclei JSONL, ffuf JSON, Burp XML. Use "auto" to detect format automatically.</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-xs text-gray-400">{["File","Type","Status","Targets","Findings","Date"].map(h => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {allScans.map(s => (
              <tr key={s.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-3 py-2 text-white flex items-center gap-2"><ScanLine size={13} className="text-brand-400"/>{s.original_filename}</td>
                <td className="px-3 py-2 text-gray-400">{s.scan_type}</td>
                <td className="px-3 py-2"><div className="flex items-center gap-1">{statusIcon(s.status)}<span className="text-xs text-gray-300">{s.status}</span></div></td>
                <td className="px-3 py-2 text-gray-400">{s.targets_count ?? "—"}</td>
                <td className="px-3 py-2 text-gray-400">{s.findings_count ?? "—"}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {allScans.length === 0 && <div className="text-center py-8 text-gray-500">No scans imported yet.</div>}
      </div>
    </div>
  );
}
