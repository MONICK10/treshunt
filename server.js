require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");

const Team = require("./models/Team");
const { CS_DEPT, POOL } = require("./clues");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const locById = Object.fromEntries(POOL.map((l) => [l.id, l]));

// A team's `order` array is [CS_DEPT, ...12 stops in group order, CS_DEPT].
// The clue shown at any index depends on whether CS_DEPT there means
// "start" (index 0) or "finish" (the last index) — everything else comes
// straight from the pool.
function clueForIndex(team, index) {
  const id = team.order[index];
  if (id === "CS_DEPT") {
    const isStart = index === 0;
    return {
      riddle: isStart ? CS_DEPT.startText : CS_DEPT.finishText,
      verse: isStart ? CS_DEPT.startVerse : CS_DEPT.finishVerse,
    };
  }
  return locById[id];
}

function locationName(id) {
  if (id === "CS_DEPT") return CS_DEPT.name;
  return locById[id]?.name || "—";
}

// Human label for the clue shown at a given index in a team's route:
//   index 0                -> "Get Started" (just the nudge to scan CS_DEPT and begin)
//   index 1 .. length-2    -> "Clue 1" .. "Clue N" (the shuffled pool stops)
//   index length-1 (last)  -> "Final Stop" (return to CS_DEPT to finish)
function clueLabelForIndex(order, index) {
  if (index === 0) return "Get Started";
  if (index === order.length - 1) return "Final Stop";
  return `Clue ${index}`;
}

// ---------- auth helpers ----------

function signTeamToken(team) {
  return jwt.sign({ teamId: team._id.toString(), kind: "team" }, JWT_SECRET, { expiresIn: "12h" });
}

function signAdminToken() {
  return jwt.sign({ kind: "admin" }, JWT_SECRET, { expiresIn: "12h" });
}

async function requireTeam(req, res, next) {
  try {
    const token = req.cookies.hunt_token;
    if (!token) return res.status(401).json({ error: "not_logged_in" });
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.kind !== "team") return res.status(401).json({ error: "not_logged_in" });
    const team = await Team.findById(payload.teamId);
    if (!team) return res.status(401).json({ error: "not_logged_in" });
    req.team = team;
    next();
  } catch (e) {
    return res.status(401).json({ error: "not_logged_in" });
  }
}

function requireAdmin(req, res, next) {
  try {
    const token = req.cookies.admin_token;
    if (!token) return res.status(401).json({ error: "not_logged_in" });
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.kind !== "admin") return res.status(401).json({ error: "not_logged_in" });
    next();
  } catch (e) {
    return res.status(401).json({ error: "not_logged_in" });
  }
}

// Build the view of a team's status that's safe to send to that team:
// only their CURRENT riddle, never their full route (that would let them
// or a rival peek ahead / cheat).
function teamStatusPayload(team) {
  const total = team.order.length;
  const done = team.finishedAt != null;
  const current = done ? null : clueForIndex(team, team.currentIndex);
  const atStart = team.currentIndex === 0;

  // One point per stop in the route (start + pool stops + finish). A point is
  // only named once the team has actually scanned it — upcoming points expose
  // their number but never their location, so the puzzle isn't spoiled.
  // `at` (scan time) is included for done stops so the finish result board
  // can show split times.
  const trail = team.order.map((id, i) => {
    const stopDone = i < team.currentIndex;
    return {
      number: i + 1,
      done: stopDone,
      name: stopDone ? locationName(id) : null,
      at: stopDone && team.scans[i] ? team.scans[i].at : null,
    };
  });

  return {
    teamName: team.teamName,
    teamNumber: team.teamNumber,
    displayName: team.displayName || null,
    // Name can be set/changed only until the clock starts.
    nameLocked: team.startedAt != null,
    startedAt: team.startedAt,
    finishedAt: team.finishedAt,
    stopsCompleted: team.currentIndex,
    totalStops: total,
    done,
    atStart,
    currentClue: current
      ? {
          riddle: current.riddle,
          verse: current.verse,
          stopNumber: team.currentIndex + 1,
          label: clueLabelForIndex(team.order, team.currentIndex),
        }
      : null,
    trail,
  };
}

// ---------- team routes ----------

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "missing_fields" });

  const team = await Team.findOne({ username: String(username).toLowerCase().trim() });
  if (!team) return res.status(401).json({ error: "invalid_credentials" });

  const ok = await bcrypt.compare(password, team.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });

  const token = signTeamToken(team);
  res.cookie("hunt_token", token, { httpOnly: true, sameSite: "lax", maxAge: 12 * 60 * 60 * 1000 });
  res.json(teamStatusPayload(team));
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("hunt_token");
  res.json({ ok: true });
});

app.get("/api/me", requireTeam, (req, res) => {
  res.json(teamStatusPayload(req.team));
});

// Team sets its own display name. Allowed only before the clock starts —
// once startedAt is set, the name is locked.
app.post("/api/team/name", requireTeam, async (req, res) => {
  const team = req.team;
  if (team.startedAt) {
    return res.status(409).json({ error: "name_locked", status: teamStatusPayload(team) });
  }
  let name = req.body && req.body.name != null ? String(req.body.name) : "";
  // Strip angle brackets / control chars, collapse whitespace, cap length.
  name = String(name).replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 30);
  if (name.length < 2) {
    return res.status(400).json({ error: "name_too_short" });
  }
  team.displayName = name;
  await team.save();
  res.json({ ok: true, status: teamStatusPayload(team) });
});

// Called when a team scans a QR code (loc = the location ID encoded in it).
app.post("/api/scan", requireTeam, async (req, res) => {
  const team = req.team;
  const { loc } = req.body || {};

  if (team.finishedAt) {
    return res.json({ result: "already_finished", status: teamStatusPayload(team) });
  }

  const expected = team.order[team.currentIndex];
  if (!loc || loc !== expected) {
    return res.json({ result: "wrong_location", status: teamStatusPayload(team) });
  }

  const now = new Date();

  // The very first correct scan (CS_DEPT, index 0) starts the clock.
  if (team.currentIndex === 0 && !team.startedAt) {
    team.startedAt = now;
  }

  team.scans.push({ loc, at: now });
  team.currentIndex += 1;

  if (team.currentIndex >= team.order.length) {
    team.finishedAt = now;
  }

  await team.save();
  res.json({ result: "correct", status: teamStatusPayload(team) });
});

// Opt-in live GPS from a team's phone. Fire-and-forget from the client.
app.post("/api/location", requireTeam, async (req, res) => {
  const team = req.team;
  const { lat, lng } = req.body || {};

  const bad =
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180;
  if (bad) return res.status(400).json({ error: "invalid_coords" });

  // Light rate-limit: ignore updates less than 5s after the last one.
  const last = team.currentLocation && team.currentLocation.updatedAt;
  if (last && Date.now() - new Date(last).getTime() < 5000) {
    return res.json({ ok: true, throttled: true });
  }

  team.currentLocation = { lat, lng, updatedAt: new Date() };
  team.locationEnabled = true;
  await team.save();
  res.json({ ok: true });
});

// ---------- admin routes ----------

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "invalid_password" });
  const token = signAdminToken();
  res.cookie("admin_token", token, { httpOnly: true, sameSite: "lax", maxAge: 12 * 60 * 60 * 1000 });
  res.json({ ok: true });
});

app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("admin_token");
  res.json({ ok: true });
});

// Hands the Mapbox token to the admin live map. Admin-protected so the token
// never ships in committed code or to non-admins. Empty string if unset —
// the frontend then shows a "map key missing" note and still renders the table.
app.get("/api/admin/maps-key", requireAdmin, (req, res) => {
  res.json({ token: process.env.MAPBOX_ACCESS_TOKEN || "" });
});

app.get("/api/admin/teams", requireAdmin, async (req, res) => {
  const teams = await Team.find({}).sort({ teamNumber: 1 });
  const now = Date.now();

  const rows = teams.map((t) => {
    const elapsedMs = t.startedAt ? (t.finishedAt ? t.finishedAt - t.startedAt : now - t.startedAt) : null;
    return {
      teamNumber: t.teamNumber,
      teamName: t.teamName,
      displayName: t.displayName || null,
      username: t.username,
      stopsCompleted: t.currentIndex,
      totalStops: t.order.length,
      stopsLeft: Math.max(0, t.order.length - t.currentIndex),
      currentLocationName: t.finishedAt ? "FINISHED" : locationName(t.order[t.currentIndex]),
      startedAt: t.startedAt,
      finishedAt: t.finishedAt,
      elapsedMs,
      lastScanAt: t.scans.length ? t.scans[t.scans.length - 1].at : null,
    };
  });

  // Finished teams ranked by finish time; unfinished teams after, by progress.
  rows.sort((a, b) => {
    if (a.finishedAt && b.finishedAt) return new Date(a.finishedAt) - new Date(b.finishedAt);
    if (a.finishedAt) return -1;
    if (b.finishedAt) return 1;
    return b.stopsCompleted - a.stopsCompleted;
  });

  res.json({ teams: rows });
});

// Shape a team's stored GPS fix for the admin API, with an age in seconds.
function liveLocationPayload(team, now) {
  const loc = team.currentLocation;
  if (!loc || typeof loc.lat !== "number") return null;
  return {
    lat: loc.lat,
    lng: loc.lng,
    updatedAt: loc.updatedAt,
    staleSeconds: (now - new Date(loc.updatedAt).getTime()) / 1000,
  };
}

// Current position of every team, for the admin live map. A team's "position"
// is the last location it scanned correctly (order[currentIndex - 1]), or
// CS_DEPT before its first scan / after it finishes. `liveLocation` is the
// team's real phone GPS when they've opted in — the frontend prefers it while
// fresh and falls back to the snapped building otherwise.
app.get("/api/admin/live-positions", requireAdmin, async (req, res) => {
  const teams = await Team.find({}).sort({ teamNumber: 1 });
  const now = Date.now();

  const rows = teams.map((t) => {
    const idx = t.currentIndex === 0 ? 0 : t.currentIndex - 1;
    const locationId = t.order[idx];
    return {
      teamNumber: t.teamNumber,
      teamName: t.teamName,
      displayName: t.displayName || null,
      locationId,
      locationName: locationName(locationId),
      lastScanAt: t.scans.length ? t.scans[t.scans.length - 1].at : null,
      finishedAt: t.finishedAt,
      liveLocation: liveLocationPayload(t, now),
    };
  });

  res.json({ teams: rows });
});

// Full route + per-stop status for ONE team, for the admin per-team detail
// panel (opened by clicking a marker). Reveals every stop in order — fine
// because it's admin-only.
app.get("/api/admin/team/:teamNumber", requireAdmin, async (req, res) => {
  const team = await Team.findOne({ teamNumber: Number(req.params.teamNumber) });
  if (!team) return res.status(404).json({ error: "not_found" });

  const now = Date.now();
  const elapsedMs = team.startedAt
    ? (team.finishedAt ? team.finishedAt - team.startedAt : now - team.startedAt)
    : null;

  // scans[] is pushed in lock-step with currentIndex on each correct scan, so
  // scans[i] is the scan of order[i].
  const stops = team.order.map((locId, i) => ({
    locId,
    name: locationName(locId),
    n: i + 1,
    label: clueLabelForIndex(team.order, i),
    scannedAt: i < team.currentIndex && team.scans[i] ? team.scans[i].at : null,
    isCurrent: !team.finishedAt && i === team.currentIndex,
  }));

  res.json({
    teamNumber: team.teamNumber,
    teamName: team.teamName,
    displayName: team.displayName || null,
    startedAt: team.startedAt,
    finishedAt: team.finishedAt,
    elapsedMs,
    stops,
    liveLocation: liveLocationPayload(team, now),
  });
});

// Reset a single team's progress (keeps their username/password/order).
app.post("/api/admin/reset/:teamNumber", requireAdmin, async (req, res) => {
  const team = await Team.findOne({ teamNumber: Number(req.params.teamNumber) });
  if (!team) return res.status(404).json({ error: "not_found" });
  team.currentIndex = 0;
  team.scans = [];
  team.startedAt = null;
  team.finishedAt = null;
  await team.save();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log(`Connected to MongoDB. Server running on port ${PORT}`))
    .catch((err) => {
      console.error("MongoDB connection error:", err.message);
      console.error("Set MONGODB_URI in your .env file — see .env.example.");
    });
});
