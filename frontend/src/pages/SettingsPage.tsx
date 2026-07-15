import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi, backupsApi, watchPathsApi } from "../api/client";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Input, Select } from "../components/ui/Input";
import { Settings, Save, HardDrive, Folder, Plus, Trash2, CheckCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function SettingsPage() {
  const qc = useQueryClient();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [backuping, setBackuping] = useState(false);
  const [showWatchModal, setShowWatchModal] = useState(false);
  const [watchForm, setWatchForm] = useState({ name: "", path: "", is_recursive: "true" });

  const { data: settings = [] } = useQuery({ queryKey: ["settings"], queryFn: () => settingsApi.list() });
  const { data: backups = [] } = useQuery({ queryKey: ["backups"], queryFn: () => backupsApi.list() });
  const { data: watchPaths = [] } = useQuery({ queryKey: ["watchPaths"], queryFn: () => watchPathsApi.list() });

  const updateMut = useMutation({ mutationFn: ({ key, value }: { key: string; value: string }) => settingsApi.set(key, value), onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); toast.success("Setting saved"); } });
  const addWatchMut = useMutation({ mutationFn: (data: typeof watchForm) => watchPathsApi.create({ ...data, is_recursive: data.is_recursive === "true" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["watchPaths"] }); setShowWatchModal(false); toast.success("Watch path added"); } });
  const removeWatchMut = useMutation({ mutationFn: (id: string) => watchPathsApi.remove(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["watchPaths"] }) });

  const triggerBackup = async () => {
    setBackuping(true);
    try {
      await backupsApi.trigger();
      qc.invalidateQueries({ queryKey: ["backups"] });
      toast.success("Backup created");
    } catch { toast.error("Backup failed"); }
    setBackuping(false);
  };

  type Setting = { key: string; value: string; value_type: string; description?: string; is_sensitive: boolean; group_name?: string };
  type Backup = { id: string; filename: string; file_size: number; sha256: string; created_at: string };
  type WatchPath = { id: string; path: string; name?: string; is_recursive: boolean; is_enabled: boolean };

  const allSettings = settings as Setting[];
  const groups = [...new Set(allSettings.map(s => s.group_name || "General"))];

  const formatBytes = (b: number) => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-lg font-bold text-white flex items-center gap-2"><Settings size={18}/> Settings</h1>

      {groups.map(group => (
        <div key={group} className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">{group}</h2>
          {allSettings.filter(s => (s.group_name || "General") === group).map(s => (
            <div key={s.key} className="grid grid-cols-3 gap-3 items-start">
              <div>
                <div className="text-sm text-white">{s.key}</div>
                {s.description && <div className="text-xs text-gray-500">{s.description}</div>}
              </div>
              <div className="col-span-2 flex gap-2">
                {s.value_type === "bool" ? (
                  <Select
                    value={editValues[s.key] ?? s.value}
                    onChange={e => setEditValues(ev => ({ ...ev, [s.key]: e.target.value }))}
                    options={[{ value: "true", label: "Enabled" }, { value: "false", label: "Disabled" }]}
                  />
                ) : (
                  <Input
                    type={s.is_sensitive ? "password" : "text"}
                    value={editValues[s.key] ?? s.value}
                    onChange={e => setEditValues(ev => ({ ...ev, [s.key]: e.target.value }))}
                    placeholder={s.is_sensitive ? "••••••••" : ""}
                  />
                )}
                <Button variant="secondary" size="sm" onClick={() => updateMut.mutate({ key: s.key, value: editValues[s.key] ?? s.value })}><Save size={12}/></Button>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2"><HardDrive size={14}/> Backups</h2>
          <Button variant="primary" size="sm" onClick={triggerBackup} disabled={backuping}>
            {backuping ? <Loader2 size={12} className="animate-spin"/> : <HardDrive size={12}/>} Backup Now
          </Button>
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {(backups as Backup[]).map(b => (
            <div key={b.id} className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800 rounded px-2 py-1">
              <CheckCircle size={11} className="text-green-400"/>
              <span className="font-mono flex-1 truncate">{b.filename}</span>
              <span>{formatBytes(b.file_size)}</span>
              <span className="text-gray-600">{new Date(b.created_at).toLocaleDateString()}</span>
            </div>
          ))}
          {(backups as Backup[]).length === 0 && <div className="text-center py-2 text-gray-600">No backups yet</div>}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2"><Folder size={14}/> Watch Paths</h2>
          <Button variant="primary" size="sm" onClick={() => setShowWatchModal(true)}><Plus size={12}/> Add</Button>
        </div>
        <div className="space-y-1">
          {(watchPaths as WatchPath[]).map(wp => (
            <div key={wp.id} className="flex items-center gap-2 text-xs bg-gray-800 rounded px-2 py-1.5">
              <div className={`w-2 h-2 rounded-full ${wp.is_enabled ? "bg-green-400" : "bg-gray-600"}`}/>
              <span className="font-mono text-gray-300 flex-1">{wp.path}</span>
              {wp.name && <span className="text-gray-500">{wp.name}</span>}
              {wp.is_recursive && <span className="text-gray-600 bg-gray-700 px-1 rounded">recursive</span>}
              <button onClick={() => removeWatchMut.mutate(wp.id)} className="text-gray-600 hover:text-red-400"><Trash2 size={11}/></button>
            </div>
          ))}
          {(watchPaths as WatchPath[]).length === 0 && <div className="text-center py-2 text-gray-600">No watch paths configured</div>}
        </div>
      </div>

      {showWatchModal && (
        <Modal title="Add Watch Path" onClose={() => setShowWatchModal(false)}>
          <div className="space-y-3">
            <Input label="Name *" value={watchForm.name} onChange={e => setWatchForm(f => ({ ...f, name: e.target.value }))} placeholder="Evidence folder" />
            <Input label="Path *" value={watchForm.path} onChange={e => setWatchForm(f => ({ ...f, path: e.target.value }))} placeholder="/path/to/watch or C:\path\to\watch" />
            <Select label="Recursive" value={watchForm.is_recursive} onChange={e => setWatchForm(f => ({ ...f, is_recursive: e.target.value }))} options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowWatchModal(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => addWatchMut.mutate(watchForm)} disabled={!watchForm.path || !watchForm.name}>Add</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
