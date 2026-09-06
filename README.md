# Karunya Campus Treasure Hunt

A Bible-themed treasure hunt for 40 teams. Every team logs in with a
username/password, then scans the QR code at the CS Department to start
their clock and get their first clue. From there they visit 10 randomly
chosen, randomly ordered locations (a different set and order per team,
picked from a pool of 14 campus spots), scanning the QR at each correct
stop to unlock the next riddle. After the 10th stop, the final clue sends
them back to the CS Department — scanning that QR a second time stops
their clock and finishes their run. Winner = fastest total time. The admin
dashboard shows every team's live progress and finish times.

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
- `BASE_URL` — leave as-is for now, you'll set the real one after deploying.

## 3. Install and seed the teams

```
npm install
npm run seed
```

This creates 40 teams (`team01`...`team40`) with random passwords, each
assigned a random set of 10 locations (out of the 14-location pool) in a
random order, and writes `credentials.csv` — print it and cut it into 40
slips, one per team. **Run this only once per event** — re-running it wipes
and regenerates everyone's progress.

## 4. Run it locally to test

```
npm start
```

Visit http://localhost:3000 to try the team view, and
http://localhost:3000/admin.html for the dashboard.

## 5. Deploy so phones on campus can reach it

Any free Node.js host works — Render.com is the easiest:

1. Push this folder to a GitHub repo.
2. On https://render.com, "New Web Service" → connect the repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Add the same environment variables from your `.env` file in Render's
   dashboard (MONGODB_URI, JWT_SECRET, ADMIN_PASSWORD).
5. Once deployed, Render gives you a URL like
   `https://karunya-hunt.onrender.com`. Put that in `.env` as `BASE_URL`
   (and in Render's env vars too, for consistency).

## 6. Generate and print the QR codes

After you know your real deployed URL:

```
npm run qrcodes
```

This writes one PNG per location into the `qr/` folder (`CS_DEPT.png`,
`LIBRARY.png`, `CIVIL.png`, ... one for every spot in the pool). Print each
one and place it at the matching physical location. **`CS_DEPT.png` is used
twice by every team** — once to start (scan it to begin and get your first
clue) and once to finish (scan it again after your 10th stop). One printed
copy at the CS Department covers both.

## How it works, in short

- Teams never see their whole route — only the clue for wherever they are
  right now — so peeking ahead or comparing routes with another team
  doesn't help.
- Scanning the QR code at the WRONG location just says "that's not your
  next stop" — it doesn't reveal what the right one is.
- The admin dashboard (`/admin.html`) auto-refreshes every few seconds and
  ranks finished teams by finish time.
- If you need to restart a single team's run without re-seeding everyone,
  there's `POST /api/admin/reset/:teamNumber` (call it from the browser
  console or a tool like curl/Postman while logged in as admin).

## Editing the clues

All 14 pool-location riddles, plus the CS Dept start/finish text, live in
`clues.js`. Edit the `riddle`/`verse` (or `startText`/`finishText`) fields
there — just keep each `id` matching the location's QR code file name. If
you add or remove a pool location, update `POOL` in `clues.js` — `seed.js`
automatically picks 10 at random from whatever's in that list (as long as
the pool has at least 10 entries).
