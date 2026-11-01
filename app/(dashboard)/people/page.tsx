import { Suspense } from "react";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentProject } from "@/lib/dashboard";
import { isDemoMode } from "@/lib/env";
import { FindMoreButton } from "./find-more-button";
import { ActionButton } from "../action-button";

export default function PeoplePage(props: PageProps<"/people">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <p className="text-sm text-zinc-400">
          Found on Apollo for each audience, scored by how likely they are to help (Network) or to use it (Users). The top pick per audience gets a draft.
        </p>
      </div>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <People {...props} />
      </Suspense>
    </main>
  );
}

const STATUS_STYLE: Record<string, string> = {
  found: "text-zinc-500",
  drafted: "text-amber-300",
  sent: "text-blue-300",
  replied: "text-green-300",
  meeting: "text-green-300",
  dead: "text-zinc-600",
};

async function People({ searchParams }: PageProps<"/people">) {
  const project = await currentProject((await searchParams).project);
  if (!project) return <p className="text-zinc-500">No project yet.</p>;

  const [audiences, contacts] = await Promise.all([
    db.select().from(schema.audiences).where(eq(schema.audiences.projectId, project.id)).orderBy(asc(schema.audiences.direction), asc(schema.audiences.createdAt)),
    db.select().from(schema.contacts).where(eq(schema.contacts.projectId, project.id)).orderBy(desc(schema.contacts.score)),
  ]);

  return (
    <>
      <div>
        <ActionButton url={`/api/projects/${project.id}/find`} label="Find people now" busyLabel="Searching Apollo… (about 30s)" refreshAfterMs={30000} />
      </div>
      {isDemoMode() && (
        <p className="rounded-md border border-amber-800 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          DEMO_MODE is on: people and titles are real Apollo results, but emails are swapped for your SEND_ALLOWLIST so nobody real is contacted and no Apollo credits are spent.
        </p>
      )}
      {(["up", "down"] as const).map((dir) => (
        <section key={dir} className="flex flex-col gap-6">
          <h2 className="text-lg font-medium">{dir === "up" ? "⬆ Network: people who can open doors" : "⬇ Users: niches to test"}</h2>
          {audiences
            .filter((a) => a.direction === dir)
            .map((a) => {
              const people = contacts.filter((c) => c.audienceId === a.id);
              const f = a.apolloFilters;
              return (
                <div key={a.id} className="rounded-lg border border-zinc-800 p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {a.name} <span className="text-sm font-normal text-zinc-500">· {people.length} found</span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        Apollo: {(f.person_titles ?? []).join(", ")}
                        {f.q_keywords ? ` · “${f.q_keywords}”` : ""}
                        {f.person_locations?.length ? ` · ${f.person_locations.join(", ")}` : ""}
                      </p>
                    </div>
                    <FindMoreButton projectId={project.id} audienceId={a.id} />
                  </div>
                  <table className="w-full text-left text-sm">
                    <tbody>
                      {people.slice(0, 8).map((c) => (
                        <tr key={c.id} className="border-t border-zinc-900 align-top">
                          <td className="w-10 py-2 pr-3 font-mono text-zinc-300">{c.score ?? "–"}</td>
                          <td className="py-2 pr-3">
                            <p className="text-zinc-100">{c.name}</p>
                            <p className="text-xs text-zinc-500">
                              {c.title}
                              {c.company ? ` · ${c.company}` : ""}
                            </p>
                          </td>
                          <td className="hidden py-2 pr-3 text-xs italic text-zinc-400 md:table-cell">{c.reason}</td>
                          <td className="py-2 text-right text-xs">
                            <p className={STATUS_STYLE[c.status]}>{c.status}</p>
                            {c.email && <p className="text-zinc-500">{c.email}</p>}
                            <a
                              href={c.linkedinUrl ?? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${c.name.split(" ")[0]} ${c.company ?? ""}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-500 underline hover:text-white"
                            >
                              LinkedIn
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {people.length > 8 && <p className="mt-2 text-xs text-zinc-500">+ {people.length - 8} more, lower scores</p>}
                </div>
              );
            })}
        </section>
      ))}
    </>
  );
}
