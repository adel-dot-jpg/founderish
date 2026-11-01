import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// One pool per process; survives Next dev hot reloads.
const g = globalThis as unknown as { __founderishPool?: Pool };
export const pool = (g.__founderishPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));

export const db = drizzle(pool, { schema });
export { schema };
