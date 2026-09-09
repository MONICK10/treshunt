// Run with: npm run qrcodes
// Generates one QR code PNG per physical location (CS Department + the 12
// pool stops = 13 codes total), pointing to your deployed site with
// ?loc=<ID>. Print each one and place it at that location. Re-run this
// AFTER you know your real deployed BASE_URL.
//
// Output goes to a fresh qr-groups/ folder (wiped on each run) so stale
// codes from an earlier location list never linger.
//
// CS_DEPT gets ONE QR code, used TWICE by every team: once to start
// (starts their clock, gives their first clue) and once at the very end
// (finishes their run). Put one printed copy of it at the CS Department.

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { CS_DEPT, POOL } = require("./clues");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const outDir = path.join(__dirname, "qr-groups");

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

async function main() {
  const all = [{ id: CS_DEPT.id, name: CS_DEPT.name }, ...POOL];

  for (const loc of all) {
    const url = `${BASE_URL}/?loc=${encodeURIComponent(loc.id)}`;
    const file = path.join(outDir, `${loc.id}.png`);
    await QRCode.toFile(file, url, { width: 500, margin: 2 });
    console.log(`${loc.name.padEnd(28)} -> ${file}  (${url})`);
  }
  console.log(`\nAll QR codes written to ${outDir}/`);
  console.log("Print each PNG and place it at its matching physical location.");
  console.log("CS_DEPT.png is used for BOTH the start and the finish — one printed copy at CS Dept is enough.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
