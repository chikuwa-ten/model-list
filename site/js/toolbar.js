export function setupToolbar({ onSearch, onSort }) {
  const search = document.getElementById("search");
  const sort = document.getElementById("sort");
  const btn = sort.querySelector(".dropdown-btn");
  const menu = sort.querySelector(".dropdown-menu");
  const items = [...menu.querySelectorAll("[data-sort]")];
  const state = { sortKey: "title" };

  function selectSort(key) {
    const li = items.find((x) => x.dataset.sort === key) || items[0];
    state.sortKey = li.dataset.sort;
    items.forEach((x) => x.setAttribute("aria-selected", String(x === li)));
    sort.querySelector(".dropdown-label").textContent = li.textContent;
  }
  function setMenu(open) {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  }

  const params = new URLSearchParams(location.search);
  search.value = params.get("q") || "";
  selectSort(params.get("sort") || "title");

  btn.addEventListener("click", () => setMenu(menu.hidden));
  menu.addEventListener("click", (e) => {
    const li = e.target.closest("[data-sort]");
    if (!li) return;
    selectSort(li.dataset.sort);
    setMenu(false);
    onSort(state.sortKey);
  });
  document.addEventListener("click", (e) => {
    if (!sort.contains(e.target)) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
  });
  search.addEventListener("input", () => onSearch(search.value, false));
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") onSearch(search.value, true);
  });
  return state;
}

export function listUrl(q, sortKey) {
  const p = new URLSearchParams();
  if (q.trim()) p.set("q", q.trim());
  if (sortKey && sortKey !== "title") p.set("sort", sortKey);
  const s = p.toString();
  return new URL(s ? `./?${s}` : "./", document.baseURI).href;
}
