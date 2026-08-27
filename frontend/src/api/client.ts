import axios, { type InternalAxiosRequestConfig } from "axios";

export interface AuthUser {
  id: string;
  username: string;
  email?: string | null;
  display_name?: string | null;
  role: "admin" | "penetration_tester" | "client";
  is_active: boolean;
  client_id?: string | null;
  auth_provider: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  user: AuthUser;
}

export const ACCESS_TOKEN_STORAGE_KEY = "ptd.access_token";
export const REFRESH_TOKEN_STORAGE_KEY = "ptd.refresh_token";

let accessToken =
  typeof window !== "undefined" ? window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) : null;

const api = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

const authApiClient = axios.create({
  baseURL: "/api/v1",
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

function getStorage() {
  return typeof window !== "undefined" ? window.localStorage : null;
}

export function getStoredAccessToken() {
  return getStorage()?.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? null;
}

export function getStoredRefreshToken() {
  return getStorage()?.getItem(REFRESH_TOKEN_STORAGE_KEY) ?? null;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  const storage = getStorage();
  if (!storage) return;
  if (token) {
    storage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  } else {
    storage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}

export function setStoredTokens(tokens: Pick<AuthTokenResponse, "access_token" | "refresh_token">) {
  setAccessToken(tokens.access_token);
  const storage = getStorage();
  storage?.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refresh_token);
}

export function clearStoredTokens() {
  setAccessToken(null);
  getStorage()?.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.set("Authorization", ["Bearer", accessToken].join(" "));
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken() {
  if (!refreshPromise) {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) return null;
    refreshPromise = authApiClient
      .post<AuthTokenResponse>("/auth/refresh", { refresh_token: refreshToken })
      .then((response) => {
        setStoredTokens(response.data);
        return response.data.access_token;
      })
      .catch(() => {
        clearStoredTokens();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;
    if (!originalRequest || status !== 401 || originalRequest._retry) {
      throw error;
    }
    if (originalRequest.url?.includes("/auth/login") || originalRequest.url?.includes("/auth/refresh")) {
      throw error;
    }
    originalRequest._retry = true;
    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) {
      throw error;
    }
    originalRequest.headers.set("Authorization", ["Bearer", newAccessToken].join(" "));
    return api(originalRequest);
  }
);

// ── Generic helpers ──────────────────────────────────────────────────────────

export const getList = (path: string, params?: Record<string, unknown>) =>
  api.get(path, { params }).then((r) => r.data);

export const getOne = (path: string) => api.get(path).then((r) => r.data);

export const createOne = (path: string, data: unknown) =>
  api.post(path, data).then((r) => r.data);

export const updateOne = (path: string, data: unknown) =>
  api.patch(path, data).then((r) => r.data);

export const deleteOne = (path: string) => api.delete(path).then((r) => r.data);

export const downloadFile = async (path: string, filename: string) => {
  const response = await api.get(path, { responseType: "blob" });
  const url = window.URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
};

export const authApi = {
  login: (credentials: { username: string; password: string }) =>
    authApiClient.post<AuthTokenResponse>("/auth/login", credentials).then((r) => r.data),
  refresh: (refreshToken?: string) =>
    authApiClient
      .post<AuthTokenResponse>("/auth/refresh", refreshToken ? { refresh_token: refreshToken } : {})
      .then((r) => r.data),
  logout: (refreshToken?: string) =>
    authApiClient.post("/auth/logout", refreshToken ? { refresh_token: refreshToken } : {}),
  me: () => api.get<AuthUser>("/auth/me").then((r) => r.data),
};

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
  downloadUrl: (id: string) => `/api/v1/evidence/${id}/download`,
  upload: (engagementId: string, title: string, evidenceType: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post(
        `/evidence/upload?engagement_id=${engagementId}&title=${encodeURIComponent(title)}&evidence_type=${evidenceType}`,
        form,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      )
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
  downloadUrl: (id: string) => `/api/v1/backups/${id}/download`,
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
