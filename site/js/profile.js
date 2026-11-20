const PROFILE = {
  name: "ちくわぁ",
  username: "chikuwa.net",
  userId: "790371513391251487",
  status: "img/status.webp",
  avatar: "img/avatar.webp",
  cardAvatar: "img/avatar-full.webp",
};

const root = document.querySelector(".site-header");
const wrap = document.createElement("div");
wrap.className = "profile";
wrap.innerHTML = `
  <button type="button" class="profile-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="Profile">
    <img src="${PROFILE.avatar}" alt="">
  </button>
  <div class="profile-card" role="dialog" aria-label="Discord profile" hidden>
    <div class="profile-inner">
      <div class="profile-banner"></div>
      <img class="profile-avatar" src="${PROFILE.cardAvatar}" alt="">
      <div class="profile-status" aria-hidden="true"><img src="${PROFILE.status}" alt=""></div>
      <div class="profile-body">
        <div class="profile-name"></div>
        <div class="profile-user"><span class="u"></span></div>
        <a class="profile-add" target="_blank" rel="noopener" hidden>Contact</a>
        <button type="button" class="profile-copy">Copy username</button>
      </div>
    </div>
  </div>`;
const q = (s) => wrap.querySelector(s);
q(".profile-name").textContent = PROFILE.name;
q(".profile-user .u").textContent = PROFILE.username;
if (PROFILE.userId) {
  const add = q(".profile-add");
  add.href = `https://discord.com/users/${PROFILE.userId}`;
  add.hidden = false;
}
root.appendChild(wrap);

const DL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 3h2v9.2l3.6-3.6 1.4 1.4-6 6-6-6 1.4-1.4 3.6 3.6V3ZM4 19h16v2H4v-2Z"/></svg>';
const about = document.createElement("div");
about.className = "about";
about.innerHTML = `
  <button type="button" class="about-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="About this site">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 10h2v7h-2v-7Zm0-3h2v2h-2V7Zm1-5a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z"/></svg>
  </button>
  <div class="about-card" role="dialog" aria-label="About this site" hidden>
    <p class="about-title">About</p>
    <p>This site is where chikuwaten keeps the models made in Blockbench.</p>
    <p class="about-sub">The mark on each model in the list shows whether it can be downloaded:</p>
    <ul class="about-legend">
      <li><span class="about-mark ok">${DL_SVG}</span>Downloadable</li>
      <li><span class="about-mark ng">${DL_SVG}</span>View only</li>
    </ul>
    <p class="about-date">Launched 2026/11/18</p>
  </div>`;
root.appendChild(about);
const aboutBtn = about.querySelector(".about-btn");
const aboutCard = about.querySelector(".about-card");
function setAbout(open) {
  aboutCard.hidden = !open;
  aboutBtn.setAttribute("aria-expanded", String(open));
}
aboutBtn.addEventListener("click", () => setAbout(aboutCard.hidden));
document.addEventListener("click", (e) => { if (!about.contains(e.target)) setAbout(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setAbout(false); });
wrap.querySelectorAll("img").forEach((img) => (img.draggable = false));
wrap.addEventListener("contextmenu", (e) => e.preventDefault());

const btn = q(".profile-btn");
const card = q(".profile-card");
const copy = q(".profile-copy");
function setOpen(open) {
  card.hidden = !open;
  btn.setAttribute("aria-expanded", String(open));
}
btn.addEventListener("click", () => setOpen(card.hidden));
document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) setOpen(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(PROFILE.username);
    copy.textContent = "Copied!";
  } catch {
    copy.textContent = PROFILE.username;
  }
  setTimeout(() => (copy.textContent = "Copy username"), 1500);
});
