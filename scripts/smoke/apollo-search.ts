// Free (0 credits). Always hits the real API, even in DEMO_MODE.
import { writeFileSync, mkdirSync } from "node:fs";
import { fail, run } from "./_util";
import { ApolloError, searchPeople } from "@/lib/apollo";

run("apollo-search", async () => {
  try {
    const people = await searchPeople({ person_titles: ["founder"], person_locations: ["Toronto, Canada"], per_page: 3 });
    if (people.length === 0) throw new Error("0 results");
    for (const p of people) console.log(`  ${p.name} | ${p.title} | ${p.company} | ${p.apolloId}`);
    // smoke:apollo-enrich reuses the first id.
    mkdirSync(".smoke", { recursive: true });
    writeFileSync(".smoke/apollo-ids.json", JSON.stringify(people.map((p) => p.apolloId)));
    return `${people.length} people`;
  } catch (err) {
    if (err instanceof ApolloError) fail("apollo-search", `${err.message}\n  body: ${err.body.slice(0, 500)}`);
    throw err;
  }
});
