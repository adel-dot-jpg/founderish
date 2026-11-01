// Dry run of the coach pipeline without the DB or the worker: repo -> facts -> audiences -> Apollo -> rank -> draft -> receipt check.
// Usage: npm run try:pipeline [-- owner/repo]
import "dotenv/config";
import { ingestRepo } from "@/lib/github";
import { searchPeople } from "@/lib/apollo";
import { extractFacts } from "@/lib/prompts/profile";
import { proposeAudiences } from "@/lib/prompts/audiences";
import { rankContacts } from "@/lib/prompts/rank";
import { draftEmail } from "@/lib/prompts/draftEmail";
import { checkReceipts } from "@/lib/prompts/receiptCheck";
import { factTable } from "@/lib/prompts/voice";

const t0 = Date.now();
const step = (label: string) => console.log(`\n== ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);

async function main() {
  const repo = process.argv[2] ?? process.env.TEST_REPO!;
  step(`ingest ${repo}`);
  const profile = await ingestRepo(repo);

  step("facts");
  const { pitch, facts } = await extractFacts(profile);
  const rows = facts.map((f, i) => ({ id: `fact-${i + 1}`, text: f.text }));
  const table = factTable(rows);
  console.log(`pitch: ${pitch}\n${table.text}`);

  step("audiences");
  const aud = await proposeAudiences({ pitch, factsText: table.text, location: "Toronto, Canada" });
  for (const a of [...aud.down.map((x) => ({ ...x, dir: "down" })), ...aud.up.map((x) => ({ ...x, dir: "up" }))]) {
    console.log(`[${a.dir}] ${a.name}: ${JSON.stringify(a.apollo_filters)}`);
  }

  const picks = [
    { ...aud.down[0], direction: "down" as const },
    { ...aud.up[0], direction: "up" as const },
  ];
  for (const a of picks) {
    step(`apollo + rank: ${a.name}`);
    const people = await searchPeople({ ...a.apollo_filters, person_locations: ["Toronto, Canada"], per_page: 8 });
    const contacts = people.map((p) => ({ id: p.apolloId, name: p.name, title: p.title, company: p.company }));
    const ranked = (await rankContacts({ pitch, factsText: table.text, audience: { ...a, direction: a.direction }, contacts })).sort(
      (x, y) => y.score - x.score,
    );
    for (const r of ranked) {
      const c = contacts.find((x) => x.id === r.id)!;
      console.log(`${r.score.toString().padStart(3)}  ${c.name}, ${c.title} @ ${c.company}: ${r.reason}`);
    }

    const top = contacts.find((x) => x.id === ranked[0]?.id);
    if (!top) continue;
    step(`draft for ${top.name}`);
    const draft = await draftEmail({
      direction: a.direction,
      projectName: profile.fullName.split("/")[1],
      pitch,
      factsText: table.text,
      audience: a.name,
      contact: { ...top, reason: ranked[0].reason },
    });
    console.log(`Subject: ${draft.subject}\n${draft.body}\nfacts: ${draft.facts_used.join(", ")}`);

    step("receipt check");
    const check = await checkReceipts({ subject: draft.subject, body: draft.body, factsText: table.text });
    for (const c of check.claims) console.log(`${c.fact ? "OK " + c.fact.padEnd(4) : "UNSUPPORTED"}  ${c.claim}`);
    if (check.revised_body) console.log(`-- revised --\n${check.revised_body}`);
  }
  step("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
