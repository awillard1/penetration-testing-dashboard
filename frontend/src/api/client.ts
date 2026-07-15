import axios from "axios";

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
});

export default api;

// ── Generic helpers ──────────────────────────────────────────────────────────

export const getList = (path: string, params?: Record<string, unknown>) =>
  api.get(path, { params }).then((r) => r.data);

export const getOne = (path: string) => api.get(path).then((r) => r.data);

export const createOne = (path: string, data: unknown) =>
  api.post(path, data).then((r) => r.data);

export const updateOne = (path: string, data: unknown) =>
  api.patch(path, data).then((r) => r.data);

export const deleteOne = (path: string) => api.delete(path).then((r) => r.data);

// ── Typed resource helpers ────────────────────────────────────────────────────

export const clientsApi = {
  list: (params?: object) => getList("/clients", params as Record<string, unknown>),
  get: (id: string) => getOne(`/clients/${id}`),
  create: (data: unknown) => createOne("/clients", data),
  update: (id: string, data: unknown) => updateOne(`/clients/${id}`, data),
  remove: (id: string) => deleteOne(`/clients/${id}`),
};

export const engagementsApi = {
  list: (params?: object) => getList("/engagements", params as Record<string, unknown>),
  get: (id: string) => getOne(`/engagements/${id}`),
  summary: (id: string) => getOne(`/engagements/${id}/summary`),
  create: (data: unknown) => createOne("/engagements", data),
  update: (id: string, data: unknown) => updateOne(`/engagements/${id}`, data),
  remove: (id: string) => deleteOne(`/engagements/${id}`),
};

export const targetApi = {
  list: (params?: object) => getList("/targets", params as Record<string, unknown>),
  get: (id: string) => getOne(`/targets/${id}`),
  create: (data: unknown) => createOne("/targets", data),
  update: (id: string, data: unknown) => updateOne(`/targets/${id}`, data),
  remove: (id: string) => deleteOne(`/targets/${id}`),
};

export const findingsApi = {
  list: (params?: object) => getList("/findings", params as Record<string, unknown>),
  get: (id: string) => getOne(`/findings/${id}`),
  create: (data: unknown) => createOne("/findings", data),
  update: (id: string, data: unknown) => updateOne(`/findings/${id}`, data),
  remove: (id: string) => deleteOne(`/findings/${id}`),
  templates: {
    list: (params?: object) => getList("/findings/templates", params as Record<string, unknown>),
    create: (data: unknown) => createOne("/findings/templates", data),
    remove: (id: string) => deleteOne(`/findings/templates/${id}`),
  },
};

export const evidenceApi = {
  list: (params?: object) => getList("/evidence", params as Record<string, unknown>),
  get: (id: string) => getOne(`/evidence/${id}`),
  create: (data: unknown) => createOne("/evidence", data),
  update: (id: string, data: unknown) => updateOne(`/evidence/${id}`, data),
  remove: (id: string) => deleteOne(`/evidence/${id}`),
  upload: (engagementId: string, title: string, evidenceType: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post(`/evidence/upload?engagement_id=${engagementId}&title=${encodeURIComponent(title)}&evidence_type=${evidenceType}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};

export const credentialsApi = {
  list: (params?: object) => getList("/credentials", params as Record<string, unknown>),
  get: (id: string) => getOne(`/credentials/${id}`),
  create: (data: unknown) => createOne("/credentials", data),
  update: (id: string, data: unknown) => updateOne(`/credentials/${id}`, data),
  remove: (id: string) => deleteOne(`/credentials/${id}`),
  reveal: (id: string) => api.post(`/credentials/${id}/reveal`).then((r) => r.data),
};

export const tasksApi = {
  list: (params?: object) => getList("/tasks", params as Record<string, unknown>),
  get: (id: string) => getOne(`/tasks/${id}`),
  create: (data: unknown) => createOne("/tasks", data),
  update: (id: string, data: unknown) => updateOne(`/tasks/${id}`, data),
  remove: (id: string) => deleteOne(`/tasks/${id}`),
};

export const notesApi = {
  list: (params?: object) => getList("/notes", params as Record<string, unknown>),
  get: (id: string) => getOne(`/notes/${id}`),
  create: (data: unknown) => createOne("/notes", data),
  update: (id: string, data: unknown) => updateOne(`/notes/${id}`, data),
  remove: (id: string) => deleteOne(`/notes/${id}`),
};

export const linksApi = {
  list: (params?: object) => getList("/links", params as Record<string, unknown>),
  get: (id: string) => getOne(`/links/${id}`),
  create: (data: unknown) => createOne("/links", data),
  update: (id: string, data: unknown) => updateOne(`/links/${id}`, data),
  remove: (id: string) => deleteOne(`/links/${id}`),
  open: (id: string) => api.post(`/links/${id}/open`).then((r) => r.data),
  collections: {
    list: () => getList("/links/collections"),
    create: (data: unknown) => createOne("/links/collections", data),
  },
};

export const commandsApi = {
  list: (params?: object) => getList("/commands", params as Record<string, unknown>),
  get: (id: string) => getOne(`/commands/${id}`),
  create: (data: unknown) => createOne("/commands", data),
  update: (id: string, data: unknown) => updateOne(`/commands/${id}`, data),
  remove: (id: string) => deleteOne(`/commands/${id}`),
  use: (id: string) => api.post(`/commands/${id}/use`).then((r) => r.data),
};

export const payloadsApi = {
  list: (params?: object) => getList("/payloads", params as Record<string, unknown>),
  get: (id: string) => getOne(`/payloads/${id}`),
  create: (data: unknown) => createOne("/payloads", data),
  update: (id: string, data: unknown) => updateOne(`/payloads/${id}`, data),
  remove: (id: string) => deleteOne(`/payloads/${id}`),
  use: (id: string) => api.post(`/payloads/${id}/use`).then((r) => r.data),
};

export const scansApi = {
  list: (params?: object) => getList("/scans", params as Record<string, unknown>),
  upload: (engagementId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post(`/scans/upload?engagement_id=${engagementId}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
  remove: (id: string) => deleteOne(`/scans/${id}`),
};

export const activityApi = {
  list: (params?: object) => getList("/activity", params as Record<string, unknown>),
};

export const timeEntriesApi = {
  list: (params?: object) => getList("/time-entries", params as Record<string, unknown>),
  create: (data: unknown) => createOne("/time-entries", data),
  update: (id: string, data: unknown) => updateOne(`/time-entries/${id}`, data),
  start: (id: string) => api.post(`/time-entries/${id}/start`).then((r) => r.data),
  stop: (id: string) => api.post(`/time-entries/${id}/stop`).then((r) => r.data),
  remove: (id: string) => deleteOne(`/time-entries/${id}`),
};

export const reportsApi = {
  list: (params?: object) => getList("/reports", params as Record<string, unknown>),
  generate: (engagementId: string, options: Record<string, string>) =>
    createOne("/reports/generate", { engagement_id: engagementId, ...options }),
  get: (id: string) => getOne(`/reports/${id}`),
  remove: (id: string) => deleteOne(`/reports/${id}`),
  downloadUrl: (id: string) => `/api/v1/reports/${id}/download`,
};

export const backupsApi = {
  list: () => getList("/backups"),
  trigger: () => api.post("/backups/create").then((r) => r.data),
};

export const watchPathsApi = {
  list: () => getList("/watch-paths"),
  create: (data: unknown) => createOne("/watch-paths", data),
  update: (id: string, data: unknown) => updateOne(`/watch-paths/${id}`, data),
  remove: (id: string) => deleteOne(`/watch-paths/${id}`),
};

export const searchApi = {
  search: (q: string) => getList("/search", { q }),
};

export const scopeApi = {
  list: (params?: object) => getList("/scope", params as Record<string, unknown>),
  create: (data: unknown) => createOne("/scope", data),
  update: (id: string, data: unknown) => updateOne(`/scope/${id}`, data),
  remove: (id: string) => deleteOne(`/scope/${id}`),
};

export const settingsApi = {
  list: () => getList("/settings"),
  set: (key: string, value: string | null) => api.put(`/settings/${key}`, { value }).then((r) => r.data),
};

export const healthApi = {
  check: () => getOne("/health"),
};
