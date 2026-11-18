import { API_BASE } from "./config.js";
const KEY = "mg_visitor_id";
let memoryId = null;
function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = b[6] & 15 | 64;
  b[8] = b[8] & 63 | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function visitorId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return memoryId ??= newId();
  }
}
async function call(path, options = {}) {
  if (!API_BASE) throw new Error("API not configured");
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers || {} }
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = body.error;
    throw err;
  }
  return body;
}
async function getAllStats() {
  const r = await call("/api/stats");
  return r.stats || {};
}
function recordView(id) {
  return call(`/api/models/${encodeURIComponent(id)}/view`, {
    method: "POST",
    body: JSON.stringify({ visitor: visitorId() })
  });
}
function setFavorite(id, favorite) {
  return call(`/api/models/${encodeURIComponent(id)}/favorite`, {
    method: "POST",
    body: JSON.stringify({ visitor: visitorId(), favorite })
  });
}
export {
  getAllStats,
  recordView,
  setFavorite,
  visitorId
};
