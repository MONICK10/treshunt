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

// Mapbox GL state
let map = null;
let mapInitStarted = false;
const markers = {}; // teamNumber -> mapboxgl.Marker

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

// ---------- all-teams table ----------

// Team display names are set by participants — escape before injecting.
function esc(s) {
  return String(s == null ? "" : s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function render(teams) {
  rowsEl.innerHTML = teams
    .map((t, i) => {
      const rank = t.finishedAt ? i + 1 : "—";
      const name = t.displayName || t.teamName;
      const progress = t.finishedAt
        ? "Finished"
        : `${t.stopsCompleted}/${t.totalStops} · <span class="dim">${t.stopsLeft} left</span>` +
          `<br><span class="dim">next: ${esc(t.currentLocationName)}</span>`;
      return `
        <tr class="${t.finishedAt ? "finished" : ""}" data-team="${t.teamNumber}" tabindex="0" role="button">
          <td>${rank}</td>
          <td><strong>${esc(name)}</strong><br><span class="dim">${esc(t.username)}</span></td>
          <td>${progress}</td>
          <td>${fmtTime(t.lastScanAt || t.startedAt)}</td>
          <td>${fmtElapsed(t.elapsedMs)}</td>
        </tr>`;
    })
    .join("");
  lastUpdated.textContent = "Updated " + new Date().toLocaleTimeString();
  knownTeamCount = teams.length;
}

// ---------- Mapbox GL live-positions map ----------

// Average of every known campus coordinate, as [lng, lat] for Mapbox.
function avgCenter() {
  const coords = Object.values(LOCATION_COORDS).filter(
    (c) => c && typeof c.lat === "number" && typeof c.lng === "number"
  );
  if (!coords.length) return [76.7449, 10.9357]; // Karunya campus fallback
  const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
  return [lng, lat];
}

// Build (once) the Mapbox map. Needs an access token from the admin-only
// /api/admin/maps-key endpoint — without it, the table still works.
async function ensureMap() {
  if (map) return map;
  if (mapInitStarted) return null; // a previous attempt is still resolving / failed
  mapInitStarted = true;

  if (typeof mapboxgl === "undefined") {
    setNote("Map library didn't load — the table below still works.");
    return null;
  }

  const { ok, data } = await api("/api/admin/maps-key");
  const token = ok && data && typeof data.token === "string" ? data.token : "";
  if (!token) {
    setNote(
      "Mapbox token missing — set MAPBOX_ACCESS_TOKEN in the server .env to enable the live map. The table below still works."
    );
    mapInitStarted = false; // allow a retry once the token is configured
    return null;
  }

  try {
    mapboxgl.accessToken = token;
    map = new mapboxgl.Map({
      container: "live-map",
      style: "mapbox://styles/mapbox/dark-v11", // dark monochrome — matches the navy/gold theme
      center: avgCenter(),
      zoom: 17,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
  } catch (e) {
    map = null;
    setNote("Couldn't start the map (WebGL may be unavailable) — the table below still works.");
    return null;
  }

  return map;
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

// The DOM element for a team's map pin: a filled circle with "T{n}" in it.
// `red/in-progress`, `green/finished`, plus a `.live` pulsing ring when the
// pin is on the team's real GPS rather than a snapped building.
function markerClass(finished, isLive) {
  return "team-marker" + (finished ? " finished" : "") + (isLive ? " live" : "");
}

function makeMarkerEl(t, isLive) {
  const wrap = document.createElement("div");
  wrap.className = "team-marker-wrap";
  const dot = document.createElement("div");
  dot.className = markerClass(!!t.finishedAt, isLive);
  dot.textContent = `T${t.teamNumber}`;
  wrap.appendChild(dot);
  wrap.addEventListener("click", (e) => {
    e.stopPropagation();
    openTeamPanel(t.teamNumber);
  });
  return wrap;
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
    `<div class="team-popup"><strong>${esc(t.displayName || t.teamName)}</strong><br />${esc(t.locationName)}<br />` +
    `<span class="muted">${when}</span><br /><span class="muted">${src}</span></div>`
  );
}

// Move an existing marker (no flicker) or create it the first time. `lngLat`
// is [lng, lat] for Mapbox.
function placeMarker(t, lngLat, isLive) {
  let m = markers[t.teamNumber];
  if (!m) {
    const el = makeMarkerEl(t, isLive);
    m = new mapboxgl.Marker({ element: el, anchor: "center" })
      .setLngLat(lngLat)
      .setPopup(new mapboxgl.Popup({ offset: 20, closeButton: true }).setHTML(popupHtml(t, isLive)))
      .addTo(map);
    markers[t.teamNumber] = m;
  } else {
    m.setLngLat(lngLat);
    const dot = m.getElement().querySelector(".team-marker");
    if (dot) dot.className = markerClass(!!t.finishedAt, isLive);
    const pop = m.getPopup();
    if (pop) pop.setHTML(popupHtml(t, isLive));
  }
}

function renderLive(teams) {
  mapUpdated.textContent = "Updated " + new Date().toLocaleTimeString();

  if (!map) return; // no map (no token / no WebGL) — setNote already explained why

  const seen = new Set();
  const missingLocs = new Set();

  // Teams with a fresh phone fix: plot at their real coordinate, no fan-out
  // (real GPS positions are already spread out).
  for (const t of teams) {
    if (!isLiveFresh(t)) continue;
    placeMarker(t, [t.liveLocation.lng, t.liveLocation.lat], true);
    seen.add(t.teamNumber);
  }

  // Everyone else: snap to their last scanned building, fanning apart any
  // teams sharing the same one so their labels stay readable.
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
      placeMarker(t, [spots[i].lng, spots[i].lat], false);
      seen.add(t.teamNumber);
    });
  }

  // remove markers for teams no longer present
  for (const num of Object.keys(markers)) {
    if (!seen.has(Number(num))) {
      markers[num].remove();
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
  await ensureMap();
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
    liveLine = "Live location: off — showing last scanned stop instead";
  } else if (live.staleSeconds < LIVE_FRESH_SECONDS) {
    liveLine = `Live location: active, updated ${Math.round(live.staleSeconds)}s ago`;
  } else {
    liveLine = `Live location: stale (${Math.round(live.staleSeconds / 60)}m ago) — showing last scanned stop instead`;
  }

  tpHeader.innerHTML =
    `<h3 id="tp-title">${esc(d.displayName || d.teamName)}</h3>` +
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
  if (map) map.getContainer().focus();
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

async function startSession() {
  loginCard.style.display = "none";
  mapCard.style.display = "block";
  boardCard.style.display = "block";

  // Container is visible now — build the map and let it measure itself.
  await ensureMap();
  if (map) {
    map.once("load", () => map.resize());
    setTimeout(() => map.resize(), 0);
  }

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

// Click (or Enter/Space on) any table row to open that team's full breakdown.
rowsEl.addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-team]");
  if (tr) openTeamPanel(Number(tr.dataset.team));
});
rowsEl.addEventListener("keydown", (e) => {
  const tr = e.target.closest && e.target.closest("tr[data-team]");
  if (tr && (e.key === "Enter" || e.key === " ")) {
    e.preventDefault();
    openTeamPanel(Number(tr.dataset.team));
  }
});

teamPanel.addEventListener("click", (e) => {
  if (e.target.hasAttribute("data-close")) closeTeamPanel();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !teamPanel.hidden) closeTeamPanel();
});

tryResume();
