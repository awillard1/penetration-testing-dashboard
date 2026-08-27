import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Shield,
  Users,
  Target,
  AlertTriangle,
  FileImage,
  Key,
  CheckSquare,
  FileText,
  Terminal,
  Code2,
  Link2,
  Activity,
  FileOutput,
  Settings,
  Menu,
  Search,
  ChevronLeft,
  Radar,
  PlayCircle,
} from "lucide-react";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { searchApi } from "../../api/client";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/engagements", icon: Shield, label: "Engagements" },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/targets", icon: Target, label: "Targets" },
  { to: "/findings", icon: AlertTriangle, label: "Findings" },
  { to: "/evidence", icon: FileImage, label: "Evidence" },
  { to: "/credentials", icon: Key, label: "Credentials" },
  { to: "/tasks", icon: CheckSquare, label: "Tasks" },
  { to: "/notes", icon: FileText, label: "Notes" },
  { to: "/commands", icon: Terminal, label: "Commands" },
  { to: "/payloads", icon: Code2, label: "Payloads" },
  { to: "/links", icon: Link2, label: "Links" },
  { to: "/scans", icon: Radar, label: "Scans" },
  { to: "/jobs", icon: PlayCircle, label: "Jobs" },
  { to: "/activity", icon: Activity, label: "Activity" },
  { to: "/reports", icon: FileOutput, label: "Reports" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const { data: searchResults } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: () => searchApi.search(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar */}
      <aside
        className={clsx(
          "flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-200 flex-shrink-0",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-14 px-3 border-b border-gray-800 gap-2">
          {!collapsed && (
            <span className="text-brand-400 font-bold text-sm truncate">PentestDashboard</span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto text-gray-400 hover:text-white p-1 rounded"
          >
            {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 px-3 py-2 mx-1 rounded text-sm transition-colors",
                  isActive
                    ? "bg-brand-500/20 text-brand-400"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                )
              }
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center h-14 px-4 border-b border-gray-800 bg-gray-900 gap-4 flex-shrink-0">
          <div className="relative flex-1 max-w-lg">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              id="global-search"
              type="text"
              placeholder="Search… (Ctrl+K)"
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
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
