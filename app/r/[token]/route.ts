import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { recordEvent } from "@/lib/queue";

// Tracked link: log the click, then send the visitor to the landing page with the token attached.
export async function GET(req: Request, ctx: RouteContext<"/r/[token]">) {
  const { token } = await ctx.params;
  const [row] = await db
    .select({ link: schema.links, slug: schema.projects.slug })
    .from(schema.links)
    .innerJoin(schema.projects, eq(schema.links.projectId, schema.projects.id))
    .where(eq(schema.links.token, token));

  if (!row) return Response.redirect(new URL("/", req.url), 302);

  await recordEvent(row.link.projectId, "link_click", { token, contactId: row.link.contactId });
  return Response.redirect(new URL(`/p/${row.slug}?t=${encodeURIComponent(token)}`, req.url), 302);
}
