// Purely decorative: injects a twinkling starfield layer behind the page
// content. Shared by the cover, play, and admin pages so every screen sits
// on the same dark-navy sky. No game logic here.
(function () {
  if (document.querySelector(".starfield")) return;

  const field = document.createElement("div");
  field.className = "starfield";
  field.setAttribute("aria-hidden", "true");

  const area = window.innerWidth * window.innerHeight;
  const count = Math.max(40, Math.min(160, Math.round(area / 9000)));

  let html = "";
  for (let i = 0; i < count; i++) {
    const size = Math.random() < 0.82 ? 1 : 2;
    const left = (Math.random() * 100).toFixed(2);
    const top = (Math.random() * 100).toFixed(2);
    const delay = (Math.random() * 6).toFixed(2);
    const dur = (3 + Math.random() * 5).toFixed(2);
    html +=
      `<i style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;` +
      `animation-delay:${delay}s;animation-duration:${dur}s"></i>`;
  }
  field.innerHTML = html;

  document.body.insertBefore(field, document.body.firstChild);
})();
