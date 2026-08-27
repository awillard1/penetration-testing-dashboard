import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { operatorApi, settingsApi, targetApi } from "../api/client";

type ReconEntry = Record<string, unknown> & { id: string };

export default function ReconPage() {
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState("");
  const [baseSnapshotId, setBaseSnapshotId] = useState("");
  const [compareSnapshotId, setCompareSnapshotId] = useState("");

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.list });
  const activeEngagementId = Array.isArray(settings)
    ? settings.find((s: { key: string }) => s.key === "active_engagement_id")?.value
    : null;

  const { data: targets = [] } = useQuery({
    queryKey: ["recon-targets", activeEngagementId],
    queryFn: () => targetApi.list({ engagement_id: activeEngagementId }),
    enabled: !!activeEngagementId,
  });

  const { data: recon } = useQuery({
    queryKey: ["recon-workspace", activeEngagementId, targetId],
    queryFn: () =>
      operatorApi.recon({
        engagement_id: activeEngagementId,
        ...(targetId ? { target_id: targetId } : {}),
      }),
    enabled: !!activeEngagementId,
    refetchInterval: 10000,
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ["recon-snapshots", activeEngagementId, targetId],
    queryFn: () =>
      operatorApi.listReconSnapshots({
        engagement_id: activeEngagementId,
        ...(targetId ? { target_id: targetId } : {}),
      }),
    enabled: !!activeEngagementId,
  });

  const snapshotMutation = useMutation({
    mutationFn: () =>
      operatorApi.createReconSnapshot({
        engagement_id: activeEngagementId,
        target_id: targetId || null,
        label: `Snapshot ${new Date().toLocaleString()}`,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recon-snapshots"] }),
  });

  const { data: diff } = useQuery({
    queryKey: ["recon-diff", baseSnapshotId, compareSnapshotId],
    queryFn: () => operatorApi.reconDiff(baseSnapshotId, compareSnapshotId),
    enabled: !!baseSnapshotId && !!compareSnapshotId && baseSnapshotId !== compareSnapshotId,
  });

  const counts = useMemo(
    () => ({
      hosts: (recon?.hosts || []).length,
      services: (recon?.services || []).length,
      urls: (recon?.urls || []).length,
      endpoints: (recon?.endpoints || []).length,
      parameters: (recon?.parameters || []).length,
    }),
    [recon],
  );

  const selectedTargetLabel = (targets as Array<{ id: string; hostname?: string; ip_address?: string; url?: string }>).find((t) => t.id === targetId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-white">Recon</h1>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200"
        >
          <option value="">All engagement targets</option>
          {(targets as Array<{ id: string; hostname?: string; ip_address?: string; url?: string }>).map((t) => (
            <option key={t.id} value={t.id}>
              {t.hostname || t.ip_address || t.url || t.id}
            </option>
          ))}
        </select>
        <button
          onClick={() => snapshotMutation.mutate()}
          disabled={!activeEngagementId || snapshotMutation.isPending}
          className="px-3 py-1.5 text-xs rounded bg-brand-500 text-black font-semibold hover:bg-brand-600 disabled:opacity-50"
        >
          Create Snapshot
        </button>
        {selectedTargetLabel && <span className="text-xs text-gray-400">Target: {selectedTargetLabel.hostname || selectedTargetLabel.ip_address || selectedTargetLabel.url}</span>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
        <div className="bg-gray-900 border border-gray-800 rounded p-2">Hosts: {counts.hosts}</div>
        <div className="bg-gray-900 border border-gray-800 rounded p-2">Services: {counts.services}</div>
        <div className="bg-gray-900 border border-gray-800 rounded p-2">URLs: {counts.urls}</div>
        <div className="bg-gray-900 border border-gray-800 rounded p-2">Endpoints: {counts.endpoints}</div>
        <div className="bg-gray-900 border border-gray-800 rounded p-2">Parameters: {counts.parameters}</div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {(["hosts", "services", "urls", "endpoints", "parameters"] as const).map((key) => (
          <div key={key} className="bg-gray-900 border border-gray-800 rounded">
            <div className="px-3 py-2 border-b border-gray-800 text-sm font-semibold text-gray-200 uppercase">{key}</div>
            <div className="max-h-64 overflow-y-auto">
              {((recon?.[key] as ReconEntry[]) || []).slice(0, 200).map((row) => (
                <div key={row.id} className="px-3 py-1.5 text-xs border-b border-gray-800/70 text-gray-300">
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(row, null, 2)}</pre>
                </div>
              ))}
              {(!recon?.[key] || (recon[key] as unknown[]).length === 0) && <div className="px-3 py-3 text-xs text-gray-500">No {key}.</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded p-3 space-y-3">
        <h2 className="text-sm font-semibold text-gray-200">Recon Diff</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <select value={baseSnapshotId} onChange={(e) => setBaseSnapshotId(e.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200">
            <option value="">Base snapshot</option>
            {(snapshots as Array<{ id: string; label?: string; created_at?: string }>).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label || s.id} · {s.created_at ? new Date(s.created_at).toLocaleString() : ""}
              </option>
            ))}
          </select>
          <select value={compareSnapshotId} onChange={(e) => setCompareSnapshotId(e.target.value)} className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200">
            <option value="">Compare snapshot</option>
            {(snapshots as Array<{ id: string; label?: string; created_at?: string }>).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label || s.id} · {s.created_at ? new Date(s.created_at).toLocaleString() : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          <div className="bg-gray-800 rounded p-2">New: {(diff?.added || []).length}</div>
          <div className="bg-gray-800 rounded p-2">Removed: {(diff?.removed || []).length}</div>
          <div className="bg-gray-800 rounded p-2">Changed: {(diff?.changed || []).length}</div>
        </div>
      </div>
    </div>
  );
}
