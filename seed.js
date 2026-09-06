// Run once (or whenever you want to reset the game) with: npm run seed
// Creates 40 teams sharing 7 fixed maps. Every team's route is:
//   CS_DEPT (start) -> 10 pool locations in that map's fixed order -> CS_DEPT (finish)
// Teams are assigned to maps in blocks (see MAP_ASSIGNMENTS), so several teams
// run the same map and are expected to cross paths.
// Prints a credentials table and also writes it to credentials.csv so you
// can print and hand one row to each team.

require("dotenv").config();
const fs = require("fs");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const Team = require("./models/Team");
const { POOL } = require("./clues");

const NUM_TEAMS = 40;
const STOPS_PER_TEAM = 10; // out of POOL.length locations, excluding CS_DEPT

// The 7 fixed maps. Each is 10 of the 14 pool location IDs, in visiting order.
const ROUTE_POOL = [
  ["CS_CANTEEN", "ELOHIM_AUDI", "CTC1", "MECH", "CHANDRAN", "EMMANUEL_AUDI", "LIBRARY", "CAKE_WORLD_1", "CIVIL", "ECE"],
  ["MECH_CANTEEN", "ECE", "AGRI", "CAKE_WORLD_2", "EMMANUEL_AUDI", "CTC2", "CHANDRAN", "ELOHIM_AUDI", "CAKE_WORLD_1", "MECH"],
  ["LIBRARY", "CTC2", "CIVIL", "AGRI", "CS_CANTEEN", "MECH_CANTEEN", "ELOHIM_AUDI", "CAKE_WORLD_2", "CTC1", "EMMANUEL_AUDI"],
  ["CHANDRAN", "MECH", "CAKE_WORLD_1", "ELOHIM_AUDI", "CTC2", "CS_CANTEEN", "LIBRARY", "MECH_CANTEEN", "CIVIL", "ECE"],
  ["AGRI", "CIVIL", "CAKE_WORLD_2", "ECE", "LIBRARY", "EMMANUEL_AUDI", "CS_CANTEEN", "CTC1", "CHANDRAN", "MECH"],
  ["CTC2", "CAKE_WORLD_1", "CHANDRAN", "MECH", "LIBRARY", "CAKE_WORLD_2", "EMMANUEL_AUDI", "AGRI", "CS_CANTEEN", "ECE"],
  ["ECE", "EMMANUEL_AUDI", "CAKE_WORLD_1", "CHANDRAN", "CTC1", "CIVIL", "MECH_CANTEEN", "AGRI", "ELOHIM_AUDI", "CS_CANTEEN"],
];

// Which teams get which map. `from`/`to` are inclusive team numbers.
const MAP_ASSIGNMENTS = [
  { label: "A", route: 0, from: 1, to: 6 },
  { label: "B", route: 1, from: 7, to: 12 },
  { label: "C", route: 2, from: 13, to: 18 },
  { label: "D", route: 3, from: 19, to: 24 },
  { label: "E", route: 4, from: 25, to: 30 },
  { label: "F", route: 5, from: 31, to: 35 },
  { label: "G", route: 6, from: 36, to: 40 },
];

function mapForTeam(teamNumber) {
  const a = MAP_ASSIGNMENTS.find((m) => teamNumber >= m.from && teamNumber <= m.to);
  if (!a) throw new Error(`No map assigned for team ${teamNumber}`);
  return a;
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars (0/O, 1/I)
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Fail loudly if a map references an unknown location, repeats one, or is the
// wrong length — a bad map would break a team's whole run.
function validateRoutes() {
  const poolIds = new Set(POOL.map((l) => l.id));
  ROUTE_POOL.forEach((route, i) => {
    if (route.length !== STOPS_PER_TEAM) {
      throw new Error(`Map ${i} has ${route.length} stops, expected ${STOPS_PER_TEAM}.`);
    }
    if (new Set(route).size !== route.length) {
      throw new Error(`Map ${i} repeats a location.`);
    }
    for (const id of route) {
      if (!poolIds.has(id)) throw new Error(`Map ${i} references unknown location "${id}".`);
    }
  });
  // Every team number must resolve to a map.
  for (let n = 1; n <= NUM_TEAMS; n++) mapForTeam(n);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("Set MONGODB_URI in your .env file first (see .env.example).");
    process.exit(1);
  }
  if (STOPS_PER_TEAM > POOL.length) {
    console.error(`STOPS_PER_TEAM (${STOPS_PER_TEAM}) can't exceed the pool size (${POOL.length}).`);
    process.exit(1);
  }
  validateRoutes();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB. Wiping any existing teams...");
  await Team.deleteMany({});

  const rows = [["Team #", "Team Name", "Map", "Username", "Password"]];

  for (let i = 0; i < NUM_TEAMS; i++) {
    const teamNumber = i + 1;
    const teamName = `Team ${teamNumber}`;
    const username = `team${String(teamNumber).padStart(2, "0")}`;
    const password = randomPassword();
    const passwordHash = bcrypt.hashSync(password, 10);

    const map = mapForTeam(teamNumber);
    const middleStops = ROUTE_POOL[map.route];
    const order = ["CS_DEPT", ...middleStops, "CS_DEPT"];

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

    rows.push([teamNumber, teamName, map.label, username, password]);
  }

  console.log("\nTeam credentials (also saved to credentials.csv):\n");
  console.table(
    rows.slice(1).map((r) => ({ Team: r[0], Name: r[1], Map: r[2], Username: r[3], Password: r[4] }))
  );

  const csv = rows.map((r) => r.join(",")).join("\n");
  fs.writeFileSync("credentials.csv", csv);

  console.log(
    `\nDone. ${NUM_TEAMS} teams created across ${ROUTE_POOL.length} maps, each visiting ${STOPS_PER_TEAM} of ${POOL.length} locations.`
  );
  console.log("credentials.csv is ready to print and hand out — keep it secret from participants until game start!");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
