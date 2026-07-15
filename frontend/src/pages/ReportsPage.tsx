import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reportsApi, engagementsApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Plus, FileDown, FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const FORMATS = ["html","markdown","json","docx"].map(v => ({ value: v, label: v.toUpperCase() }));
const STYLES = ["standard","executive","technical"].map(v => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));

export default function ReportsPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [filterEng, setFilterEng] = useState("");
  const [form, setForm] = useState({ engagement_id: "", title: "", format: "html", style: "standard", executive_summary: "" });

  const { data: reports = [] } = useQuery({ queryKey: ["reports", filterEng], queryFn: () => reportsApi.list(filterEng ? { engagement_id: filterEng } : {}) });
  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => reportsApi.generate(data.engagement_id, { format: data.format, style: data.style, title: data.title, executive_summary: data.executive_summary }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reports"] }); setShowModal(false); toast.success("Report generated"); },
    onError: () => toast.error("Report generation failed"),
  });

  type Report = { id: string; title: string; format: string; status: string; file_size?: number; created_at: string; engagement_id: string };
  const allReports = reports as Report[];
  const engOpts = [{ value: "", label: "All" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))];
  const engCreateOpts = [{ value: "", label: "Select…" }, ...(engagements as Array<{ id: string; name: string }>).map(e => ({ value: e.id, label: e.name }))];

  const downloadReport = (r: Report) => {
    const a = document.createElement("a");
    a.href = `/api/reports/${r.id}/download`;
    a.download = `${r.title}.${r.format}`;
    a.click();
  };

  const formatBytes = (b?: number) => b ? (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(1)} KB`) : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Reports</h1>
        <div className="flex gap-2">
          <Select options={engOpts} value={filterEng} onChange={e => setFilterEng(e.target.value)} />
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}><Plus size={14}/> Generate Report</Button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-800 text-xs text-gray-400">{["Title","Format","Status","Size","Date",""].map(h => <th key={h} className="text-left px-3 py-2">{h}</th>)}</tr></thead>
          <tbody>
            {allReports.map(r => (
              <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-3 py-2 text-white flex items-center gap-2"><FileText size={13} className="text-brand-400"/>{r.title}</td>
                <td className="px-3 py-2"><span className="text-xs bg-brand-900/40 text-brand-400 px-1.5 py-0.5 rounded">{r.format.toUpperCase()}</span></td>
                <td className="px-3 py-2">
                  {r.status === "ready" ? <span className="text-green-400 text-xs">✓ Ready</span> :
                   r.status === "generating" ? <span className="text-yellow-400 text-xs flex items-center gap-1"><Loader2 size={11} className="animate-spin"/>Generating</span> :
                   <span className="text-red-400 text-xs">Failed</span>}
                </td>
                <td className="px-3 py-2 text-gray-400">{formatBytes(r.file_size)}</td>
                <td className="px-3 py-2 text-gray-500">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  {r.status === "ready" && <button onClick={() => downloadReport(r)} className="text-brand-400 hover:text-brand-300 flex items-center gap-1 text-xs"><FileDown size={12}/> Download</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {allReports.length === 0 && <div className="text-center py-8 text-gray-500">No reports yet.</div>}
      </div>

      {showModal && (
        <Modal title="Generate Report" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Select label="Engagement *" value={form.engagement_id} onChange={e => setForm(f => ({ ...f, engagement_id: e.target.value }))} options={engCreateOpts} />
            <Input label="Report Title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Penetration Test Report" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Format" value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))} options={FORMATS} />
              <Select label="Style" value={form.style} onChange={e => setForm(f => ({ ...f, style: e.target.value }))} options={STYLES} />
            </div>
            <Textarea label="Executive Summary (optional)" value={form.executive_summary} onChange={e => setForm(f => ({ ...f, executive_summary: e.target.value }))} rows={3} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => createMut.mutate(form)} disabled={!form.engagement_id || createMut.isPending}>
                {createMut.isPending ? <Loader2 size={12} className="animate-spin"/> : null} Generate
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
