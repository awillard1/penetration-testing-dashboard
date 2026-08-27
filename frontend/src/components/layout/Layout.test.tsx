import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../api/client";
import { AuthContext, type AuthContextValue } from "../../auth-context";
import Layout from "./Layout";

const apiMocks = vi.hoisted(() => ({
  engagementsApi: {
    get: vi.fn().mockResolvedValue({ name: "Engagement", status: "active", testing_window: "24x7" }),
    summary: vi.fn().mockResolvedValue({ coverage_percent: 75 }),
  },
  healthApi: { check: vi.fn().mockResolvedValue({ status: "ok" }) },
  searchApi: { search: vi.fn().mockResolvedValue([]) },
  settingsApi: { list: vi.fn().mockResolvedValue([{ key: "active_engagement_id", value: "eng-1" }]) },
  targetApi: { get: vi.fn().mockResolvedValue({ hostname: "target.local", in_scope: true }) },
  timeEntriesApi: { list: vi.fn().mockResolvedValue([{ start_time: new Date().toISOString(), duration_minutes: 120 }]) },
}));

vi.mock("../../api/client", () => apiMocks);

function renderLayout(user: AuthUser) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const authValue: AuthContextValue = {
    user,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    setSession: vi.fn(),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter>
          <Layout>
            <div>child</div>
          </Layout>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
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

describe("Layout navigation RBAC", () => {
  it("shows workflow navigation for operators", () => {
    renderLayout(operator);
    [
      "Command Center",
      "Dashboard",
      "My Work",
      "Engagement",
      "Overview",
      "Targets",
      "Recon",
      "Testing",
      "Findings",
      "Credentials",
      "Evidence",
      "Timeline",
      "Operations",
      "Jobs",
      "Tool Launcher",
      "Workflows",
      "Runners",
      "Notes",
      "Knowledge",
      "Payloads",
      "Resources",
      "Delivery",
      "Reports",
      "Review / Retest",
      "Admin",
      "Clients",
      "Settings",
    ].forEach((text) => expect(screen.queryAllByText(text).length).toBeGreaterThan(0));
  });

  it("shows reviewer-only navigation slice", () => {
    renderLayout(reviewer);
    expect(screen.getByText("Findings")).toBeInTheDocument();
    expect(screen.getByText("Review / Retest")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Evidence")).not.toBeInTheDocument();
    expect(screen.queryByText("Tool Launcher")).not.toBeInTheDocument();
  });

  it("shows clients only their restricted navigation", () => {
    renderLayout(client);
    expect(screen.getByText("Findings")).toBeInTheDocument();
    expect(screen.queryByText("Review / Retest")).not.toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Clients")).not.toBeInTheDocument();
  });
});
