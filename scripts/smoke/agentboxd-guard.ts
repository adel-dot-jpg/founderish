import { run } from "./_util";
import { SendBlockedError, send } from "@/lib/mail";

run("agentboxd-guard", async () => {
  process.env.DEMO_MODE = "true";
  // If the guard ran after any API call, a bogus key would surface as an auth error instead.
  process.env.AGENTBOXD_API_KEY = "mr_invalid_guard_test";
  try {
    await send({ to: "someone@example.com", subject: "should never send", text: "x" });
  } catch (err) {
    if (err instanceof SendBlockedError) return `blocked before any API call: ${err.message}`;
    throw new Error(`threw the wrong error (guard may run too late): ${String(err)}`);
  }
  throw new Error("send to a non-allowlisted address did not throw");
});
