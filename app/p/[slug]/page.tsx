import type { Metadata } from "next";
import { cache, Suspense } from "react";
import { and, asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { WaitlistForm } from "./waitlist-form";

// Public landing page + waitlist, where tracked links in outreach lead. A signup carrying the link's token is
// credited to the contact (and audience) that brought it in.

// The page and its metadata both need the project: one query per request.
const projectBySlug = cache(async (slug: string) => {
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.slug, slug));
  return project ?? null;
});

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const project = await projectBySlug((await params).slug);
  return project ? { title: project.name, description: project.pitch ?? project.description ?? undefined } : {};
}

export default function LandingPage(props: PageProps<"/p/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-10 px-4 py-20">
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Landing {...props} />
      </Suspense>
    </main>
  );
}

async function Landing({ params, searchParams }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const { t } = await searchParams;
  const project = await projectBySlug(slug);
  if (!project) notFound();

  // Product receipts only: the founder's resume, live traffic and contacts' replies stay on the dashboard.
  const facts = await db
    .select({ id: schema.facts.id, text: schema.facts.text })
    .from(schema.facts)
    .where(and(eq(schema.facts.projectId, project.id), inArray(schema.facts.sourceType, ["readme", "website"])))
    .orderBy(asc(schema.facts.createdAt))
    .limit(4);
  const pitch = project.pitch ?? project.description;

  return (
    <>
      <header className="flex flex-col gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">Early access</p>
        <h1 className="text-5xl font-semibold tracking-tight">{project.name}</h1>
        {pitch && <p className="text-xl leading-relaxed text-zinc-300">{pitch}</p>}
      </header>

      <WaitlistForm slug={slug} token={typeof t === "string" ? t : undefined} />

      {facts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-zinc-400">What it does</h2>
          <ul className="flex flex-col gap-2">
            {facts.map((f) => (
              <li key={f.id} className="flex gap-3 text-zinc-200">
                <span aria-hidden className="text-brand">✓</span>
                {f.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-800 pt-4 text-sm text-zinc-500">
        {project.siteUrl && (
          <a href={project.siteUrl} className="hover:text-white">
            {new URL(project.siteUrl).hostname.replace(/^www\./, "")}
          </a>
        )}
        <span>Page by founder(ish)</span>
      </footer>
    </>
  );
}
