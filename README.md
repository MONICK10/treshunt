# Karunya Campus Treasure Hunt

A Bible-themed treasure hunt for 12 teams. Every team logs in with a
username/password, then scans the QR code at the CS Department to start
their clock and get their first clue. From there they visit all 12 pool
locations, scanning the QR at each correct stop to unlock the next riddle.
Each team follows one of 12 fixed routes ("Group 1".."Group 12") — team N
runs Group N. Every group visits the same 12 places in a different order,
so teams are spread across campus and no two share a stop at the same
time. After the 12th stop, the final clue sends them back to the CS
Department — scanning that QR a second time stops their clock and finishes
their run. Winner = fastest total time. The admin dashboard shows every
team's live progress and finish times.

## 1. Get a free MongoDB database

1. Go to https://www.mongodb.com/cloud/atlas/register and make a free account.
2. Create a free (M0) cluster.
3. Create a database user (username + password) and allow network access
   from anywhere (0.0.0.0/0) — simplest for a one-day event.
4. Copy the connection string, it looks like:
   `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/`

## 2. Configure the project

```
cp .env.example .env
```

Edit `.env`:
- `MONGODB_URI` — paste your connection string, add `/treasurehunt` before
  the `?` if it's not already a database name.
- `JWT_SECRET` — any long random string.
- `ADMIN_PASSWORD` — the password YOU (the organizer) will use to view the
  live dashboard at `/admin.html`. Don't share this with teams.
- `MAPBOX_ACCESS_TOKEN` — a free token from
  https://account.mapbox.com/access-tokens/ (the default public `pk.*`
  token is fine). Powers the admin live map. It's served only to a
  logged-in admin via `GET /api/admin/maps-key`, never committed. Leave it
  blank and the dashboard still works — you just get the team table without
  the map.
- `BASE_URL` — leave as-is for now, you'll set the real one after deploying.

## 3. Install and seed the teams

```
npm install
npm run seed
```

This creates 12 teams (`team01`...`team12`) with random passwords, one per
group. Team N is assigned Group N's fixed route (the 12 routes are defined
in `seed.js` as `GROUP_ROUTES`). It writes `credentials.csv` — print it and
cut it into 12 slips, one per team. **Run this only once per event** —
re-running it wipes and regenerates everyone's progress.

## 4. Run it locally to test

```
npm start
```

Visit http://localhost:3000 for the cover page (it links through to the
team login at `/play.html`), and http://localhost:3000/admin.html for the
dashboard. Location QR codes point at `/?loc=<ID>`; the cover page forwards
those straight to `/play.html` so scanning still works.

## 5. Deploy so phones on campus can reach it

Any free Node.js host works — Render.com is the easiest:

1. Push this folder to a GitHub repo.
2. On https://render.com, "New Web Service" → connect the repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Add the same environment variables from your `.env` file in Render's
   dashboard (MONGODB_URI, JWT_SECRET, ADMIN_PASSWORD, MAPBOX_ACCESS_TOKEN).
5. Once deployed, Render gives you a URL like
   `https://karunya-hunt.onrender.com`. Put that in `.env` as `BASE_URL`
   (and in Render's env vars too, for consistency).

## 6. Generate and print the QR codes

After you know your real deployed URL:

```
npm run qrcodes
```

This wipes and rewrites the `qr-groups/` folder with one PNG per location
(`CS_DEPT.png`, `LIBRARY.png`, `CIVIL.png`, ... 13 in all — CS Department
plus the 12 pool stops). Print each one and place it at the matching
physical location. **`CS_DEPT.png` is used twice by every team** — once to
start (scan it to begin and get your first clue) and once to finish (scan
it again after your 12th stop). One printed copy at the CS Department
covers both.

## How it works, in short

- After logging in, each team picks its own display name (e.g. "Spartans").
  It's editable until they scan CS Dept to start, then locked. That name
  shows on their screen and on the admin dashboard (next to `team01`).
- Teams never see their whole route — only the clue for wherever they are
  right now — so peeking ahead or comparing routes with another team
  doesn't help.
- Finishing (the second CS Dept scan) triggers a one-time confetti popup
  and a result board on the team's screen: total time, finish time, and
  every stop with its split time.
- On the admin dashboard, click any team row (or its map pin) for the full
  stop-by-stop breakdown — done, current target, and what's left.
- Scanning the QR code at the WRONG location just says "that's not your
  next stop" — it doesn't reveal what the right one is.
- The admin dashboard (`/admin.html`) auto-refreshes every few seconds and
  ranks finished teams by finish time.
- The dashboard's live map (Mapbox GL JS) shows a pin per team — red while
  running, green when finished. Teams who allow location sharing on their
  phone appear at their real GPS position with a pulsing ring; everyone
  else is snapped to their last scanned stop. Location sharing is opt-in
  (the phone's own permission prompt) and the game plays identically
  whether a team enables it or not.
- If you need to restart a single team's run without re-seeding everyone,
  there's `POST /api/admin/reset/:teamNumber` (call it from the browser
  console or a tool like curl/Postman while logged in as admin).

## Editing the clues

All 12 pool-location riddles, plus the CS Dept start/finish text, live in
`clues.js`. Edit the `riddle`/`verse` (or `startText`/`finishText`) fields
there — just keep each `id` matching the location's QR code file name. If
you change the pool, update both `POOL` in `clues.js` and the 12
`GROUP_ROUTES` in `seed.js` (each route must list every pool `id` exactly
once); `npm run seed` validates this and fails loudly otherwise.
