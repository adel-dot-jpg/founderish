import { Suspense } from "react";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

// Overview: projects + activity feed from events. TODO(B): Network, Users, Approvals, Niche, Posts pages.
export default function Overview() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">founder(ish)</h1>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Feed />
      </Suspense>
    </main>
  );
}

async function Feed() {
  const [projects, events] = await Promise.all([
    db.select().from(schema.projects).orderBy(desc(schema.projects.createdAt)),
    db.select().from(schema.events).orderBy(desc(schema.events.createdAt)).limit(30),
  ]);

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Projects</h2>
        {projects.length === 0 && <p className="text-zinc-500">No projects yet. POST /api/projects or run npm run seed.</p>}
        {projects.map((p) => (
          <a key={p.id} href={`/p/${p.slug}`} className="underline">
            {p.name}
          </a>
        ))}
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Activity</h2>
        <ul className="flex flex-col gap-1 font-mono text-sm">
          {events.map((e) => (
            <li key={e.id}>
              <span className="text-zinc-500">{e.createdAt.toISOString().slice(11, 19)}</span> {e.type}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
