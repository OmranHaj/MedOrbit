import app from "./app";
import { logger } from "./lib/logger";
import { seedDemoData } from "./lib/seed";
import { pool } from "@workspace/db";
import { assertOtpConfiguration } from "./lib/visit-otp";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start() {
  assertOtpConfiguration();
  await seedDemoData();
  const server = app.listen(port, (err) => {
    if (err) { logger.error({ err }, "Error listening on port"); process.exit(1); }
    logger.info({ port }, "Server listening");
  });
  const shutdown = () => {
    server.close(() => { void pool.end().then(() => process.exit(0)); });
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
start().catch((err) => { logger.error({ err }, "Database initialization failed"); process.exit(1); });
