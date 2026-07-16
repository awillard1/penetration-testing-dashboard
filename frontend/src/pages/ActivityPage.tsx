import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../api/client";
import { Activity, User, FileText, Shield, Target, Key, Link2, Terminal, ScanLine } from "lucide-react";

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  finding: <Shield size={13}/>,
  target: <Target size={13}/>,
  credential: <Key size={13}/>,
  link: <Link2 size={13}/>,
  command: <Terminal size={13}/>,
  scan: <ScanLine size={13}/>,
  note: <FileText size={13}/>,
  user: <User size={13}/>,
};

export default function ActivityPage() {
  const { data: activities = [] } = useQuery({ queryKey: ["activity"], queryFn: () => activityApi.list({ per_page: 200 }) });

  type ActivityRecord = { id: string; event_type: string; object_type?: string; object_id?: string; actor?: string; description?: string; created_at: string };

  const groupByDate = (items: ActivityRecord[]) => {
    const groups: Record<string, ActivityRecord[]> = {};
    items.forEach(item => {
      const date = new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  };

  const allActivity = activities as ActivityRecord[];
  const grouped = groupByDate(allActivity);

  const actionColor = (eventType: string) => {
    if (eventType.includes("create") || eventType.includes("add")) return "text-green-400 bg-green-900";
    if (eventType.includes("delete") || eventType.includes("remove")) return "text-red-400 bg-red-900";
    if (eventType.includes("update") || eventType.includes("edit") || eventType.includes("change")) return "text-blue-400 bg-blue-900";
    return "text-gray-400 bg-gray-800";
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-lg font-bold text-white flex items-center gap-2"><Activity size={18}/> Activity Feed</h1>
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{date}</div>
          <div className="space-y-1">
            {items.map(a => (
              <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 flex items-start gap-3">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${actionColor(a.event_type)}`}>
                  {ENTITY_ICONS[a.object_type || ""] || <Activity size={11}/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200">
                    <span className={`text-xs px-1.5 py-0.5 rounded mr-2 ${actionColor(a.event_type)}`}>{a.event_type.replace(/_/g, " ")}</span>
                    {a.object_type && <span className="text-gray-400">{a.object_type}</span>}
                  </div>
                  {a.description && <div className="text-xs text-gray-500 mt-0.5">{a.description}</div>}
                </div>
                <div className="text-xs text-gray-600 flex-shrink-0">{new Date(a.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {allActivity.length === 0 && <div className="text-center py-8 text-gray-500">No activity recorded yet.</div>}
    </div>
  );
}
