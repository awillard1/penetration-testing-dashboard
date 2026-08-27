export type EndpointRecord = {
  id: string;
  path: string;
  method?: string;
  testing_status?: string;
  auth_requirement?: string;
  status_code?: number;
};

export type SiteMapNode = {
  name: string;
  fullPath: string;
  children: SiteMapNode[];
  methods: string[];
  tested: boolean;
  hasFinding: boolean;
};

export function buildSiteMap(endpoints: EndpointRecord[]): SiteMapNode[] {
  type MutableNode = SiteMapNode & { childMap: Record<string, MutableNode> };
  const roots: Record<string, MutableNode> = {};

  for (const endpoint of endpoints) {
    const cleanPath = endpoint.path?.startsWith("/") ? endpoint.path : `/${endpoint.path || ""}`;
    const segments = cleanPath.split("/").filter(Boolean);
    let parentMap = roots;
    let fullPath = "";

    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      fullPath = `${fullPath}/${segment}`;
      if (!parentMap[segment]) {
        parentMap[segment] = {
          name: segment,
          fullPath,
          children: [],
          methods: [],
          tested: true,
          hasFinding: false,
          childMap: {},
        };
      }
      const node = parentMap[segment];
      node.tested = node.tested && endpoint.testing_status !== "not_tested";
      node.hasFinding = node.hasFinding || endpoint.testing_status === "finding";
      if (i === segments.length - 1 && endpoint.method && !node.methods.includes(endpoint.method)) {
        node.methods.push(endpoint.method);
      }
      parentMap = node.childMap;
    }
  }

  const materialize = (map: Record<string, MutableNode>): SiteMapNode[] =>
    Object.values(map)
      .map((node) => ({
        name: node.name,
        fullPath: node.fullPath,
        tested: node.tested,
        hasFinding: node.hasFinding,
        methods: [...node.methods].sort(),
        children: materialize(node.childMap),
      }))
      .sort((a, b) => a.fullPath.localeCompare(b.fullPath));

  return materialize(roots);
}

export function buildOperationalAlerts(summary: {
  pending_review?: number;
  pending_retests?: number;
  draft_findings?: number;
  untested_endpoints?: number;
  running_jobs?: number;
  day_counter?: number;
  active_engagement?: { end_date?: string };
}): string[] {
  const alerts: string[] = [];
  if ((summary.pending_review || 0) > 0) alerts.push(`${summary.pending_review} findings awaiting review`);
  if ((summary.pending_retests || 0) > 0) alerts.push(`${summary.pending_retests} retests pending`);
  if ((summary.draft_findings || 0) > 0) alerts.push(`${summary.draft_findings} draft findings missing finalization`);
  if ((summary.untested_endpoints || 0) > 0) alerts.push(`${summary.untested_endpoints} endpoints remain untested`);
  if ((summary.running_jobs || 0) > 0) alerts.push(`${summary.running_jobs} jobs currently running`);

  const endDate = summary.active_engagement?.end_date;
  if (endDate) {
    const daysLeft = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 1) alerts.push("Engagement closes within 24 hours");
  }

  if ((summary.day_counter || 0) === 0) alerts.push("Engagement day counter is not started");

  return alerts;
}

export function endpointCoverageBreakdown(endpoints: EndpointRecord[]): {
  untested: number;
  testing: number;
  passed: number;
  finding: number;
} {
  return endpoints.reduce(
    (acc, endpoint) => {
      const status = endpoint.testing_status || "not_tested";
      if (status === "testing") acc.testing += 1;
      else if (status === "passed") acc.passed += 1;
      else if (status === "finding") acc.finding += 1;
      else acc.untested += 1;
      return acc;
    },
    { untested: 0, testing: 0, passed: 0, finding: 0 }
  );
}
