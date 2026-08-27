import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import EvidencePage from "./EvidencePage";

const mockEvidenceApi = {
  list: vi.fn(),
  detail: vi.fn(),
  preview: vi.fn(),
  create: vi.fn(),
  upload: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  attachToFinding: vi.fn(),
  detachFromFinding: vi.fn(),
};

vi.mock("../api/client", () => ({
  evidenceApi: mockEvidenceApi,
  engagementsApi: { list: vi.fn(async () => [{ id: "eng-1", name: "Eng 1" }]) },
  findingsApi: { list: vi.fn(async () => [{ id: "f-1", title: "Finding 1" }]) },
}));

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

describe("EvidencePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvidenceApi.list.mockResolvedValue([
      {
        id: "ev-1",
        title: "Request Capture",
        evidence_type: "http_request",
        original_filename: "request.json",
        is_sensitive: false,
      },
    ]);
    mockEvidenceApi.detail.mockResolvedValue({
      id: "ev-1",
      title: "Request Capture",
      evidence_type: "http_request",
      engagement_id: "eng-1",
      file_exists: true,
      preview_kind: "text",
      inline_url: "/api/v1/evidence/ev-1/file",
      download_url: "/api/v1/evidence/ev-1/file?download=true",
      preview_url: "/api/v1/evidence/ev-1/preview",
      finding_ids: [],
    });
    mockEvidenceApi.preview.mockResolvedValue({
      preview_kind: "text",
      raw: '{"a":1}',
      pretty: '{\n  "a": 1\n}',
    });
    mockEvidenceApi.update.mockResolvedValue({});
  });

  it("renders detail and saves metadata updates", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <MemoryRouter>
        <QueryClientProvider client={qc}>
          <EvidencePage />
        </QueryClientProvider>
      </MemoryRouter>
    );

    await screen.findByText("Request Capture");
    await waitFor(() => expect(mockEvidenceApi.detail).toHaveBeenCalledWith("ev-1"));

    const titleInput = screen.getAllByDisplayValue("Request Capture")[0];
    fireEvent.change(titleInput, { target: { value: "Updated Evidence" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(mockEvidenceApi.update).toHaveBeenCalled());
    expect(mockEvidenceApi.preview).toHaveBeenCalledWith("ev-1");
  });
});
