// Run once (or whenever you want to reset the game) with: npm run seed
// Creates 40 teams sharing exactly 5 routes. Every team's route is:
//   CS_DEPT (start) -> all 11 pool locations, shuffled -> CS_DEPT (finish)
// Only 5 distinct shuffles are generated. Teams are assigned one by cycling
// through the 5 in team-number order: team N gets route (N - 1) % 5.
// So Team 1 & Team 6 & Team 11 ... share a route, and every block of 5
// consecutive teams covers all 5 routes once each — several teams run the
// same route and are expected to cross paths.
// Prints a credentials table and also writes it to credentials.csv so you
// can print and hand one row to each team.

require("dotenv").config();
const fs = require("fs");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Team = require("./models/Team");
const { POOL } = require("./clues");

const NUM_TEAMS = 40;
const NUM_ROUTES = 5;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build exactly NUM_ROUTES distinct routes. Each route is a random shuffle of
// ALL pool location IDs (a full permutation, since every team visits all 11),
// wrapped as [CS_DEPT, ...shuffled, CS_DEPT].
function buildRoutes() {
  const poolIds = POOL.map((l) => l.id);
  const routes = [];
  const seen = new Set();
  let guard = 0;
  while (routes.length < NUM_ROUTES) {
    if (++guard > 10000) throw new Error("Could not generate distinct routes.");
    const middle = shuffle(poolIds);
    const key = middle.join(">");
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push(["CS_DEPT", ...middle, "CS_DEPT"]);
  }
  return routes;
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars (0/O, 1/I)
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("Set MONGODB_URI in your .env file first (see .env.example).");
    process.exit(1);
  }
  if (POOL.length < 2) {
    console.error(`POOL is too small (${POOL.length}).`);
    process.exit(1);
  }

  const routes = buildRoutes();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB. Wiping any existing teams...");
  await Team.deleteMany({});

  const rows = [["Team #", "Team Name", "Route", "Username", "Password"]];

  for (let i = 0; i < NUM_TEAMS; i++) {
    const teamNumber = i + 1;
    const teamName = `Team ${teamNumber}`;
    const username = `team${String(teamNumber).padStart(2, "0")}`;
    const password = randomPassword();
    const passwordHash = bcrypt.hashSync(password, 10);

    const routeIndex = (teamNumber - 1) % NUM_ROUTES;
    const order = routes[routeIndex].slice();

    await Team.create({
      teamNumber,
      teamName,
      username,
      passwordHash,
      order,
      currentIndex: 0,
      scans: [],
      startedAt: null,
      finishedAt: null,
    });

    rows.push([teamNumber, teamName, String.fromCharCode(65 + routeIndex), username, password]);
  }

  console.log("\nTeam credentials (also saved to credentials.csv):\n");
  console.table(
    rows.slice(1).map((r) => ({ Team: r[0], Name: r[1], Route: r[2], Username: r[3], Password: r[4] }))
  );

  const csv = rows.map((r) => r.join(",")).join("\n");
  fs.writeFileSync("credentials.csv", csv);

  console.log("\nThe 5 routes (A–E):");
  routes.forEach((r, i) => {
    console.log(`  ${String.fromCharCode(65 + i)}: ${r.join(" -> ")}`);
  });

  console.log(
    `\nDone. ${NUM_TEAMS} teams created across ${NUM_ROUTES} routes, each visiting all ${POOL.length} locations.`
  );
  console.log("credentials.csv is ready to print and hand out — keep it secret from participants until game start!");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
