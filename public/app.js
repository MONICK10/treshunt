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

function renderStatus(status) {
  currentStatus = status;
  loginCard.style.display = "none";
  gameCard.style.display = "block";
  teamNameEl.textContent = status.teamName;

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
    clueArea.innerHTML = `
      <div class="finish-banner">
        <div class="big">🏁</div>
        <p class="msg-good">You made it home! Show this screen to the organizers.</p>
      </div>`;
    scanSection.style.display = "none";
    stopScanner();
  } else if (status.currentClue) {
    clueArea.innerHTML = `
      <div class="stop-badge">${status.currentClue.label}</div>
      <div class="riddle">${status.currentClue.riddle}</div>
      <div class="verse">${status.currentClue.verse}</div>
    `;
    scanSection.style.display = "block";
  }

  renderTimer(status);
  renderTrail(status);
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
    if (pendingLoc) await submitScan(pendingLoc);
    return true;
  }
  return false;
}

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
  if (pendingLoc) await submitScan(pendingLoc);
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  clearInterval(timerInterval);
  await stopScanner();
  stopGeoTracking();
  gameCard.style.display = "none";
  trailCard.style.display = "none";
  timerBadge.style.display = "none";
  loginCard.style.display = "block";
});

document.getElementById("password")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("login-btn").click();
});

tryResume();
