import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { AuthContext, type AuthContextValue } from "./auth-context";
import type { AuthUser } from "./api/client";
import type { ReactNode } from "react";

vi.mock("./components/layout/Layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock("./pages/DashboardPage", () => ({ default: () => <div>DashboardPage</div> }));
vi.mock("./pages/EngagementsPage", () => ({ default: () => <div>EngagementsPage</div> }));
vi.mock("./pages/EngagementDetailPage", () => ({ default: () => <div>EngagementDetailPage</div> }));
vi.mock("./pages/ClientsPage", () => ({ default: () => <div>ClientsPage</div> }));
vi.mock("./pages/TargetsPage", () => ({ default: () => <div>TargetsPage</div> }));
vi.mock("./pages/FindingsPage", () => ({ default: () => <div>FindingsPage</div> }));
vi.mock("./pages/FindingDetailPage", () => ({ default: () => <div>FindingDetailPage</div> }));
vi.mock("./pages/EvidencePage", () => ({ default: () => <div>EvidencePage</div> }));
vi.mock("./pages/CredentialsPage", () => ({ default: () => <div>CredentialsPage</div> }));
vi.mock("./pages/TasksPage", () => ({ default: () => <div>TasksPage</div> }));
vi.mock("./pages/MyWorkPage", () => ({ default: () => <div>MyWorkPage</div> }));
vi.mock("./pages/TestingPage", () => ({ default: () => <div>TestingPage</div> }));
vi.mock("./pages/NotesPage", () => ({ default: () => <div>NotesPage</div> }));
vi.mock("./pages/CommandsPage", () => ({ default: () => <div>CommandsPage</div> }));
vi.mock("./pages/PayloadsPage", () => ({ default: () => <div>PayloadsPage</div> }));
vi.mock("./pages/LinksPage", () => ({ default: () => <div>LinksPage</div> }));
vi.mock("./pages/ScansPage", () => ({ default: () => <div>ScansPage</div> }));
vi.mock("./pages/ReconPage", () => ({ default: () => <div>ReconPage</div> }));
vi.mock("./pages/ActivityPage", () => ({ default: () => <div>ActivityPage</div> }));
vi.mock("./pages/ReportsPage", () => ({ default: () => <div>ReportsPage</div> }));
vi.mock("./pages/JobsPage", () => ({ default: () => <div>JobsPage</div> }));
vi.mock("./pages/SettingsPage", () => ({ default: () => <div>SettingsPage</div> }));
vi.mock("./pages/RunnersPage", () => ({ default: () => <div>RunnersPage</div> }));
vi.mock("./pages/ReviewRetestPage", () => ({ default: () => <div>ReviewRetestPage</div> }));
vi.mock("./pages/TargetWorkspacePage", () => ({ default: () => <div>TargetWorkspacePage</div> }));
vi.mock("./pages/LoginPage", () => ({ default: () => <div>LoginPage</div> }));

function buildAuthValue(user: AuthUser | null): AuthContextValue {
  return {
    user,
    isAuthenticated: !!user,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setSession: vi.fn(),
  };
}

function renderApp(path: string, user: AuthUser | null) {
  return render(
    <AuthContext.Provider value={buildAuthValue(user)}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

const operator: AuthUser = {
  id: "user-1",
  username: "operator",
  role: "penetration_tester",
  is_active: true,
  auth_provider: "local",
};

const reviewer: AuthUser = {
  id: "user-2",
  username: "reviewer",
  role: "reviewer",
  is_active: true,
  auth_provider: "local",
};

const client: AuthUser = {
  id: "user-3",
  username: "client",
  role: "client",
  is_active: true,
  auth_provider: "local",
  client_id: "client-1",
};

describe("App RBAC routing", () => {
  it.each([
    ["/workspace/target-1", "TargetWorkspacePage"],
    ["/my-work", "MyWorkPage"],
    ["/testing", "TestingPage"],
    ["/recon", "ReconPage"],
    ["/jobs", "JobsPage"],
    ["/runners", "RunnersPage"],
    ["/review", "ReviewRetestPage"],
  ])("allows operators to reach %s", (path, pageText) => {
    renderApp(path, operator);
    expect(screen.getByText(pageText)).toBeInTheDocument();
  });

  it("redirects reviewers to review instead of operator-only routes", () => {
    renderApp("/jobs", reviewer);
    expect(screen.getByText("ReviewRetestPage")).toBeInTheDocument();
    expect(screen.queryByText("JobsPage")).not.toBeInTheDocument();
  });

  it("allows reviewers to access review and findings routes", () => {
    renderApp("/review", reviewer);
    expect(screen.getByText("ReviewRetestPage")).toBeInTheDocument();
  });

  it("redirects clients to findings for restricted routes", () => {
    renderApp("/dashboard", client);
    expect(screen.getByText("FindingsPage")).toBeInTheDocument();
    expect(screen.queryByText("DashboardPage")).not.toBeInTheDocument();
  });

  it("sends unauthenticated users to login", () => {
    renderApp("/dashboard", null);
    expect(screen.getByText("LoginPage")).toBeInTheDocument();
  });
});
