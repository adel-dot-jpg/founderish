import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { databaseUrl } from "../env";

// A remote DB over flaky Wi-Fi leaves half-open sockets that hang queries forever (Windows waits 2h before its
// first keep-alive probe). Recycle idle clients fast, probe early, and time out connects and queries.
export const POOL_SAFETY = {
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  query_timeout: 20_000,
};

function createPool() {
  const p = new Pool({ connectionString: databaseUrl(), max: 5, ...POOL_SAFETY });
  // Idle connections to a remote DB get reset on flaky networks; without a listener that crashes the process.
  p.on("error", (err) => console.error("[db] idle client error:", err.message));
  return p;
}

// One pool per process; survives Next dev hot reloads.
const g = globalThis as unknown as { __founderishPool?: Pool };
export const pool = (g.__founderishPool ??= createPool());

export const db = drizzle(pool, { schema });
export { schema };
