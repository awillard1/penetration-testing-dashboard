import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { evidenceApi, engagementsApi, findingsApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Copy, Download, Eye, FileImage, Link2, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import ReactMarkdown from "react-markdown";

type EvidenceListItem = {
  id: string;
  title: string;
  evidence_type: string;
  original_filename?: string;
  sha256?: string;
  file_size?: number;
  mime_type?: string;
  target_id?: string;
  is_sensitive: boolean;
  created_at?: string;
};

type EvidenceDetail = EvidenceListItem & {
  description?: string;
  notes?: string;
  tags?: string;
  engagement_id: string;
  preview_kind: "none" | "image" | "pdf" | "text" | "binary";
  file_exists: boolean;
  inline_url: string;
  download_url: string;
  preview_url: string;
  finding_ids: string[];
  updated_at?: string;
};

export default function EvidencePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [filterEng, setFilterEng] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [previewMode, setPreviewMode] = useState<"pretty" | "raw">("pretty");
  const [previewSearch, setPreviewSearch] = useState("");
  const [form, setForm] = useState({ engagement_id: "", title: "", evidence_type: "screenshot" });
  const [file, setFile] = useState<File | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    evidence_type: "",
    description: "",
    notes: "",
    target_id: "",
    tags: "",
  });
  const [attachFindingId, setAttachFindingId] = useState("");

  const { data: evidence = [], isLoading } = useQuery({
    queryKey: ["evidence", filterEng, query],
    queryFn: () => evidenceApi.list({ ...(filterEng ? { engagement_id: filterEng } : {}), ...(query ? { q: query } : {}) }),
  });
  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });

  const selectedFallback = useMemo(
    () => (evidence as EvidenceListItem[]).find((ev) => ev.id === selectedId) || (evidence as EvidenceListItem[])[0],
    [evidence, selectedId]
  );

  useEffect(() => {
    if (!selectedId && selectedFallback?.id) setSelectedId(selectedFallback.id);
  }, [selectedFallback, selectedId]);

  const { data: detail } = useQuery<EvidenceDetail>({
    queryKey: ["evidence", "detail", selectedId],
    queryFn: () => evidenceApi.detail(selectedId),
    enabled: !!selectedId,
  });

  const { data: preview } = useQuery<{ preview_kind: string; raw?: string; pretty?: string; inline_url?: string; message?: string }>({
    queryKey: ["evidence", "preview", selectedId],
    queryFn: () => evidenceApi.preview(selectedId),
    enabled: !!selectedId && detail?.file_exists,
  });

  const { data: findingOptions = [] } = useQuery({
    queryKey: ["findings", "evidence-association", detail?.engagement_id],
    queryFn: () => findingsApi.list({ engagement_id: detail?.engagement_id }),
    enabled: !!detail?.engagement_id,
  });

  useEffect(() => {
    if (!detail) return;
    setEditForm({
      title: detail.title || "",
      evidence_type: detail.evidence_type || "",
      description: detail.description || "",
      notes: detail.notes || "",
      target_id: detail.target_id || "",
      tags: detail.tags || "",
    });
  }, [detail]);

  const uploadMut = useMutation({
    mutationFn: () => (file ? evidenceApi.upload(form.engagement_id, form.title, form.evidence_type, file) : evidenceApi.create(form)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evidence"] });
      setShowModal(false);
      setFile(null);
      toast.success("Evidence added");
    },
    onError: () => toast.error("Failed to add evidence"),
  });

  const updateMut = useMutation({
    mutationFn: () => evidenceApi.update(selectedId, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evidence"] });
      qc.invalidateQueries({ queryKey: ["evidence", "detail", selectedId] });
      toast.success("Evidence updated");
    },
    onError: () => toast.error("Failed to update evidence"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => evidenceApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evidence"] });
      setShowDeleteModal(false);
      setSelectedId("");
      toast.success("Evidence deleted");
    },
    onError: () => toast.error("Failed to delete evidence"),
  });

  const attachMut = useMutation({
    mutationFn: (findingId: string) => evidenceApi.attachToFinding(selectedId, findingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evidence", "detail", selectedId] });
      toast.success("Associated with finding");
      setAttachFindingId("");
    },
    onError: () => toast.error("Failed to associate finding"),
  });

  const detachMut = useMutation({
    mutationFn: (findingId: string) => evidenceApi.detachFromFinding(selectedId, findingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evidence", "detail", selectedId] });
      toast.success("Association removed");
    },
    onError: () => toast.error("Failed to remove association"),
  });

  const engOpts = [{ value: "", label: "All Engagements" }, ...(engagements as Array<{ id: string; name: string }>).map((e) => ({ value: e.id, label: e.name }))];
  const evTypes = ["screenshot", "http_request", "http_response", "terminal_output", "scan_result", "log", "file", "other"].map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

  const textPreview = previewMode === "raw" ? (preview?.raw || "") : (preview?.pretty || "");
  const filteredPreview = previewSearch
    ? textPreview
        .split("\n")
        .filter((line) => line.toLowerCase().includes(previewSearch.toLowerCase()))
        .join("\n")
    : textPreview;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-white">Evidence</h1>
        <div className="flex gap-2 items-center">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search evidence title" className="w-56" />
          <Select options={engOpts} value={filterEng} onChange={(e) => setFilterEng(e.target.value)} />
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            <Upload size={14} /> Add Evidence
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(340px,420px)_1fr] gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-800">Evidence Items</div>
          <div className="max-h-[70vh] overflow-auto divide-y divide-gray-800">
            {(evidence as EvidenceListItem[]).map((ev) => (
              <button
                key={ev.id}
                onClick={() => setSelectedId(ev.id)}
                className={`w-full text-left px-3 py-2 hover:bg-gray-800/70 ${selectedId === ev.id ? "bg-gray-800" : ""}`}
              >
                <div className="flex items-start gap-2">
                  <FileImage size={14} className="text-brand-400 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate">{ev.title}</div>
                    <div className="text-xs text-gray-400 truncate">{ev.evidence_type} {ev.original_filename ? `· ${ev.original_filename}` : ""}</div>
                    <div className="text-[11px] text-gray-500">{ev.file_size ? `${Math.round(ev.file_size / 1024)} KB` : "Metadata only"}</div>
                  </div>
                  {ev.is_sensitive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900 text-red-300">Sensitive</span>}
                </div>
              </button>
            ))}
            {!isLoading && (evidence as EvidenceListItem[]).length === 0 && <div className="text-center py-10 text-gray-500">No evidence found.</div>}
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          {!detail ? (
            <div className="text-gray-400">Select evidence to view details.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">{detail.title}</h2>
                  <div className="text-xs text-gray-400 mt-1">{detail.evidence_type} {detail.original_filename ? `· ${detail.original_filename}` : ""}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(detail.id).then(() => toast.success("ID copied"))}>
                    <Copy size={14} /> Copy ID
                  </Button>
                  {detail.file_exists && (
                    <>
                      <a href={detail.inline_url} target="_blank" rel="noreferrer"><Button variant="secondary" size="sm"><Eye size={14} /> Open</Button></a>
                      <a href={detail.download_url}><Button variant="secondary" size="sm"><Download size={14} /> Download</Button></a>
                    </>
                  )}
                  <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}><Trash2 size={14} /> Delete</Button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <Input label="Title" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
                <Select label="Type" value={editForm.evidence_type} onChange={(e) => setEditForm((f) => ({ ...f, evidence_type: e.target.value }))} options={evTypes} />
                <Input label="Target ID" value={editForm.target_id} onChange={(e) => setEditForm((f) => ({ ...f, target_id: e.target.value }))} />
                <Input label="Tags" value={editForm.tags} onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} />
              </div>
              <Textarea label="Description" rows={2} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              <Textarea label="Notes" rows={3} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>Save</Button>
              </div>

              <div className="grid md:grid-cols-2 gap-3 text-xs text-gray-400 bg-gray-950 border border-gray-800 rounded p-3">
                <div>SHA-256: <span className="text-gray-200 break-all">{detail.sha256 || "-"}</span></div>
                <div>MIME: <span className="text-gray-200">{detail.mime_type || "-"}</span></div>
                <div>Size: <span className="text-gray-200">{detail.file_size ?? "-"}</span></div>
                <div>Created: <span className="text-gray-200">{detail.created_at ? new Date(detail.created_at).toLocaleString() : "-"}</span></div>
                <div>Updated: <span className="text-gray-200">{detail.updated_at ? new Date(detail.updated_at).toLocaleString() : "-"}</span></div>
                <div>Target: {detail.target_id ? <button className="text-brand-400" onClick={() => navigate(`/targets/${detail.target_id}`)}>{detail.target_id}</button> : <span className="text-gray-200">-</span>}</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-gray-200 font-medium">Finding Associations</div>
                <div className="flex gap-2">
                  <Select
                    value={attachFindingId}
                    onChange={(e) => setAttachFindingId(e.target.value)}
                    options={[
                      { value: "", label: "Select finding" },
                      ...(findingOptions as Array<{ id: string; title: string }>).map((f) => ({ value: f.id, label: f.title })),
                    ]}
                  />
                  <Button variant="secondary" size="sm" onClick={() => attachFindingId && attachMut.mutate(attachFindingId)} disabled={!attachFindingId || attachMut.isPending}>
                    <Link2 size={14} /> Attach
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(detail.finding_ids || []).length === 0 && <span className="text-xs text-gray-500">No linked findings</span>}
                  {(detail.finding_ids || []).map((fid) => (
                    <span key={fid} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-800 text-xs text-gray-200">
                      <button className="text-brand-400" onClick={() => navigate(`/findings/${fid}`)}>{fid.slice(0, 8)}</button>
                      <button className="text-red-400" onClick={() => detachMut.mutate(fid)}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              {detail.file_exists && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-200 font-medium">Preview</div>
                  {(preview?.preview_kind === "text") && (
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <Button variant={previewMode === "pretty" ? "primary" : "secondary"} size="sm" onClick={() => setPreviewMode("pretty")}>Pretty</Button>
                        <Button variant={previewMode === "raw" ? "primary" : "secondary"} size="sm" onClick={() => setPreviewMode("raw")}>Raw</Button>
                        <Input value={previewSearch} onChange={(e) => setPreviewSearch(e.target.value)} placeholder="Search preview" className="w-56" />
                      </div>
                      {detail.mime_type?.includes("markdown") || detail.original_filename?.endsWith(".md") ? (
                        <div className="max-h-80 overflow-auto border border-gray-800 rounded bg-gray-950 p-3 text-sm text-gray-200">
                          {previewMode === "pretty" ? <ReactMarkdown>{filteredPreview}</ReactMarkdown> : <pre className="whitespace-pre-wrap">{filteredPreview}</pre>}
                        </div>
                      ) : (
                        <pre className="max-h-80 overflow-auto border border-gray-800 rounded bg-gray-950 p-3 text-xs text-gray-300 whitespace-pre-wrap">{filteredPreview || "(empty)"}</pre>
                      )}
                    </div>
                  )}
                  {(preview?.preview_kind === "image") && <img src={detail.inline_url} alt={detail.title} className="max-h-96 rounded border border-gray-700" />}
                  {(preview?.preview_kind === "pdf") && <iframe src={detail.inline_url} className="w-full h-96 rounded border border-gray-700" title="PDF preview" />}
                  {(preview?.preview_kind === "binary") && <div className="text-xs text-gray-400">Preview not available for this file type. Use download.</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <Modal title="Add Evidence" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Select label="Engagement *" value={form.engagement_id} onChange={(e) => setForm((f) => ({ ...f, engagement_id: e.target.value }))} options={[{ value: "", label: "Select…" }, ...(engagements as Array<{ id: string; name: string }>).map((e) => ({ value: e.id, label: e.name }))]} />
            <Input label="Title *" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <Select label="Type" value={form.evidence_type} onChange={(e) => setForm((f) => ({ ...f, evidence_type: e.target.value }))} options={evTypes} />
            <div>
              <label className="text-xs text-gray-400 block mb-1">File (optional)</label>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-sm text-gray-300 file:bg-gray-700 file:border-0 file:text-gray-200 file:px-2 file:py-1 file:rounded file:mr-2 file:cursor-pointer" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => uploadMut.mutate()} disabled={!form.title || !form.engagement_id || uploadMut.isPending}>Add</Button>
            </div>
          </div>
        </Modal>
      )}

      {showDeleteModal && detail && (
        <Modal title="Delete Evidence" onClose={() => setShowDeleteModal(false)} width="max-w-md">
          <div className="space-y-4">
            <p className="text-sm text-gray-300">Delete <span className="font-semibold text-white">{detail.title}</span>? This action cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={() => deleteMut.mutate(detail.id)} disabled={deleteMut.isPending}>
                {deleteMut.isPending ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
