const PROFILE = {
  name: "ちくわぁ",
  username: "chikuwa.net",
  nickname: "ちょん",
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
        <div class="profile-user"><span class="u"></span><span class="dot">•</span><span class="n"></span></div>
        <button type="button" class="profile-copy">Copy username</button>
      </div>
    </div>
  </div>`;
const q = (s) => wrap.querySelector(s);
q(".profile-name").textContent = PROFILE.name;
q(".profile-user .u").textContent = PROFILE.username;
q(".profile-user .n").textContent = PROFILE.nickname;
root.appendChild(wrap);

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
