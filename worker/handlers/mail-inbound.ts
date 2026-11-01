import type { JobPayloads } from "@/lib/queue";

// TODO(C): Owner (OWNER_EMAIL + authPassed) -> parse brief commands. Else match thread to contact, classify, update status, draft reply. needsHuman() mail is never auto-drafted.
export default async function handle(data: JobPayloads["mail.inbound"]) {
  console.log("[mail.inbound] stub", data);
}
