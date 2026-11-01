import { Suspense } from "react";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentProject } from "@/lib/dashboard";
import { nicheSnapshot } from "@/lib/niche";

export default function NichePage(props: PageProps<"/niche">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Which niche is responding</h1>
        <p className="text-sm text-zinc-400">
          Response score per user audience: (positive replies × 3 + waitlist signups × 2 + link clicks) ÷ emails sent.
        </p>
      </div>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Niche {...props} />
      </Suspense>
    </main>
  );
}

async function Niche({ searchParams }: PageProps<"/niche">) {
  const project = await currentProject((await searchParams).project);
  if (!project) return <p className="text-zinc-500">No project yet.</p>;

  const rows = await nicheSnapshot(project.id);
  const found = await db
    .select({ audienceId: schema.contacts.audienceId, n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.contacts)
    .where(and(eq(schema.contacts.projectId, project.id), eq(schema.contacts.direction, "down")))
    .groupBy(schema.contacts.audienceId);
  if (!rows.length) return <p className="text-zinc-500">No user audiences yet.</p>;

  const max = Math.max(...rows.map((r) => r.score), 0.01);
  const totalSent = rows.reduce((n, r) => n + r.sent, 0);
  const leader = rows[0].score > 0 && (rows.length === 1 || rows[0].score >= rows[1].score * 1.5) ? rows[0] : null;

  return (
    <>
      <section className="rounded-lg border border-zinc-800 bg-[#141414] p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Response score by audience</h2>
          <p className="text-sm text-zinc-400">
            {totalSent === 0
              ? "No emails sent yet: approve a few drafts to start the comparison."
              : leader
                ? `${leader.name} leads (${leader.score.toFixed(2)}). Double down there.`
                : `${totalSent} emails sent. No clear leader yet.`}
          </p>
        </div>
        <ul className="flex flex-col gap-3" aria-label="Response score by audience">
          {rows.map((r) => {
            const pct = (r.score / max) * 100;
            return (
              <li key={r.id} className="group relative grid grid-cols-[minmax(8rem,14rem)_1fr] items-center gap-3">
                <span className="truncate text-sm text-zinc-200" title={r.name}>{r.name}</span>
                <div className="flex items-center gap-2 border-l border-zinc-700">
                  {/* Single series: one validated hue, <= 24px thick, 4px rounded data end, square at the baseline. */}
                  <div className="h-5 rounded-r bg-brand-bar transition-[filter] group-hover:brightness-125" style={{ width: `${Math.max(pct, r.score > 0 ? 1 : 0)}%` }} />
                  <span className="font-mono text-sm text-zinc-300">{r.score.toFixed(2)}</span>
                </div>
                {/* Hover tooltip: the breakdown behind the score. */}
                <div className="pointer-events-none absolute left-[min(14rem,40%)] top-7 z-10 hidden rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 shadow-lg group-hover:block">
                  <p className="font-medium">{r.name}</p>
                  <p>{r.sent} sent · {r.replies} positive replies · {r.signups} signups · {r.clicks} clicks</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-medium">The numbers</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-400">
              <tr className="border-b border-zinc-800">
                <th className="py-2 pr-4 font-normal">Audience</th>
                <th className="py-2 pr-4 text-right font-normal">People found</th>
                <th className="py-2 pr-4 text-right font-normal">Emails sent</th>
                <th className="py-2 pr-4 text-right font-normal">Positive replies</th>
                <th className="py-2 pr-4 text-right font-normal">Link clicks</th>
                <th className="py-2 pr-4 text-right font-normal">Signups</th>
                <th className="py-2 text-right font-normal">Score</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-zinc-900">
                  <td className="py-2 pr-4 font-sans text-zinc-200">{r.name}</td>
                  <td className="py-2 pr-4 text-right">{found.find((f) => f.audienceId === r.id)?.n ?? 0}</td>
                  <td className="py-2 pr-4 text-right">{r.sent}</td>
                  <td className="py-2 pr-4 text-right">{r.replies}</td>
                  <td className="py-2 pr-4 text-right">{r.clicks}</td>
                  <td className="py-2 pr-4 text-right">{r.signups}</td>
                  <td className="py-2 text-right">{r.score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
