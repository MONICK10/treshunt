// Dev launcher: spins up an in-memory MongoDB, seeds teams, starts the server.
// Not for production — just to run the app locally without MongoDB Atlas.
const { MongoMemoryServer } = require("mongodb-memory-server");
const { spawnSync, spawn } = require("child_process");

(async () => {
  const mongod = await MongoMemoryServer.create({ instance: { port: 27017 } });
  const uri = mongod.getUri("treasurehunt");
  console.log("In-memory MongoDB at", uri);

  const env = {
    ...process.env,
    MONGODB_URI: uri,
    JWT_SECRET: "dev-secret-local",
    ADMIN_PASSWORD: "admin123",
    PORT: process.env.PORT || "3000",
  };

  console.log("Seeding teams...");
  const seed = spawnSync(process.execPath, ["seed.js"], { env, stdio: "inherit", cwd: __dirname });
  if (seed.status !== 0) {
    console.error("Seed failed");
    await mongod.stop();
    process.exit(1);
  }

  console.log("Starting server...");
  const server = spawn(process.execPath, ["server.js"], { env, stdio: "inherit", cwd: __dirname });

  const shutdown = async () => {
    server.kill();
    await mongod.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  server.on("exit", async (code) => {
    await mongod.stop();
    process.exit(code || 0);
  });
})();
