// Single fetch wrapper for the Node API (docs/API_CONTRACT.md §2).
// VITE_USE_MOCK: anything except "false" → built-in demo data (keeps the Vercel demo working without a backend).
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000/api").replace(/\/$/, "");
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

export function qs(params = {}) {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") s.set(k, v);
  });
  const str = s.toString();
  return str ? `?${str}` : "";
}

async function toApiError(res) {
  let code = "SERVER_ERROR";
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) {
      code = body.error.code || code;
      message = body.error.message || message;
    }
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(res.status, code, message);
}

const networkError = () => new ApiError(0, "NETWORK_ERROR", "Cannot reach the SIF-Guard server. Is the backend running?");

export async function request(path, { method = "GET", body, params, raw = false, skipAuthRedirect = false } = {}) {
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(`${API_URL}${path}${qs(params)}`, {
      method,
      credentials: "include",
      headers: body !== undefined && !isForm ? { "Content-Type": "application/json" } : undefined,
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw networkError();
  }
  if (!res.ok) {
    const err = await toApiError(res);
    if (res.status === 401 && !skipAuthRedirect) onUnauthorized?.();
    throw err;
  }
  if (raw) return res;
  if (res.status === 204) return null;
  return res.json();
}

// multipart upload with progress (fetch has no upload progress events)
export function uploadWithProgress(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body);
      if (xhr.status === 401) onUnauthorized?.();
      reject(new ApiError(xhr.status, body?.error?.code || "SERVER_ERROR", body?.error?.message || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(networkError());
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

export function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadFile(path, params, fallbackName) {
  const res = await request(path, { params, raw: true });
  const blob = await res.blob();
  const match = (res.headers.get("Content-Disposition") || "").match(/filename="?([^"]+)"?/);
  const name = match?.[1] || fallbackName;
  saveBlob(blob, name);
  return name;
}
