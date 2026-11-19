import { SITE_TITLE } from "./config.js";
import { loadIndex, modelUrl, fileUrl, fmtNum, fmtSize, el, icon } from "./common.js";
import { recordView, setFavorite } from "./api.js";
import { setupToolbar, listUrl } from "./toolbar.js";
import { fetchBBModel, buildBBModel } from "./bbmodel-loader.js";
import { javaModelBlob, textureFiles } from "./export.js";
import { ModelViewer } from "./viewer.js";
const $ = (id2) => document.getElementById(id2);
const id = document.querySelector('meta[name="model-id"]')?.content || new URLSearchParams(location.search).get("id");
const state = { views: null, favorites: null, favorited: false, busy: false, apiOk: false };
function renderStats() {
  $("views").textContent = fmtNum(state.views);
  $("favorites").textContent = fmtNum(state.favorites);
  const btn = $("fav-btn");
  btn.classList.toggle("on", state.favorited);
  btn.setAttribute("aria-pressed", String(state.favorited));
  btn.disabled = state.busy || !state.apiOk;
  btn.replaceChildren(icon(state.favorited ? "heart" : "heartOutline"));
}
function applyServer(r) {
  state.views = r.views;
  state.favorites = r.favorites;
  state.favorited = !!r.favorited;
  state.apiOk = true;
}
async function toggleFavorite() {
  if (state.busy) return;
  const next = !state.favorited;
  const prev = { ...state };
  state.favorited = next;
  state.busy = true;
  renderStats();
  try {
    const r = await setFavorite(id, next);
    state.favorited = !!r.favorited;
    state.favorites = r.favorites;
    state.apiOk = true;
  } catch (e) {
    console.warn("Failed to update like", e);
    Object.assign(state, prev);
  } finally {
    state.busy = false;
    renderStats();
  }
}
function notFound(msg) {
  document.title = `Not found - ${SITE_TITLE}`;
  $("main").replaceChildren(el(
    "div",
    { class: "empty" },
    el("p", {}, msg),
    el("a", { href: "./", class: "btn" }, "Back to models")
  ));
}
async function main() {
  if (!id) return notFound("No model specified");
  let m;
  try {
    m = (await loadIndex()).find((x) => x.id === id);
  } catch (e) {
    return notFound(e.message);
  }
  if (!m) return notFound("Model not found");
  document.title = `${m.title} - ${SITE_TITLE}`;
  $("description").textContent = m.description || "";
  $("title").textContent = m.title;
  if (m.date) {
    $("date").dateTime = m.date;
    $("date").textContent = m.date.replace(/-/g, "/");
  }
  const dlButton = (name, size, attrs) => el(
    "a",
    { class: "btn download", download: name, ...attrs },
    icon("download"),
    el("span", { class: "dl-name" }, name),
    el("span", { class: "dl-size" }, fmtSize(size))
  );
  const staticFiles = m.downloads.map((d) => ({ ...d, ext: d.file.split(".").pop().toLowerCase() }));
  const pick = (ext) => staticFiles.filter((d) => d.ext === ext).map((d) => dlButton(d.file, d.size, { href: fileUrl(m, d.file) }));
  const blobButton = (name, blob) => dlButton(name, blob.size, { href: URL.createObjectURL(blob) });
  const group = (label, buttons) => buttons.length ? [el("div", { class: "dl-group" }, el("p", { class: "dl-label" }, label), ...buttons)] : [];
  const renderDownloads = (data, texButtons) => {
    let json = pick("json");
    if (!json.length && data) json = [blobButton(m.model.replace(/\.bbmodel$/i, "") + ".json", javaModelBlob(data))];
    return [
      ...group("bbmodel", pick("bbmodel")),
      ...group("json", json),
      ...group("png", texButtons)
    ];
  };
  if (m.viewOnly) {
    $("terms-list").replaceChildren(el("li", { class: "ng" }, "Download"), el("li", { class: "ng" }, "Use of any kind"));
    $("terms-note").textContent = "This model can only be viewed on this site.";
    $("download-section").remove();
    if (!m.description) $("description").closest(".info").remove();
  } else $("downloads").replaceChildren(...renderDownloads(null, pick("png")));
  $("fav-mark").replaceWith(icon("heartOutline"));
  $("view-mark").replaceWith(icon("eye"));
  renderStats();
  $("fav-btn").addEventListener("click", toggleFavorite);
  const viewer = new ModelViewer($("viewer"));
  const url = new URL(modelUrl(m), document.baseURI).href;
  fetchBBModel(url).then(async (data) => {
    const cubes = (data.elements || []).filter((e) => (e.type || "cube") === "cube").length;
    $("cubes").textContent = `${fmtNum(cubes)} ${cubes === 1 ? "cube" : "cubes"}`;
    if (m.viewOnly) return buildBBModel(data, url);
    const pngs = pick("png");
    const gen = pngs.length ? [] : (await textureFiles(data)).map((t) => blobButton(t.name, t.blob));
    $("downloads").replaceChildren(...renderDownloads(data, [...pngs, ...gen]));
    return buildBBModel(data, url);
  }).then((obj) => {
    viewer.setModel(obj);
    $("viewer").classList.remove("loading");
  }).catch((e) => {
    console.error(e);
    $("viewer").classList.remove("loading");
    $("viewer").classList.add("error");
  });
  try {
    applyServer(await recordView(id));
  } catch (e) {
    console.warn("Stats API unavailable", e);
  }
  renderStats();
}
const toolbar = setupToolbar({
  onSearch: (q, submit) => { if (submit) location.href = listUrl(q, toolbar.sortKey); },
  onSort: (key) => { location.href = listUrl(document.getElementById("search").value, key); },
});
main();
