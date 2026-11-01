// Shared env helpers. Every service (web, worker, scripts) reads the same vars; see .env.example.

export const REQUIRED_ENV = [
  "DATABASE_URL",
  "GEMINI_API_KEY",
  "APOLLO_API_KEY",
  "AGENTBOXD_API_KEY",
  "AGENTBOXD_WEBHOOK_SECRET",
  "GITHUB_TOKEN",
  "GITHUB_WEBHOOK_SECRET",
  "TEST_REPO",
  "APP_URL",
  "OWNER_EMAIL",
  "SEND_ALLOWLIST",
  "DEMO_MODE",
] as const;

export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((k) => !process.env[k]?.trim());
}

// Fail safe: demo mode is on unless explicitly turned off.
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE?.trim().toLowerCase() !== "false";
}

export function sendAllowlist(): string[] {
  return (process.env.SEND_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL ?? "").trim().toLowerCase();
}

// Remote Postgres (e.g. Render's external URL) requires TLS; local and Render-internal hosts don't.
export function databaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw) return raw;
  const url = new URL(raw);
  const local = ["localhost", "127.0.0.1"].includes(url.hostname) || !url.hostname.includes(".");
  if (!local && !url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
