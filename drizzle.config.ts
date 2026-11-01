import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { databaseUrl } from "./lib/env";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: databaseUrl() },
});
