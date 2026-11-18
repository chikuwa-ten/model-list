import { SITE_TITLE } from "./config.js";
import { loadIndex, modelUrl, fileUrl, pageUrl, fmtNum, el, icon, isLocalDev, saveImages } from "./common.js";
import { getAllStats } from "./api.js";
import { setupToolbar } from "./toolbar.js";
import { loadBBModel, disposeObject } from "./bbmodel-loader.js";
import { renderThumbnail, renderShareImage } from "./viewer.js";
document.title = SITE_TITLE;
const grid = document.getElementById("grid");
const search = document.getElementById("search");
const status = document.getElementById("status");
let models = [];
let stats = {};
const cards = new Map();
function thumbObserver() {
  return new IntersectionObserver((entries, obs) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      obs.unobserve(e.target);
      const m = e.target._model;
      const img = e.target.querySelector("img");
      loadBBModel(modelUrl(m)).then(async (obj) => {
        const thumb = await renderThumbnail(obj, 512);
        if (!m.thumbnail) img.src = thumb;
        if (isLocalDev && m.needsImages) await saveImages(m.id, { thumb, share: await renderShareImage(obj) });
        disposeObject(obj);
      }).catch((err) => {
        console.warn(m.id, err);
        e.target.classList.add("thumb-error");
      }).finally(() => e.target.classList.remove("loading"));
    }
  }, { rootMargin: "200px" });
}
const observer = thumbObserver();
function makeCard(m) {
  const thumbBox = el("div", { class: "thumb loading" }, el("img", { alt: "", loading: "lazy" }));
  thumbBox._model = m;
  if (m.thumbnail) {
    thumbBox.querySelector("img").src = `${fileUrl(m, m.thumbnail)}?v=${m.thumbVersion}`;
    thumbBox.classList.remove("loading");
  }
  if (!m.thumbnail || isLocalDev && m.needsImages) observer.observe(thumbBox);
  const views = el("span", { class: "stat" }, icon("eye"), el("span", { class: "n" }, "–"));
  const favs = el("span", { class: "stat" }, icon("heart"), el("span", { class: "n" }, "–"));
  const card = el(
    "a",
    { class: "card", href: pageUrl(m) },
    thumbBox,
    el(
      "div",
      { class: "card-body" },
      el("h2", { class: "card-title" }, m.title),
      el("div", { class: "card-meta" }, views, favs)
    )
  );
  card._views = views.querySelector(".n");
  card._favs = favs.querySelector(".n");
  return card;
}
function applyStats() {
  for (const [id, card] of cards) {
    const s = stats[id];
    card._views.textContent = fmtNum(s?.views ?? 0);
    card._favs.textContent = fmtNum(s?.favorites ?? 0);
  }
}
function render() {
  const q = search.value.trim().toLowerCase();
  const list = models.filter((m) => !q || m.title.toLowerCase().includes(q) || m.id.includes(q) || (m.tags || []).some((t) => t.toLowerCase().includes(q)));
  const key = toolbar.sortKey;
  const val = (m, k) => stats[m.id]?.[k] ?? 0;
  list.sort((a, b) => {
    if (key === "views" || key === "favorites") return val(b, key) - val(a, key) || (b.date || "").localeCompare(a.date || "");
    if (key === "title") return a.title.localeCompare(b.title, "ja");
    return (b.date || "").localeCompare(a.date || "");
  });
  grid.replaceChildren(...list.map((m) => cards.get(m.id)));
  status.textContent = list.length ? "" : models.length ? "No matching models" : "No models yet";
}
async function main() {
  try {
    models = await loadIndex();
  } catch (e) {
    status.textContent = e.message;
    return;
  }
  for (const m of models) cards.set(m.id, makeCard(m));
  render();
  try {
    stats = await getAllStats();
  } catch (e) {
    console.warn("Stats API unavailable", e);
    return;
  }
  applyStats();
  if (toolbar.sortKey === "views" || toolbar.sortKey === "favorites") render();
}
const toolbar = setupToolbar({
  onSearch: () => render(),
  onSort: () => render(),
});
main();
