import { Suspense } from "react";
import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { currentProject } from "@/lib/dashboard";
import { trafficStats } from "@/lib/traffic";
import { CopyButton } from "./copy-button";
import { AddFactForm } from "./add-fact-form";
import { SourceForm } from "./source-form";

export default function Overview(props: PageProps<"/">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-10">
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Dashboard {...props} />
      </Suspense>
    </main>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  repo: "repo",
  readme: "README",
  commit: "commit",
  signup: "waitlist",
  reply: "reply",
  manual: "you",
  traffic: "live traffic",
  website: "website",
  resume: "resume",
};

async function Dashboard({ searchParams }: PageProps<"/">) {
  const project = await currentProject((await searchParams).project);
  if (!project) {
    return (
      <p className="text-zinc-400">
        No project yet. <Link href="/new" className="text-brand underline">Link a repo to start</Link>.
      </p>
    );
  }

  const [projects, traffic, facts, events, outreach] = await Promise.all([
    db.select({ id: schema.projects.id, name: schema.projects.name }).from(schema.projects).orderBy(desc(schema.projects.createdAt)),
    trafficStats(project.id, 7),
    db.select().from(schema.facts).where(eq(schema.facts.projectId, project.id)).orderBy(desc(schema.facts.createdAt)),
    // Never pull file payloads (resume PDFs) into the feed.
    db
      .select({ id: schema.events.id, type: schema.events.type, createdAt: schema.events.createdAt, payload: sql<Record<string, unknown>>`${schema.events.payload} - 'pdfBase64'` })
      .from(schema.events)
      .where(and(eq(schema.events.projectId, project.id), sql`${schema.events.type} <> 'traffic'`))
      .orderBy(desc(schema.events.createdAt))
      .limit(25),
    db
      .select({
        sent: sql<number>`count(*) filter (where ${schema.contacts.status} in ('sent','replied','meeting','dead'))`.mapWith(Number),
        replied: sql<number>`count(*) filter (where ${schema.contacts.status} in ('replied','meeting'))`.mapWith(Number),
        found: sql<number>`count(*)`.mapWith(Number),
      })
      .from(schema.contacts)
      .where(eq(schema.contacts.projectId, project.id)),
  ]);
  const pending = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(schema.drafts)
    .where(and(eq(schema.drafts.projectId, project.id), inArray(schema.drafts.status, ["pending", "flagged"])));

  const snippet = `<script defer src="${appUrl()}/t.js" data-project="${project.slug}"></script>`;
  const signupCall = `window.founderish?.track("signup")`;

  return (
    <>
      <section className="flex flex-col gap-2">
        {projects.length > 1 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {projects.map((p) => (
              <Link key={p.id} href={`/?project=${p.id}`} className={`rounded-full border px-2.5 py-0.5 ${p.id === project.id ? "border-brand text-brand" : "border-zinc-700 text-zinc-400"}`}>
                {p.name}
              </Link>
            ))}
          </div>
        )}
        <h1 className="font-mono text-3xl font-bold tracking-tight">{project.name}</h1>
        {project.pitch && <p className="max-w-3xl text-lg text-zinc-300">{project.pitch}</p>}
        <p className="flex flex-wrap gap-4 text-sm text-zinc-500">
          {project.siteUrl && <a href={project.siteUrl} className="hover:text-white">{project.siteUrl.replace(/^https?:\/\//, "")}</a>}
          <a href={project.repoUrl} className="hover:text-white">{project.repoUrl.replace("https://github.com/", "github/")}</a>
          <Link href={`/p/${project.slug}`} className="hover:text-white">landing page</Link>
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Visitors · 7d" value={traffic.visitors} />
        <Stat label="Pageviews · 7d" value={traffic.pageviews} />
        <Stat label="App signups · 7d" value={traffic.signups} />
        <Stat label="Emails sent" value={outreach[0].sent} />
        <Stat label="Replies" value={outreach[0].replied} />
        <Stat label="Waiting on you" value={pending[0].n} href="/approvals" accent={pending[0].n > 0} />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-800 p-5">
        <div>
          <h2 className="font-medium">Connect {project.siteUrl ? project.siteUrl.replace(/^https?:\/\/(www\.)?/, "") : "your app"}</h2>
          <p className="text-sm text-zinc-400">
            Paste this into your site&apos;s layout. Real traffic and signups become receipts your outreach can cite.
            {traffic.pageviews > 0 && traffic.referrers.length > 0 && <> Top referrers: {traffic.referrers.map((r) => `${r.host} (${r.n})`).join(", ")}.</>}
          </p>
        </div>
        <Snippet code={snippet} />
        <p className="text-sm text-zinc-400">After a successful signup, call:</p>
        <Snippet code={signupCall} />
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">
            Receipts <span className="text-sm font-normal text-zinc-500">· the only claims founder(ish) will make</span>
          </h2>
          <SourceForm projectId={project.id} />
          <AddFactForm projectId={project.id} />
          <ul className="flex flex-col gap-1.5 text-sm">
            {facts.map((f) => (
              <li key={f.id} className="flex gap-2">
                <span className="mt-0.5 shrink-0 rounded border border-zinc-700 px-1.5 text-[11px] uppercase tracking-wide text-zinc-400">{SOURCE_LABEL[f.sourceType]}</span>
                <span className="text-zinc-200">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="font-medium">Activity</h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="shrink-0 font-mono text-zinc-500">{e.createdAt.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", timeZone: "America/Toronto" })}</span>
                <span className="text-zinc-300">{describe(e)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, href, accent }: { label: string; value: number; href?: string; accent?: boolean }) {
  const body = (
    <div className={`rounded-lg border p-4 ${accent ? "border-brand" : "border-zinc-800"}`}>
      <p className="font-mono text-2xl font-bold">{value}</p>
      <p className="text-xs text-zinc-400">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Snippet({ code }: { code: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-zinc-900 p-3">
      <code className="flex-1 overflow-x-auto font-mono text-xs text-zinc-200">{code}</code>
      <CopyButton text={code} />
    </div>
  );
}

function describe(e: { type: string; payload: Record<string, unknown> }): string {
  const p = e.payload as Record<string, unknown>;
  switch (e.type) {
    case "project_created": return "Project created";
    case "project_ingested": return `Read the repo: ${p.facts} receipts found`;
    case "audiences_generated": return `Picked ${(p.audiences as string[])?.length ?? 0} audiences to test`;
    case "people_found": return `Found ${p.found} people for “${p.audience}” (${p.new} new)`;
    case "people_search_requested": return "Searching Apollo for more people";
    case "people_ranked": return `Ranked ${p.ranked} people for “${p.audience}”`;
    case "receipt_passed": return `Draft passed the receipt check${p.rewritten ? " after a rewrite" : ""}`;
    case "receipt_flagged": return "Draft flagged: unsupported claim";
    case "draft_approved": return `Draft approved${p.via === "email" ? " by email" : ""}`;
    case "draft_rejected": return "Draft rejected";
    case "email_sent": return `Email sent to ${p.to}`;
    case "send_blocked": return "Send blocked by DEMO_MODE";
    case "link_click": return "Someone clicked a tracked link";
    case "signup": return "New waitlist signup";
    case "reply_received": return `${p.name} replied (${p.classification}): ${p.summary}`;
    case "brief_sent": return `Brief emailed (${p.numbered} to approve)`;
    case "facts_refreshed": return `Live numbers updated: ${p.visitors} visitors, ${p.signups} signups`;
    case "fact_added": return `Receipt added: ${p.text}`;
    case "source_added": return `Reading ${p.url ?? p.filename ?? "pasted text"}`;
    case "source_ingested": return `Learned ${p.facts} receipts from ${p.label}`;
    case "post_requested": return "Post requested";
    case "brief_requested": return "Brief requested";
    case "post_drafted": return "LinkedIn post drafted";
    case "post_published": return "LinkedIn post published";
    case "followup_drafted": return `Follow-up drafted for ${p.name}`;
    case "github_push": return `New push to ${p.repo}`;
    default: return e.type.replaceAll("_", " ");
  }
}
