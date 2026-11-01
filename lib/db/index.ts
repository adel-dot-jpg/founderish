import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { databaseUrl } from "../env";

// One pool per process; survives Next dev hot reloads.
const g = globalThis as unknown as { __founderishPool?: Pool };
export const pool = (g.__founderishPool ??= createPool());

function createPool() {
  const p = new Pool({ connectionString: databaseUrl(), max: 5, keepAlive: true });
  // Idle connections to a remote DB get reset on flaky networks; without a listener that crashes the process.
  p.on("error", (err) => console.error("[db] idle client error:", err.message));
  return p;
}

export const db = drizzle(pool, { schema });
export { schema };
