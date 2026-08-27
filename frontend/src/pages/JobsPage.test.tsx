import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import JobsPage from "./JobsPage";

const { mocks } = vi.hoisted(() => ({
  mocks: {
    settingsApi: { list: vi.fn() },
    engagementsApi: { list: vi.fn() },
    operatorApi: { listCommandRuns: vi.fn(), stopCommand: vi.fn() },
  },
}));

vi.mock("../api/client", () => ({
  settingsApi: mocks.settingsApi,
  engagementsApi: mocks.engagementsApi,
  operatorApi: mocks.operatorApi,
}));

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

describe("JobsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.settingsApi.list.mockResolvedValue([{ key: "active_engagement_id", value: "eng-1" }]);
    mocks.engagementsApi.list.mockResolvedValue([{ id: "eng-1", name: "Eng 1" }]);
    mocks.operatorApi.listCommandRuns.mockResolvedValue([
      {
        id: "run-1",
        status: "running",
        command_preview: "nmap -sV 10.0.0.1",
        target_id: "target-1",
        stdout: "starting",
        stderr: "",
      },
    ]);
    mocks.operatorApi.stopCommand.mockResolvedValue({ status: "stopped" });
  });

  it("shows run and issues stop action", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <JobsPage />
      </QueryClientProvider>
    );

    await screen.findByText("nmap -sV 10.0.0.1");
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    await waitFor(() => expect(mocks.operatorApi.stopCommand).toHaveBeenCalledWith("run-1"));
  });
});
