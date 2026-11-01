import { mkdirSync, writeFileSync } from "node:fs";
import { run } from "./_util";
import { getCoachInbox, listSent, send } from "@/lib/mail";
import { sendAllowlist } from "@/lib/env";

run("agentboxd-send", async () => {
  const inbox = await getCoachInbox();
  console.log(`  coach inbox: ${inbox.address}`);
  const to = sendAllowlist()[0];
  if (!to) throw new Error("SEND_ALLOWLIST is empty");

  const sent = await send({
    to,
    subject: `founder(ish) smoke test ${new Date().toISOString()}`,
    text: "Smoke test 7 from the founder(ish) coach inbox. Reply to this email to complete smoke test 9.",
  });
  const found = (await listSent(10)).some((m) => m.id === sent.messageId);
  if (!found) throw new Error(`sent ${sent.messageId} but it isn't in the sent list`);

  mkdirSync(".smoke", { recursive: true });
  writeFileSync(".smoke/agentboxd-sent.json", JSON.stringify({ ...sent, to }));
  return `sent to ${to} (message ${sent.messageId}, thread ${sent.threadId})`;
});
