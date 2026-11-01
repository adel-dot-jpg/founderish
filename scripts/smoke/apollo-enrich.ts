// SPENDS A CREDIT. Only runs with --spend: npm run smoke:apollo-enrich -- --spend
import { readFileSync } from "node:fs";
import { fail, run } from "./_util";
import { ApolloError, enrichPerson } from "@/lib/apollo";

if (!process.argv.includes("--spend")) fail("apollo-enrich", "skipped: uses an Apollo credit. Re-run with -- --spend");

run("apollo-enrich", async () => {
  const [id] = JSON.parse(readFileSync(".smoke/apollo-ids.json", "utf8")) as string[];
  try {
    const person = await enrichPerson(id, { live: true });
    if (!person) throw new Error(`no match for ${id}`);
    if (!person.email) throw new Error(`matched ${person.name} but no email came back`);
    return `${person.name} -> ${person.email} (${person.linkedinUrl ?? "no linkedin"})`;
  } catch (err) {
    if (err instanceof ApolloError) fail("apollo-enrich", `${err.message}\n  body: ${err.body.slice(0, 500)}`);
    throw err;
  }
});
