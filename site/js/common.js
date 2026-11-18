async function loadIndex() {
  const res = await fetch("models/index.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("Failed to load models/index.json");
  const data = await res.json();
  return (data.models || []).map((m) => ({ ...m, title: String(m.title ?? m.id).replace(/_/g, " ") }));
}
const modelUrl = (m) => `models/${encodeURIComponent(m.id)}/${encodeURIComponent(m.model)}`;
const fileUrl = (m, f) => `models/${encodeURIComponent(m.id)}/${encodeURIComponent(f)}`;
const pageUrl = (m) => `m/${encodeURIComponent(m.id)}/`;
const isLocalDev = ["localhost", "127.0.0.1"].includes(location.hostname);
async function saveImages(id, images) {
  if (!isLocalDev) return;
  try {
    await fetch(`__images?id=${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(images)
    });
  } catch (e) {
    console.warn("Failed to save images", e);
  }
}
function fmtNum(n) {
  if (n == null) return "–";
  return new Intl.NumberFormat("en-US", { notation: n >= 1e4 ? "compact" : "standard" }).format(n);
}
function fmtSize(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}
const ICONS = {
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7Zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5 10.6 19.2C5.4 14.5 2 11.4 2 7.6 2 4.5 4.4 2 7.5 2c1.7 0 3.4.8 4.5 2.1A6 6 0 0 1 16.5 2C19.6 2 22 4.5 22 7.6c0 3.8-3.4 6.9-8.6 11.6L12 20.5Z"/></svg>',
  heartOutline: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.5 2A6 6 0 0 0 12 4.1 6 6 0 0 0 7.5 2C4.4 2 2 4.5 2 7.6c0 3.8 3.4 6.9 8.6 11.6L12 20.5l1.4-1.3C18.6 14.5 22 11.4 22 7.6 22 4.5 19.6 2 16.5 2Zm-4.4 15.7-.1.1-.1-.1C7.1 13.4 4 10.6 4 7.6 4 5.6 5.5 4 7.5 4c1.5 0 3 1 3.6 2.4h1.9C13.5 5 15 4 16.5 4c2 0 3.5 1.6 3.5 3.6 0 3-3.1 5.8-7.9 10.1Z"/></svg>',
  download: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v9.2l3.6-3.6 1.4 1.4-6 6-6-6 1.4-1.4 3.6 3.6V3ZM4 19h16v2H4v-2Z"/></svg>'
};
function icon(name) {
  const s = document.createElement("span");
  s.className = "icon";
  s.innerHTML = ICONS[name];
  return s;
}
export {
  ICONS,
  el,
  fileUrl,
  fmtNum,
  fmtSize,
  icon,
  isLocalDev,
  loadIndex,
  modelUrl,
  pageUrl,
  saveImages
};
