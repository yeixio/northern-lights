export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin", headers: {} };
  if (body instanceof FormData) init.body = body;
  else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)["Content-Type"] = "application/json";
  }
  const res = await fetch(url, init);
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T = { ok: true }>(url: string, body?: unknown) => request<T>("POST", url, body),
  patch: <T = { ok: true }>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  put: <T = { ok: true }>(url: string, body?: unknown) => request<T>("PUT", url, body),
  del: <T = { ok: true }>(url: string) => request<T>("DELETE", url),
};

export const errorText = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong");
