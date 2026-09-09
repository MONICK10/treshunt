const loginCard = document.getElementById("login-card");
const gameCard = document.getElementById("game-card");
const trailCard = document.getElementById("trail-card");
const trailList = document.getElementById("trail-list");
const loginError = document.getElementById("login-error");
const scanResult = document.getElementById("scan-result");
const clueArea = document.getElementById("clue-area");
const progressTrack = document.getElementById("progress-track");
const progressText = document.getElementById("progress-text");
const timerText = document.getElementById("timer-text");
const timerBadge = document.getElementById("timer-badge");
const teamNameEl = document.getElementById("team-name");

const scanSection = document.getElementById("scan-section");
const scanBtn = document.getElementById("scan-btn");
const scanControls = document.getElementById("scan-controls");
const scanCancel = document.getElementById("scan-cancel");
const qrReaderEl = document.getElementById("qr-reader");
const manualToggle = document.getElementById("manual-toggle");
const manualEntry = document.getElementById("manual-entry");
const manualCode = document.getElementById("manual-code");
const manualSubmit = document.getElementById("manual-submit");

const geoNote = document.getElementById("geo-note");

const nameCard = document.getElementById("name-card");
const teamNameInput = document.getElementById("team-name-input");
const nameSaveBtn = document.getElementById("name-save-btn");
const nameError = document.getElementById("name-error");
const editNameBtn = document.getElementById("edit-name-btn");
const resultCard = document.getElementById("result-card");

const celebrateEl = document.getElementById("celebrate");
const confettiEl = document.getElementById("confetti");
const celebrateTitle = document.getElementById("celebrate-title");
const celebrateClose = document.getElementById("celebrate-close");

let timerInterval = null;
let currentStatus = null;
let html5Qr = null;
let handlingDecode = false;
let geoWatchId = null;
let lastGeoSent = 0;

// If we arrived here via a QR-code scan, the URL will look like ?loc=CANTEEN.
// Stash it so we can submit the scan right after login if needed.
const urlParams = new URLSearchParams(window.location.search);
const pendingLoc = urlParams.get("loc");

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ---------- QR helpers ----------

// A location QR encodes a URL like https://mysite.com/?loc=CS_DEPT, but we also
// accept a bare "?loc=CS_DEPT" fragment or just the raw ID text.
function extractLoc(text) {
  if (!text) return null;
  const raw = String(text).trim();

  try {
    const u = new URL(raw);
    const p = u.searchParams.get("loc");
    if (p) return p.trim();
  } catch (e) {
    /* not a full URL — fall through */
  }

  const m = raw.match(/[?&]loc=([^&#\s]+)/i);
  if (m) return decodeURIComponent(m[1]).trim();

  return raw; // assume the QR just holds the bare location ID
}

async function stopScanner() {
  if (html5Qr) {
    try { await html5Qr.stop(); } catch (e) { /* already stopped */ }
    try { html5Qr.clear(); } catch (e) { /* ignore */ }
    html5Qr = null;
  }
  qrReaderEl.style.display = "none";
  scanControls.style.display = "none";
  scanBtn.style.display = "block";
  handlingDecode = false;
}

async function startScanner() {
  if (typeof Html5Qrcode === "undefined") {
    scanResult.innerHTML = `<p class="msg-bad">Scanner failed to load. Use "type the code instead".</p>`;
    return;
  }
  scanResult.innerHTML = "";
  qrReaderEl.style.display = "block";
  scanControls.style.display = "block";
  scanBtn.style.display = "none";
  handlingDecode = false;

  html5Qr = new Html5Qrcode("qr-reader");
  try {
    await html5Qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      (decodedText) => onDecode(decodedText),
      () => { /* per-frame decode failure — ignore */ }
    );
  } catch (e) {
    scanResult.innerHTML = `<p class="msg-bad">Couldn't open the camera. Try "type the code instead".</p>`;
    await stopScanner();
  }
}

async function onDecode(decodedText) {
  if (handlingDecode) return;
  handlingDecode = true;

  const loc = extractLoc(decodedText);
  await stopScanner();
  if (loc) await submitScan(loc);
}

// ---------- render ----------

function renderTimer(status) {
  clearInterval(timerInterval);

  if (!status || !status.startedAt) {
    timerBadge.style.display = "none";
    timerText.textContent = "";
    return;
  }

  const start = new Date(status.startedAt).getTime();
  timerBadge.style.display = "block";
  timerBadge.classList.toggle("done", !!status.finishedAt);

  const update = () => {
    const end = status.finishedAt ? new Date(status.finishedAt).getTime() : Date.now();
    const label = `⏱ ${fmtElapsed(end - start)}`;
    timerBadge.textContent = label;
    timerText.textContent = label;
  };
  update();
  if (!status.finishedAt) timerInterval = setInterval(update, 1000);
}

function renderTrail(status) {
  if (!status || !status.trail || !status.trail.length) {
    trailCard.style.display = "none";
    return;
  }
  trailCard.style.display = "block";
  trailList.innerHTML = "";
  for (const point of status.trail) {
    const li = document.createElement("li");
    li.className = point.done ? "done" : "";

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.textContent = point.done ? "✓" : point.number;

    const place = document.createElement("span");
    place.className = "place";
    place.textContent = point.done ? `${point.number}. ${point.name}` : "Locked until you reach it";

    li.appendChild(dot);
    li.appendChild(place);
    trailList.appendChild(li);
  }
}

function esc(s) {
  return String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function teamLabel(status) {
  return (status && (status.displayName || status.teamName)) || "Your Team";
}

// True while the team still has to pick a name (only possible before the
// clock starts).
function needsName(status) {
  return !!status && !status.displayName && !status.startedAt && !status.done;
}

function renderStatus(status) {
  currentStatus = status;
  loginCard.style.display = "none";

  // Step 1 — name the team. Shown only before the run starts.
  if (needsName(status)) {
    nameCard.style.display = "block";
    gameCard.style.display = "none";
    trailCard.style.display = "none";
    resultCard.style.display = "none";
    timerBadge.style.display = "none";
    teamNameInput.focus();
    return;
  }
  nameCard.style.display = "none";
  gameCard.style.display = "block";

  teamNameEl.textContent = teamLabel(status);
  editNameBtn.style.display = status.nameLocked ? "none" : "inline";

  progressTrack.innerHTML = "";
  for (let i = 0; i < status.totalStops; i++) {
    const seg = document.createElement("div");
    seg.className = "seg" + (i < status.stopsCompleted ? " done" : "");
    progressTrack.appendChild(seg);
  }
  progressText.textContent = status.done
    ? `Completed all ${status.totalStops} stops!`
    : `Stop ${status.stopsCompleted + 1} of ${status.totalStops}`;

  if (status.done) {
    clueArea.innerHTML = "";
    scanSection.style.display = "none";
    stopScanner();
    renderTimer(status);
    renderResult(status);
    maybeCelebrate(status);
    return;
  }

  if (status.currentClue) {
    clueArea.innerHTML = `
      <div class="stop-badge">${status.currentClue.label}</div>
      <div class="riddle">${status.currentClue.riddle}</div>
      <div class="verse">${status.currentClue.verse}</div>
    `;
    scanSection.style.display = "block";
  }

  resultCard.style.display = "none";
  renderTimer(status);
  renderTrail(status);
}

// ---------- finish result board ----------

function renderResult(status) {
  trailCard.style.display = "none";
  resultCard.style.display = "block";

  const start = status.startedAt ? new Date(status.startedAt).getTime() : null;
  const finish = status.finishedAt ? new Date(status.finishedAt).getTime() : null;
  const totalMs = start != null && finish != null ? finish - start : null;

  // Split time between each scanned stop (skipping the very first CS Dept scan,
  // which is the start line itself).
  const stops = (status.trail || []).filter((p) => p.done && p.at && p.number > 1);
  const lastNumber = status.totalStops;
  let prev = start;
  const rows = stops
    .map((p) => {
      const t = new Date(p.at).getTime();
      const split = prev != null ? t - prev : null;
      prev = t;
      const label = p.number === lastNumber ? "🏁" : String(p.number - 1);
      return `<li>
        <span class="res-n">${label}</span>
        <span class="res-place">${p.name}</span>
        <span class="res-split">${split != null ? fmtElapsed(split) : "—"}</span>
      </li>`;
    })
    .join("");

  resultCard.innerHTML = `
    <div class="result-head">
      <div class="result-emoji">🏁</div>
      <div class="result-team">${esc(teamLabel(status))}</div>
      <div class="result-sub">Finished all ${status.totalStops} stops</div>
    </div>
    <div class="result-time">
      <div class="result-time-num">${totalMs != null ? fmtElapsed(totalMs) : "—"}</div>
      <div class="result-time-lbl">total time</div>
    </div>
    <div class="result-meta">Finished at ${
      finish != null ? new Date(finish).toLocaleTimeString() : "—"
    }</div>
    <ol class="result-stops">
      <li class="result-stops-head"><span class="res-n">#</span><span class="res-place">Stop</span><span class="res-split">Split</span></li>
      ${rows}
    </ol>
    <p class="footnote" style="margin-top:14px;">Show this screen to the organizers.</p>
  `;
}

// ---------- one-time celebration ----------

function maybeCelebrate(status) {
  const key = "th_celebrated_" + status.teamNumber;
  let already = false;
  try { already = localStorage.getItem(key) === "1"; } catch (e) { /* private mode */ }
  if (already) return;
  try { localStorage.setItem(key, "1"); } catch (e) { /* ignore */ }

  celebrateTitle.textContent = teamLabel(status) + " — you made it!";
  celebrateEl.hidden = false;
  launchConfetti();
}

function launchConfetti() {
  confettiEl.innerHTML = "";
  const colors = ["#f0c14b", "#ffdd7a", "#4ade80", "#ffffff", "#ff9f45", "#7ab8ff"];
  for (let i = 0; i < 130; i++) {
    const piece = document.createElement("i");
    piece.className = "confetti-piece";
    piece.style.left = (Math.random() * 100).toFixed(2) + "%";
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = (Math.random() * 0.7).toFixed(2) + "s";
    piece.style.animationDuration = (2.2 + Math.random() * 2).toFixed(2) + "s";
    confettiEl.appendChild(piece);
  }
  setTimeout(() => { confettiEl.innerHTML = ""; }, 5000);
}

async function submitScan(loc) {
  const { ok, data } = await api("/api/scan", {
    method: "POST",
    body: JSON.stringify({ loc }),
  });
  if (!ok) return;

  if (data.result === "correct") {
    scanResult.innerHTML = `<p class="msg-good">✅ Correct spot! Here's your next clue.</p>`;
  } else if (data.result === "wrong_location") {
    scanResult.innerHTML = `<p class="msg-bad">❌ That's not your next stop. Re-read your clue!</p>`;
  } else if (data.result === "already_finished") {
    scanResult.innerHTML = "";
  }
  renderStatus(data.status);

  // Clean the ?loc= param out of the URL so a refresh doesn't re-submit it.
  const clean = window.location.pathname;
  window.history.replaceState({}, "", clean);

  setTimeout(() => (scanResult.innerHTML = ""), 6000);
}

async function tryResume() {
  const { ok, data } = await api("/api/me");
  if (ok) {
    renderStatus(data);
    startGeoTracking();
    // Don't auto-submit a pending scan while the team still has to name itself
    // — that would start their clock before they've picked a name.
    if (pendingLoc && !needsName(data)) await submitScan(pendingLoc);
    return true;
  }
  return false;
}

// ---------- team name ----------

async function saveTeamName() {
  nameError.textContent = "";
  const name = teamNameInput.value.trim();
  if (name.length < 2) {
    nameError.textContent = "Enter a team name (at least 2 characters).";
    return;
  }
  const { ok, data } = await api("/api/team/name", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (!ok) {
    nameError.textContent =
      data && data.error === "name_locked"
        ? "Too late to rename — your run has already started."
        : "Couldn't save that name. Try again.";
    if (data && data.status) renderStatus(data.status);
    return;
  }
  renderStatus(data.status);
  if (pendingLoc && !needsName(data.status)) await submitScan(pendingLoc);
}

nameSaveBtn.addEventListener("click", saveTeamName);
teamNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveTeamName();
});

editNameBtn.addEventListener("click", () => {
  if (currentStatus && currentStatus.nameLocked) return;
  teamNameInput.value = (currentStatus && currentStatus.displayName) || "";
  nameError.textContent = "";
  nameCard.style.display = "block";
  gameCard.style.display = "none";
  trailCard.style.display = "none";
  resultCard.style.display = "none";
  teamNameInput.focus();
});

celebrateClose.addEventListener("click", () => {
  celebrateEl.hidden = true;
  confettiEl.innerHTML = "";
});

// ---------- optional live location sharing ----------
// Opt-in: if the team allows it, their phone streams GPS to the admin map.
// Denied / unsupported / offline all fail silently — the game is unaffected.

function startGeoTracking() {
  if (geoWatchId != null || !("geolocation" in navigator)) return;

  if (geoNote) {
    geoNote.textContent =
      "Enable location so organizers can see your team on the live map — this also helps in an emergency.";
    geoNote.style.display = "block";
  }

  geoWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (geoNote) geoNote.style.display = "none";
      const now = Date.now();
      if (now - lastGeoSent < 12000) return; // throttle: at most ~1 send / 12s
      lastGeoSent = now;
      api("/api/location", {
        method: "POST",
        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      }).catch(() => {});
    },
    () => {
      if (geoNote) geoNote.style.display = "none"; // denied / unavailable — ignore
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  );
}

function stopGeoTracking() {
  if (geoWatchId != null && "geolocation" in navigator) {
    navigator.geolocation.clearWatch(geoWatchId);
  }
  geoWatchId = null;
  lastGeoSent = 0;
  if (geoNote) geoNote.style.display = "none";
}

// ---------- events ----------

scanBtn.addEventListener("click", startScanner);
scanCancel.addEventListener("click", stopScanner);

manualToggle.addEventListener("click", () => {
  const showing = manualEntry.style.display === "block";
  manualEntry.style.display = showing ? "none" : "block";
  if (!showing) manualCode.focus();
});

manualSubmit.addEventListener("click", async () => {
  const code = extractLoc(manualCode.value);
  if (!code) return;
  manualCode.value = "";
  manualEntry.style.display = "none";
  await submitScan(code);
});

manualCode.addEventListener("keydown", (e) => {
  if (e.key === "Enter") manualSubmit.click();
});

document.getElementById("login-btn").addEventListener("click", async () => {
  loginError.textContent = "";
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  if (!username || !password) {
    loginError.textContent = "Enter both username and password.";
    return;
  }
  const { ok, data } = await api("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (!ok) {
    loginError.textContent = "Wrong username or password. Try again.";
    return;
  }
  renderStatus(data);
  startGeoTracking();
  if (pendingLoc && !needsName(data)) await submitScan(pendingLoc);
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  clearInterval(timerInterval);
  await stopScanner();
  stopGeoTracking();
  gameCard.style.display = "none";
  nameCard.style.display = "none";
  trailCard.style.display = "none";
  resultCard.style.display = "none";
  celebrateEl.hidden = true;
  timerBadge.style.display = "none";
  loginCard.style.display = "block";
});

document.getElementById("password")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("login-btn").click();
});

tryResume();
