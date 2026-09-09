// Run once (or whenever you want to reset the game) with: npm run seed
// Creates one team per fixed route. Every team's route is:
//   CS_DEPT (start) -> the 12 pool locations in that group's fixed order -> CS_DEPT (finish)
// There are 12 fixed routes ("Group 1".."Group 12"), each visiting all 12
// pool locations exactly once. Team N runs Group N.
// Prints a credentials table and also writes it to credentials.csv so you
// can print and hand one row to each team.

require("dotenv").config();
const fs = require("fs");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Team = require("./models/Team");
const { POOL } = require("./clues");

// The 12 fixed routes, in team order. Each is the 12 pool location IDs in
// visiting order; CS_DEPT is added as the start and finish below.
const GROUP_ROUTES = [
  // Group 1
  ["CANTEEN", "EMMANUEL_AUDI", "MECH", "CIVIL", "CHANDRAN", "AGRI", "MEDIA", "LIBRARY", "CTC1", "CAKE_WORLD", "BETHESDA", "AEROSPACE"],
  // Group 2
  ["EMMANUEL_AUDI", "MEDIA", "AEROSPACE", "CHANDRAN", "CAKE_WORLD", "MECH", "LIBRARY", "CANTEEN", "AGRI", "CTC1", "CIVIL", "BETHESDA"],
  // Group 3
  ["MECH", "CAKE_WORLD", "MEDIA", "CIVIL", "BETHESDA", "LIBRARY", "CHANDRAN", "CANTEEN", "CTC1", "AGRI", "EMMANUEL_AUDI", "AEROSPACE"],
  // Group 4
  ["CIVIL", "MECH", "EMMANUEL_AUDI", "CANTEEN", "AEROSPACE", "BETHESDA", "CAKE_WORLD", "CTC1", "LIBRARY", "MEDIA", "AGRI", "CHANDRAN"],
  // Group 5
  ["CHANDRAN", "CAKE_WORLD", "MECH", "LIBRARY", "CANTEEN", "AGRI", "CTC1", "CIVIL", "BETHESDA", "EMMANUEL_AUDI", "MEDIA", "AEROSPACE"],
  // Group 6
  ["AGRI", "CANTEEN", "CTC1", "AEROSPACE", "MEDIA", "CIVIL", "BETHESDA", "LIBRARY", "CHANDRAN", "CAKE_WORLD", "MECH", "EMMANUEL_AUDI"],
  // Group 7
  ["MEDIA", "AGRI", "CHANDRAN", "CIVIL", "MECH", "EMMANUEL_AUDI", "CANTEEN", "AEROSPACE", "BETHESDA", "CAKE_WORLD", "CTC1", "LIBRARY"],
  // Group 8
  ["LIBRARY", "CANTEEN", "AGRI", "CTC1", "CIVIL", "BETHESDA", "EMMANUEL_AUDI", "MEDIA", "AEROSPACE", "CHANDRAN", "CAKE_WORLD", "MECH"],
  // Group 9
  ["CTC1", "AEROSPACE", "MEDIA", "CIVIL", "BETHESDA", "LIBRARY", "CHANDRAN", "CAKE_WORLD", "MECH", "EMMANUEL_AUDI", "CANTEEN", "AGRI"],
  // Group 10
  ["CAKE_WORLD", "CTC1", "LIBRARY", "MEDIA", "AGRI", "CHANDRAN", "CIVIL", "MECH", "EMMANUEL_AUDI", "CANTEEN", "AEROSPACE", "BETHESDA"],
  // Group 11
  ["BETHESDA", "CIVIL", "AEROSPACE", "MEDIA", "AGRI", "CANTEEN", "LIBRARY", "MECH", "CAKE_WORLD", "CHANDRAN", "CTC1", "EMMANUEL_AUDI"],
  // Group 12
  ["AEROSPACE", "MEDIA", "CIVIL", "BETHESDA", "LIBRARY", "CHANDRAN", "CAKE_WORLD", "MECH", "EMMANUEL_AUDI", "CANTEEN", "AGRI", "CTC1"],
];

const NUM_TEAMS = GROUP_ROUTES.length; // one team per group

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars (0/O, 1/I)
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Fail loudly if a group route is malformed — a bad route would break a
// team's whole run.
function validateRoutes() {
  const poolIds = POOL.map((l) => l.id);
  const poolSet = new Set(poolIds);
  GROUP_ROUTES.forEach((route, i) => {
    const label = `Group ${i + 1}`;
    if (route.length !== poolIds.length) {
      throw new Error(`${label} has ${route.length} stops, expected ${poolIds.length}.`);
    }
    if (new Set(route).size !== route.length) {
      throw new Error(`${label} repeats a location.`);
    }
    for (const id of route) {
      if (!poolSet.has(id)) throw new Error(`${label} references unknown location "${id}".`);
    }
    // Every route is a full permutation, so it must contain every pool id.
    for (const id of poolIds) {
      if (!route.includes(id)) throw new Error(`${label} is missing location "${id}".`);
    }
  });
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("Set MONGODB_URI in your .env file first (see .env.example).");
    process.exit(1);
  }
  validateRoutes();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB. Wiping any existing teams...");
  await Team.deleteMany({});

  const rows = [["Team #", "Team Name", "Group", "Username", "Password"]];

  for (let i = 0; i < NUM_TEAMS; i++) {
    const teamNumber = i + 1;
    const teamName = `Team ${teamNumber}`;
    const username = `team${String(teamNumber).padStart(2, "0")}`;
    const password = randomPassword();
    const passwordHash = bcrypt.hashSync(password, 10);

    const order = ["CS_DEPT", ...GROUP_ROUTES[i], "CS_DEPT"];

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

    rows.push([teamNumber, teamName, `Group ${teamNumber}`, username, password]);
  }

  console.log("\nTeam credentials (also saved to credentials.csv):\n");
  console.table(
    rows.slice(1).map((r) => ({ Team: r[0], Name: r[1], Group: r[2], Username: r[3], Password: r[4] }))
  );

  const csv = rows.map((r) => r.join(",")).join("\n");
  fs.writeFileSync("credentials.csv", csv);

  console.log(
    `\nDone. ${NUM_TEAMS} teams created, one per group, each visiting all ${POOL.length} locations.`
  );
  console.log("credentials.csv is ready to print and hand out — keep it secret from participants until game start!");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
