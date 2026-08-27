import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { runnersApi } from "../../api/client";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import { Input } from "../ui/Input";
import { Plus } from "lucide-react";

type Runner = {
  id: string;
  name: string;
  hostname?: string;
  platform?: string;
  architecture?: string;
  is_enabled: boolean;
  is_online: boolean;
  last_heartbeat?: string;
  tools?: Array<{ name?: string; version?: string; status?: string }>;
};

export default function RunnersPanel() {
  const qc = useQueryClient();
  const [showRunnerModal, setShowRunnerModal] = useState(false);
  const [runnerForm, setRunnerForm] = useState({ name: "", hostname: "", platform: "", architecture: "" });
  const [newRunnerToken, setNewRunnerToken] = useState<{ id: string; token: string } | null>(null);

  const { data: runners = [] } = useQuery({ queryKey: ["runners"], queryFn: () => runnersApi.list() });
  const createRunnerMut = useMutation({
    mutationFn: () => runnersApi.create(runnerForm),
    onSuccess: (data: { id: string; token: string }) => {
      qc.invalidateQueries({ queryKey: ["runners"] });
      setShowRunnerModal(false);
      setNewRunnerToken(data);
      toast.success("Runner created");
    },
    onError: () => toast.error("Failed to create runner"),
  });
  const toggleRunnerMut = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) => runnersApi.update(id, { is_enabled: isEnabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["runners"] }),
  });
  const revokeRunnerMut = useMutation({
    mutationFn: (id: string) => runnersApi.revoke(id),
    onSuccess: (data: { id: string; token: string }) => {
      qc.invalidateQueries({ queryKey: ["runners"] });
      setNewRunnerToken(data);
      toast.success("Runner token revoked");
    },
  });

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Runners</h2>
          <Button variant="primary" size="sm" onClick={() => setShowRunnerModal(true)}><Plus size={12}/> Add Runner</Button>
        </div>
        <div className="space-y-1">
          {(runners as Runner[]).map(r => (
            <div key={r.id} className="text-xs bg-gray-800 rounded px-2 py-2 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${r.is_online ? "bg-green-400" : "bg-gray-600"}`}/>
              <div className="flex-1 min-w-0">
                <div className="text-gray-200 truncate">{r.name} · {r.platform || "unknown"} {r.architecture || ""}</div>
                <div className="text-gray-500 truncate">{r.hostname || "no-host"} · {r.last_heartbeat ? new Date(r.last_heartbeat).toLocaleString() : "no heartbeat"}</div>
              </div>
              <span className="text-gray-500">{(r.tools || []).length} tools</span>
              <Button variant="ghost" size="sm" onClick={() => toggleRunnerMut.mutate({ id: r.id, isEnabled: !r.is_enabled })}>{r.is_enabled ? "Disable" : "Enable"}</Button>
              <Button variant="ghost" size="sm" onClick={() => revokeRunnerMut.mutate(r.id)}>Revoke</Button>
            </div>
          ))}
          {(runners as Runner[]).length === 0 && <div className="text-center py-2 text-gray-600">No runners configured</div>}
        </div>
      </div>

      {showRunnerModal && (
        <Modal title="Add Runner" onClose={() => setShowRunnerModal(false)}>
          <div className="space-y-3">
            <Input label="Name *" value={runnerForm.name} onChange={e => setRunnerForm(f => ({ ...f, name: e.target.value }))} placeholder="Kali-WSL-01" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Hostname" value={runnerForm.hostname} onChange={e => setRunnerForm(f => ({ ...f, hostname: e.target.value }))} />
              <Input label="Platform" value={runnerForm.platform} onChange={e => setRunnerForm(f => ({ ...f, platform: e.target.value }))} placeholder="kali/wsl/windows" />
            </div>
            <Input label="Architecture" value={runnerForm.architecture} onChange={e => setRunnerForm(f => ({ ...f, architecture: e.target.value }))} placeholder="x86_64" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowRunnerModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => createRunnerMut.mutate()} disabled={!runnerForm.name}>Create Runner</Button>
            </div>
          </div>
        </Modal>
      )}

      {newRunnerToken && (
        <Modal title="Runner Token (Copy Now)" onClose={() => setNewRunnerToken(null)} width="max-w-xl">
          <div className="space-y-3">
            <p className="text-sm text-gray-300">Store this token securely. It will not be shown again.</p>
            <Input value={newRunnerToken.token} readOnly />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(newRunnerToken.token).then(() => toast.success("Token copied"))}>Copy Token</Button>
              <Button variant="primary" size="sm" onClick={() => setNewRunnerToken(null)}>Done</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
