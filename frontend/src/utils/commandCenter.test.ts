import { describe, expect, it } from "vitest";
import { buildOperationalAlerts, buildSiteMap, endpointCoverageBreakdown } from "./commandCenter";

describe("commandCenter utils", () => {
  it("builds a nested site map with methods", () => {
    const tree = buildSiteMap([
      { id: "1", path: "/api/users", method: "GET", testing_status: "passed" },
      { id: "2", path: "/api/users", method: "POST", testing_status: "testing" },
      { id: "3", path: "/api/users/{id}", method: "PATCH", testing_status: "finding" },
    ]);

    expect(tree[0].name).toBe("api");
    const users = tree[0].children.find((node) => node.name === "users");
    expect(users).toBeDefined();
    expect(users?.methods).toEqual(["GET", "POST"]);
    expect(users?.children[0].name).toBe("{id}");
  });

  it("creates operational alerts from summary state", () => {
    const alerts = buildOperationalAlerts({
      pending_review: 2,
      pending_retests: 1,
      draft_findings: 3,
      untested_endpoints: 4,
      running_jobs: 1,
      day_counter: 2,
    });

    expect(alerts).toContain("2 findings awaiting review");
    expect(alerts).toContain("4 endpoints remain untested");
    expect(alerts).toContain("1 jobs currently running");
  });

  it("calculates endpoint coverage buckets", () => {
    const breakdown = endpointCoverageBreakdown([
      { id: "1", path: "/a", testing_status: "not_tested" },
      { id: "2", path: "/b", testing_status: "testing" },
      { id: "3", path: "/c", testing_status: "passed" },
      { id: "4", path: "/d", testing_status: "finding" },
      { id: "5", path: "/e" },
    ]);

    expect(breakdown).toEqual({
      untested: 2,
      testing: 1,
      passed: 1,
      finding: 1,
    });
  });
});
