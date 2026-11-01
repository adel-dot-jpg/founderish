import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { recordEvent, type JobPayloads } from "@/lib/queue";
import { extractSourceFacts } from "@/lib/prompts/sourceFacts";
import { loadProject } from "./_context";

type SourcePayload = { kind: "website" | "resume" | "text"; url?: string; text?: string; filename?: string; pdfBase64?: string };

// Website / resume PDF / pasted text -> facts. LinkedIn is never fetched (login wall + no scraping); the UI asks
// for its "Save to PDF" export or pasted text instead.
export default async function handle({ eventId }: JobPayloads["source.ingest"]) {
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
  if (!event?.projectId) return;
  const src = event.payload as SourcePayload;
  const { project } = await loadProject(event.projectId);

  let text = src.text;
  if (src.kind === "website" && src.url) text = await fetchPageText(src.url);
  const label = src.url ?? src.filename ?? "pasted text";

  const { facts } = await extractSourceFacts({
    kind: src.kind,
    founderName: process.env.OWNER_NAME?.trim() || "The founder",
    projectName: project.name,
    label,
    text,
    pdfBase64: src.pdfBase64,
  });

  if (facts.length) {
    await db.insert(schema.facts).values(
      facts.map((f) => ({
        projectId: project.id,
        text: f,
        sourceType: src.kind === "website" ? ("website" as const) : src.kind === "resume" ? ("resume" as const) : ("manual" as const),
        sourceUrl: src.url ?? src.filename ?? null,
      })),
    );
  }
  await recordEvent(project.id, "source_ingested", { kind: src.kind, label, facts: facts.length });
}

async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "founderish/1.0 (+facts extraction)" } });
  if (!res.ok) throw new Error(`fetch ${url}: ${res.status}`);
  const html = (await res.text()).slice(0, 1_000_000);
  const meta = [...html.matchAll(/<meta[^>]+(?:name|property)="(?:description|og:description|og:title)"[^>]+content="([^"]+)"/gi)].map((m) => m[1]);
  const body = html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return [...meta, body].join("\n").slice(0, 15_000);
}
