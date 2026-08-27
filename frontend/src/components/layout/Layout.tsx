import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  CheckSquare,
  ChevronLeft,
  Code2,
  FileImage,
  FlaskConical,
  FileOutput,
  FileText,
  LayoutDashboard,
  Link2,
  Menu,
  PlayCircle,
  Radar,
  Search,
  Settings,
  Shield,
  Target,
  Terminal,
  Users,
  Key,
} from "lucide-react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { engagementsApi, healthApi, searchApi, settingsApi, targetApi, timeEntriesApi } from "../../api/client";
import {
  canManageEngagements,
  canManageRunners,
  canReviewFindings,
  canRunCommands,
  canViewCredentials,
  canViewDashboard,
  canViewEvidence,
} from "../../lib/capabilities";
import { useAuth } from "../../useAuth";
import Button from "../ui/Button";

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  visible: boolean;
}

const navSections = (user: ReturnType<typeof useAuth>["user"]): Array<{ title: string; items: NavItem[] }> => [
  {
    title: "Command Center",
    items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", visible: canViewDashboard(user) },
      { to: "/my-work", icon: Briefcase, label: "My Work", visible: canManageEngagements(user) },
    ],
  },
  {
    title: "Engagement",
    items: [
      { to: "/engagements", icon: Shield, label: "Overview", visible: canManageEngagements(user) },
      { to: "/targets", icon: Target, label: "Targets", visible: canManageEngagements(user) },
      { to: "/recon", icon: Radar, label: "Recon", visible: canManageEngagements(user) },
      { to: "/testing", icon: FlaskConical, label: "Testing", visible: canManageEngagements(user) },
      { to: "/findings", icon: AlertTriangle, label: "Findings", visible: true },
      { to: "/credentials", icon: Key, label: "Credentials", visible: canViewCredentials(user) },
      { to: "/evidence", icon: FileImage, label: "Evidence", visible: canViewEvidence(user) },
      { to: "/activity", icon: Activity, label: "Timeline", visible: canManageEngagements(user) },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/jobs", icon: PlayCircle, label: "Jobs", visible: canRunCommands(user) },
      { to: "/commands", icon: Terminal, label: "Tool Launcher", visible: canRunCommands(user) },
      { to: "/scans", icon: Radar, label: "Workflows", visible: canManageEngagements(user) },
      { to: "/runners", icon: Settings, label: "Runners", visible: canManageRunners(user) },
      { to: "/notes", icon: FileText, label: "Notes", visible: canManageEngagements(user) },
    ],
  },
  {
    title: "Knowledge",
    items: [
      { to: "/payloads", icon: Code2, label: "Payloads", visible: canManageEngagements(user) },
      { to: "/links", icon: Link2, label: "Resources", visible: canManageEngagements(user) },
    ],
  },
  {
    title: "Delivery",
    items: [
      { to: "/reports", icon: FileOutput, label: "Reports", visible: canManageEngagements(user) },
      { to: "/review", icon: CheckSquare, label: "Review / Retest", visible: canReviewFindings(user) },
    ],
  },
  {
    title: "Admin",
    items: [
      { to: "/clients", icon: Users, label: "Clients", visible: canManageEngagements(user) },
      { to: "/settings", icon: Settings, label: "Settings", visible: canManageEngagements(user) },
    ],
  },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const showOpsSummary = canViewDashboard(user);
  const visibleSections = navSections(user)
    .map((section) => ({ ...section, items: section.items.filter((item) => item.visible) }))
    .filter((section) => section.items.length > 0);

  const selectedTargetId = useMemo(() => {
    const match = location.pathname.match(/^\/workspace\/([^/?#]+)/);
    return match?.[1] || "";
  }, [location.pathname]);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.list,
    enabled: showOpsSummary,
  });
  const activeEngagementId = Array.isArray(settings)
    ? settings.find((s: { key: string }) => s.key === "active_engagement_id")?.value
    : null;

  const { data: activeEngagement } = useQuery({
    queryKey: ["engagement", activeEngagementId],
    queryFn: () => engagementsApi.get(activeEngagementId!),
    enabled: showOpsSummary && !!activeEngagementId,
  });

  const { data: summary } = useQuery({
    queryKey: ["engagement-summary", activeEngagementId],
    queryFn: () => engagementsApi.summary(activeEngagementId!),
    enabled: showOpsSummary && !!activeEngagementId,
    refetchInterval: 15000,
  });

  const { data: selectedTarget } = useQuery({
    queryKey: ["selected-target", selectedTargetId],
    queryFn: () => targetApi.get(selectedTargetId),
    enabled: showOpsSummary && !!selectedTargetId,
  });

  const { data: todayTime } = useQuery({
    queryKey: ["today-time", activeEngagementId],
    queryFn: () => timeEntriesApi.list({ engagement_id: activeEngagementId }),
    enabled: showOpsSummary && !!activeEngagementId,
    refetchInterval: 30000,
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: healthApi.check,
    refetchInterval: 30000,
  });

  const minutesToday = useMemo(() => {
    if (!Array.isArray(todayTime)) return 0;
    const now = new Date();
    return todayTime.reduce((sum: number, item: { start_time?: string; duration_minutes?: number }) => {
      if (!item.start_time) return sum;
      const started = new Date(item.start_time);
      return started.toDateString() === now.toDateString() ? sum + (item.duration_minutes || 0) : sum;
    }, 0);
  }, [todayTime]);

  const { data: searchResults } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: () => searchApi.search(searchQuery),
    enabled: canManageEngagements(user) && searchQuery.length >= 2,
  });

  useEffect(() => {
    function handleQuickKeys(e: KeyboardEvent) {
      if (!canManageEngagements(user) || !(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        navigate("/notes");
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        navigate("/findings");
      }
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        navigate("/credentials");
      }
      if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        navigate("/evidence");
      }
    }
    window.addEventListener("keydown", handleQuickKeys);
    return () => window.removeEventListener("keydown", handleQuickKeys);
  }, [navigate, user]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      <aside
        className={clsx(
          "flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200 flex-shrink-0",
          collapsed ? "w-14" : "w-64"
        )}
      >
        <div className="flex items-center h-14 px-3 border-b border-gray-800 gap-2">
          {!collapsed && <span className="text-brand-400 font-bold text-sm truncate">PentestDashboard</span>}
          <button onClick={() => setCollapsed((c) => !c)} className="ml-auto text-gray-400 hover:text-white p-1 rounded">
            {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {visibleSections.map((section) => (
            <div key={section.title} className="mb-2">
              {!collapsed && <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-gray-500">{section.title}</p>}
              {section.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    clsx(
                      "flex items-center gap-3 px-3 py-2 mx-1 rounded text-sm transition-colors",
                      isActive ? "bg-brand-500/20 text-brand-400" : "text-gray-400 hover:text-white hover:bg-gray-800"
                    )
                  }
                >
                  <Icon size={16} className="flex-shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex items-center h-14 px-4 border-b border-gray-800 bg-gray-900 gap-4 flex-shrink-0">
          <div className="relative flex-1 max-w-lg">
            {canManageEngagements(user) && (
              <>
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  id="global-search"
                  type="text"
                  placeholder="Search hosts/endpoints/findings… (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-800 text-sm text-gray-100 placeholder-gray-500 pl-8 pr-3 py-1.5 rounded border border-gray-700 focus:outline-none focus:border-brand-500"
                />
                {searchResults && searchResults.length > 0 && searchQuery.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-xl z-50 max-h-64 overflow-y-auto">
                    {(searchResults as Array<{ entity_type: string; id: string; title: string; subtitle?: string; url?: string }>).map((r) => (
                      <button
                        key={`${r.entity_type}-${r.id}`}
                        onClick={() => {
                          navigate(r.url || `/${r.entity_type}s/${r.id}`);
                          setSearchQuery("");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-700"
                      >
                        <span className="text-xs text-gray-400 uppercase w-20 flex-shrink-0">{r.entity_type}</span>
                        <span className="text-gray-100 truncate">{r.title}</span>
                        {r.subtitle && <span className="text-gray-500 text-xs ml-auto">{r.subtitle}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-right">
              <div className="text-sm text-white">{user?.display_name || user?.username}</div>
              <div className="text-xs text-gray-500">{user?.role.replace(/_/g, " ")}</div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              Sign Out
            </Button>
          </div>
        </header>

        {showOpsSummary && (
          <div className="bg-gray-900/80 border-b border-gray-800 px-4 py-2 grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
            <div>
              <div className="text-gray-500 uppercase">Engagement</div>
              <div className="text-gray-200 truncate">{activeEngagement?.name || "Not set"}</div>
            </div>
            <div>
              <div className="text-gray-500 uppercase">Status / Phase</div>
              <div className="text-gray-200">{activeEngagement?.status || "n/a"}</div>
            </div>
            <div>
              <div className="text-gray-500 uppercase">Coverage</div>
              <div className="text-gray-200">{summary?.coverage_percent || 0}%</div>
            </div>
            <div>
              <div className="text-gray-500 uppercase">Selected Target</div>
              <div className="text-gray-200 truncate">{selectedTarget?.hostname || selectedTarget?.ip_address || selectedTarget?.url || "none"}</div>
            </div>
            <div>
              <div className="text-gray-500 uppercase">Scope / Window</div>
              <div className="text-gray-200">{selectedTarget ? (selectedTarget.in_scope ? "in-scope" : "out-of-scope") : "unknown"} · {activeEngagement?.testing_window || "n/a"}</div>
            </div>
            <div>
              <div className="text-gray-500 uppercase">Connectivity / Time</div>
              <div className="text-gray-200">{health?.status === "ok" ? "online" : "degraded"} · {Math.round(minutesToday / 60)}h today</div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
