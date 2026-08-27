import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../api/client";
import { Activity, User, FileText, Shield, Target, Key, Link2, Terminal, ScanLine } from "lucide-react";

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  finding: <Shield size={13} />,
  target: <Target size={13} />,
  credential: <Key size={13} />,
  link: <Link2 size={13} />,
  command: <Terminal size={13} />,
  scan: <ScanLine size={13} />,
  note: <FileText size={13} />,
  user: <User size={13} />,
};

const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

type ActivityRecord = {
  id: string;
  event_type: string;
  object_type?: string;
  object_id?: string;
  actor?: string;
  description?: string;
  created_at: string | number;
};

function parseApiDate(input: string | number): Date {
  if (typeof input === "number") {
    const ms = input < 1_000_000_000_000 ? input * 1000 : input;
    return new Date(ms);
  }

  const raw = (input || "").trim();
  if (!raw) return new Date(NaN);

  const hasExplicitTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  if (hasExplicitTz) return new Date(raw);

  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  return new Date(`${normalized}Z`);
}

function formatDateLabel(input: string | number): string {
  const d = parseApiDate(input);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: USER_TZ,
  });
}

function formatDateTime(input: string | number): string {
  const d = parseApiDate(input);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: USER_TZ,
  });
}

export default function ActivityPage() {
  const {
    data: activities = [],
    isLoading,
    isError,
    error,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["activity"],
    queryFn: async () => {
      const res = await activityApi.list({ limit: 200, skip: 0 });
      console.log("[activity] fetched", new Date().toISOString(), Array.isArray(res) ? res.length : res);
      return res;
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    retry: 0,
    });

  const groupByDate = (items: ActivityRecord[]) => {
    const groups: Record<string, ActivityRecord[]> = {};
    items.forEach((item) => {
      const date = formatDateLabel(item.created_at);
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  };

  const allActivity = (Array.isArray(activities) ? activities : []) as ActivityRecord[];
  const grouped = groupByDate(allActivity);

  const actionColor = (eventType: string) => {
    if (eventType.includes("create") || eventType.includes("add")) return "text-green-400 bg-green-900";
    if (eventType.includes("delete") || eventType.includes("remove")) return "text-red-400 bg-red-900";
    if (eventType.includes("update") || eventType.includes("edit") || eventType.includes("change")) return "text-blue-400 bg-blue-900";
    return "text-gray-400 bg-gray-800";
  };

  if (isLoading) return <div className="text-gray-400">Loading activity…</div>;
  if (isError) return <div className="text-red-400">Failed to load activity: {(error as Error)?.message || "Unknown error"}</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-lg font-bold text-white flex items-center gap-2">
        <Activity size={18} /> Activity Feed
      </h1>

      <div className="text-xs text-gray-500">
        Timezone: <span className="text-gray-300">{USER_TZ}</span>
      </div>
      <div className="text-xs text-gray-600">
        Last refresh:{" "}
        <span className="text-gray-400">
          {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-US", { timeZone: USER_TZ }) : "never"}
        </span>
      </div>

      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">{date}</div>
          <div className="space-y-1">
            {items.map((a) => (
              <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 flex items-start gap-3">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${actionColor(a.event_type)}`}>
                  {ENTITY_ICONS[a.object_type || ""] || <Activity size={11} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-200">
                    <span className={`text-xs px-1.5 py-0.5 rounded mr-2 ${actionColor(a.event_type)}`}>
                      {a.event_type.replace(/_/g, " ")}
                    </span>
                    {a.object_type && <span className="text-gray-400">{a.object_type}</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {a.description || "No description"}
                    <span className="mx-2">•</span>
                    {formatDateTime(a.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
