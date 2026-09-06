const loginCard = document.getElementById("login-card");
const boardCard = document.getElementById("board-card");
const mapCard = document.getElementById("map-card");
const loginError = document.getElementById("login-error");
const rowsEl = document.getElementById("rows");
const lastUpdated = document.getElementById("last-updated");
const mapUpdated = document.getElementById("map-updated");
const mapNote = document.getElementById("map-note");

const teamPanel = document.getElementById("team-panel");
const tpHeader = document.getElementById("tp-header");
const tpStops = document.getElementById("tp-stops");

const LOCATION_COORDS = window.LOCATION_COORDS || {};

let pollInterval = null;
let knownTeamCount = 0;

// Leaflet state
let lmap = null;
const markers = {}; // teamNumber -> L.marker

// Per-team detail panel state
let panelTeam = null;
let panelInterval = null;

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
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtStamp(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function setNote(msg) {
  if (msg) {
    mapNote.hidden = false;
    mapNote.textContent = msg;
  } else {
    mapNote.hidden = true;
  }
}

// ---------- all-teams table (unchanged behaviour) ----------

function render(teams) {
  rowsEl.innerHTML = teams
    .map((t, i) => {
      const rank = t.finishedAt ? i + 1 : "—";
      return `
        <tr class="${t.finishedAt ? "finished" : ""}">
          <td>${rank}</td>
          <td>${t.teamName} <span style="color:#8a7857;font-size:0.8em;">(${t.username})</span></td>
          <td>${t.stopsCompleted}/${t.totalStops} — ${t.currentLocationName}</td>
          <td>${fmtTime(t.lastScanAt || t.startedAt)}</td>
          <td>${fmtElapsed(t.elapsedMs)}</td>
        </tr>`;
    })
    .join("");
  lastUpdated.textContent = "Updated " + new Date().toLocaleTimeString();
  knownTeamCount = teams.length;
}

// ---------- Leaflet live-positions map ----------

function allCoords() {
  return Object.values(LOCATION_COORDS)
    .filter((c) => c && typeof c.lat === "number" && typeof c.lng === "number")
    .map((c) => [c.lat, c.lng]);
}

function ensureMap() {
  if (lmap || typeof L === "undefined") return lmap;

  lmap = L.map("live-map", { scrollWheelZoom: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(lmap);

  const all = allCoords();
  if (all.length) lmap.fitBounds(L.latLngBounds(all).pad(0.2));
  else lmap.setView([10.9357, 76.7449], 15);

  return lmap;
}

const LIVE_FRESH_SECONDS = 120;

// A team is shown at its real GPS only while the fix is recent enough.
function isLiveFresh(t) {
  return (
    t.liveLocation &&
    typeof t.liveLocation.lat === "number" &&
    typeof t.liveLocation.staleSeconds === "number" &&
    t.liveLocation.staleSeconds < LIVE_FRESH_SECONDS
  );
}

function teamIcon(finished, teamNumber, isLive) {
  const cls = ["team-marker"];
  if (finished) cls.push("finished");
  if (isLive) cls.push("live");
  return L.divIcon({
    className: "team-marker-wrap",
    html: `<div class="${cls.join(" ")}">T${teamNumber}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

// Fan teams sharing a location onto a small ring so labels stay separate.
function ringOffsets(base, count) {
  if (count <= 1) return [{ lat: base.lat, lng: base.lng }];
  const R = Math.min(0.00012 * Math.sqrt(count / 2), 0.0004); // ~13 m, grows a little with the crowd
  const metresPerDegLng = Math.cos((base.lat * Math.PI) / 180) || 1;
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * 2 * Math.PI - Math.PI / 2;
    return {
      lat: base.lat + R * Math.sin(a),
      lng: base.lng + (R * Math.cos(a)) / metresPerDegLng,
    };
  });
}

function popupHtml(t, isLive) {
  let when;
  if (t.finishedAt) when = "Finished";
  else if (t.lastScanAt) when = "Last scan " + fmtTime(t.lastScanAt);
  else when = "Not started yet";
  const src = isLive
    ? `📍 Live GPS · ${Math.round(t.liveLocation.staleSeconds)}s ago`
    : "Snapped to last scanned stop";
  return (
    `<div class="team-popup"><strong>${t.teamName}</strong><br />${t.locationName}<br />` +
    `<span class="muted">${when}</span><br /><span class="muted">${src}</span></div>`
  );
}

function placeMarker(t, pos, isLive) {
  let m = markers[t.teamNumber];
  if (!m) {
    m = L.marker(pos, { icon: teamIcon(!!t.finishedAt, t.teamNumber, isLive) })
      .bindPopup(popupHtml(t, isLive))
      .addTo(lmap);
    m.on("click", () => openTeamPanel(t.teamNumber));
    markers[t.teamNumber] = m;
  } else {
    m.setLatLng(pos);
    m.setIcon(teamIcon(!!t.finishedAt, t.teamNumber, isLive));
    m.setPopupContent(popupHtml(t, isLive));
  }
}

function renderLive(teams) {
  mapUpdated.textContent = "Updated " + new Date().toLocaleTimeString();

  if (!ensureMap()) {
    setNote("Map library didn't load — the table below still works.");
    return;
  }

  const seen = new Set();
  const missingLocs = new Set();

  // Teams with a fresh phone fix: plot at their real coordinate, no fan-out
  // (real positions are already spread out).
  for (const t of teams) {
    if (!isLiveFresh(t)) continue;
    placeMarker(t, [t.liveLocation.lat, t.liveLocation.lng], true);
    seen.add(t.teamNumber);
  }

  // Everyone else: snap to their last scanned building, fanning apart any
  // teams sharing the same one.
  const byLoc = {};
  for (const t of teams) {
    if (isLiveFresh(t)) continue;
    (byLoc[t.locationId] = byLoc[t.locationId] || []).push(t);
  }
  for (const [locId, group] of Object.entries(byLoc)) {
    const base = LOCATION_COORDS[locId];
    if (!base || typeof base.lat !== "number") {
      group.forEach((t) => missingLocs.add(t.locationName));
      continue;
    }
    const spots = ringOffsets(base, group.length);
    group.forEach((t, i) => {
      placeMarker(t, [spots[i].lat, spots[i].lng], false);
      seen.add(t.teamNumber);
    });
  }

  // remove markers for teams no longer present
  for (const num of Object.keys(markers)) {
    if (!seen.has(Number(num))) {
      lmap.removeLayer(markers[num]);
      delete markers[num];
    }
  }

  setNote(
    missingLocs.size
      ? `No coordinate yet for: ${[...missingLocs].join(", ")} — add it in public/locations-map.js.`
      : ""
  );
}

async function refreshLive() {
  const { ok, data } = await api("/api/admin/live-positions");
  if (ok) renderLive(data.teams || []);
}

// ---------- per-team detail panel ----------

function stopState(s) {
  if (s.scannedAt) return "done";
  if (s.isCurrent) return "current";
  return "upcoming";
}

function renderTeamPanel(d) {
  const stops = d.stops || [];
  const live = d.liveLocation;
  let liveLine;
  if (!live || typeof live.staleSeconds !== "number") {
    liveLine = "Live location: off — using last scanned stop instead";
  } else if (live.staleSeconds < LIVE_FRESH_SECONDS) {
    liveLine = `Live location: active, updated ${Math.round(live.staleSeconds)}s ago`;
  } else {
    liveLine = `Live location: stale (${Math.round(live.staleSeconds / 60)}m ago) — using last scanned stop`;
  }

  tpHeader.innerHTML =
    `<h3 id="tp-title">${d.teamName}</h3>` +
    `<div class="tp-times">` +
    `<span>Elapsed <strong>${fmtElapsed(d.elapsedMs)}</strong></span>` +
    `<span>Start: ${fmtStamp(d.startedAt)}</span>` +
    `<span>Finish: ${fmtStamp(d.finishedAt)}</span>` +
    `<span class="tp-live">${liveLine}</span>` +
    `</div>`;

  tpStops.innerHTML = stops
    .map((s) => {
      const state = stopState(s);
      const meta =
        state === "done"
          ? `✓ ${fmtTime(s.scannedAt)}`
          : state === "current"
          ? "current target"
          : "upcoming";
      return `
        <li class="tp-stop ${state}">
          <span class="tp-n">${s.n}</span>
          <span class="tp-name">${s.name}<span class="tp-label">${s.label}</span></span>
          <span class="tp-meta">${meta}</span>
        </li>`;
    })
    .join("");
}

async function refreshTeamPanel() {
  if (!panelTeam) return;
  const { ok, data } = await api(`/api/admin/team/${panelTeam}`);
  if (ok) renderTeamPanel(data);
}

async function openTeamPanel(teamNumber) {
  panelTeam = String(teamNumber);
  teamPanel.hidden = false;
  await refreshTeamPanel();
  // Refresh only while this panel is open — not once per team per poll.
  clearInterval(panelInterval);
  panelInterval = setInterval(refreshTeamPanel, 3000);
}

function closeTeamPanel() {
  panelTeam = null;
  clearInterval(panelInterval);
  panelInterval = null;
  teamPanel.hidden = true;
  if (lmap) lmap.getContainer().focus();
}

// ---------- polling / auth ----------

async function poll() {
  const { ok, data } = await api("/api/admin/teams");
  if (!ok) {
    stopSession();
    return;
  }
  render(data.teams);
  refreshLive();
}

function startSession() {
  loginCard.style.display = "none";
  mapCard.style.display = "block";
  boardCard.style.display = "block";

  // Container is visible now — let Leaflet measure it.
  ensureMap();
  if (lmap) setTimeout(() => lmap.invalidateSize(), 0);

  poll();
  clearInterval(pollInterval);
  pollInterval = setInterval(poll, 4000);
}

function stopSession() {
  clearInterval(pollInterval);
  closeTeamPanel();
  mapCard.style.display = "none";
  boardCard.style.display = "none";
  loginCard.style.display = "block";
}

async function tryResume() {
  const { ok } = await api("/api/admin/teams");
  if (ok) startSession();
}

// ---------- events ----------

document.getElementById("login-btn").addEventListener("click", async () => {
  loginError.textContent = "";
  const password = document.getElementById("password").value;
  const { ok } = await api("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  if (!ok) {
    loginError.textContent = "Wrong password.";
    return;
  }
  startSession();
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" });
  stopSession();
});

document.getElementById("password")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("login-btn").click();
});

teamPanel.addEventListener("click", (e) => {
  if (e.target.hasAttribute("data-close")) closeTeamPanel();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !teamPanel.hidden) closeTeamPanel();
});

tryResume();
