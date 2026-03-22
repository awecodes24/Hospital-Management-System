import { app } from "./app";
import { env } from "./config/env";
import { testConnection, pool } from "./db/pool";

async function start(): Promise<void> {
  // 1. Verify DB is reachable before accepting traffic
  try {
    await testConnection();
    console.log("Database connected successfully");
  } catch (err) {
    console.error("Could not connect to database:", err);
    process.exit(1);
  }

  // 2. Start HTTP server
  const server = app.listen(env.PORT, () => {
    console.log(`🏥  Himalaya Hospital API`);
    console.log(`    ENV  : ${env.NODE_ENV}`);
    console.log(`    PORT : ${env.PORT}`);
    console.log(`    DB   : ${env.DB_NAME}@${env.DB_HOST}`);
  });

  // 3. Graceful shutdown on SIGTERM / SIGINT
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await pool.end();
      console.log("Database pool closed. Bye.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start();
