import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { engagementsApi } from "../api/client";
import Button from "../components/ui/Button";
import { StatusBadge } from "../components/ui/Badge";
import Modal from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Plus, ChevronRight, Calendar } from "lucide-react";
import toast from "react-hot-toast";

const ENG_TYPES = [
  "web_application","api","internal_network","external_network","wireless","cloud",
  "mobile","social_engineering","physical","red_team","purple_team","configuration_review",
  "vulnerability_assessment","source_code_review","other"
].map(v => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));

const STATUSES = ["draft","planning","active","paused","awaiting_client","reporting","retesting","complete","archived"]
  .map(v => ({ value: v, label: v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) }));

export default function EngagementsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", engagement_type: "web_application", status: "draft", description: "" });

  const { data: engagements = [] } = useQuery({ queryKey: ["engagements"], queryFn: () => engagementsApi.list() });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => engagementsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["engagements"] }); setShowModal(false); toast.success("Engagement created"); },
    onError: () => toast.error("Failed to create engagement"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Engagements</h1>
        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Engagement
        </Button>
      </div>

      <div className="grid gap-3">
        {(engagements as Array<{ id: string; name: string; status: string; engagement_type: string; start_date?: string; end_date?: string; client_id?: string }>).map((eng) => (
          <div
            key={eng.id}
            className="bg-gray-900 border border-gray-800 rounded-lg p-4 cursor-pointer hover:border-brand-500/50 transition-colors"
            onClick={() => navigate(`/engagements/${eng.id}`)}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-medium text-white">{eng.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={eng.status} />
                  <span className="text-xs text-gray-500">{eng.engagement_type?.replace(/_/g, " ")}</span>
                  {eng.start_date && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Calendar size={10} /> {eng.start_date} → {eng.end_date || "TBD"}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-500" />
            </div>
          </div>
        ))}
        {(engagements as Array<unknown>).length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No engagements yet. Create one to get started.
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="New Engagement" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <Input label="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ACME Corp Web Pentest" />
            <Select label="Type" value={form.engagement_type} onChange={e => setForm(f => ({ ...f, engagement_type: e.target.value }))} options={ENG_TYPES} />
            <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} options={STATUSES} />
            <Textarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => createMut.mutate(form)} disabled={!form.name}>Create</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
