import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { engagementsApi, settingsApi } from "../api/client";
import { StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import toast from "react-hot-toast";
import { Star } from "lucide-react";

export default function EngagementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: eng } = useQuery({ queryKey: ["engagement", id], queryFn: () => engagementsApi.get(id!) });
  const { data: summary } = useQuery({ queryKey: ["engagement-summary", id], queryFn: () => engagementsApi.summary(id!) });

  const setActiveMut = useMutation({
    mutationFn: () => settingsApi.set("active_engagement_id", id!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); toast.success("Set as active engagement"); },
  });

  if (!eng) return <div className="text-gray-400">Loading…</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{eng.name}</h1>
          <div className="flex gap-2 mt-1">
            <StatusBadge status={eng.status} />
            <span className="text-xs text-gray-500">{eng.engagement_type?.replace(/_/g, " ")}</span>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setActiveMut.mutate()}>
          <Star size={14} /> Set Active
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            ["Targets", summary.total_targets],
            ["Findings", summary.total_findings],
            ["Evidence", summary.evidence_count],
            ["Credentials", summary.credential_count],
            ["Scans", summary.scan_count],
            ["Open Tasks", summary.open_tasks],
          ].map(([label, value]) => (
            <div key={label as string} className="bg-gray-900 border border-gray-800 rounded p-3 text-center">
              <div className="text-2xl font-bold text-white">{value as number}</div>
              <div className="text-xs text-gray-400">{label as string}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Details</h2>
        {eng.description && <p className="text-sm text-gray-400">{eng.description}</p>}
        {eng.rules_of_engagement && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Rules of Engagement</p>
            <p className="text-sm text-gray-400 whitespace-pre-wrap">{eng.rules_of_engagement}</p>
          </div>
        )}
        {eng.authorization_notes && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Authorization Notes</p>
            <p className="text-sm text-gray-400">{eng.authorization_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
