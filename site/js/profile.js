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
