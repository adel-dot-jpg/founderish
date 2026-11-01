import { fail, pass } from "./_util";
import { REQUIRED_ENV, missingEnv, isDemoMode } from "@/lib/env";

const missing = missingEnv();
for (const k of REQUIRED_ENV) console.log(`${missing.includes(k) ? "  missing" : "  ok     "} ${k}`);
console.log(`DEMO_MODE is ${isDemoMode() ? "ON" : "OFF"}`);
if (missing.length) fail("env", `missing ${missing.join(", ")}`);
pass("env", `all ${REQUIRED_ENV.length} present`);
