import "dotenv/config";

export function pass(name: string, detail = "") {
  console.log(`PASS ${name}${detail ? `: ${detail}` : ""}`);
  process.exit(0);
}

export function fail(name: string, detail: string): never {
  console.error(`FAIL ${name}: ${detail}`);
  process.exit(1);
}

export function run(name: string, fn: () => Promise<string | void>) {
  fn().then(
    (detail) => pass(name, detail ?? ""),
    (err) => fail(name, err instanceof Error ? err.message : String(err)),
  );
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
