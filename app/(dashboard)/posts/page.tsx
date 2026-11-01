import { Suspense } from "react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentProject } from "@/lib/dashboard";
import { PostCard, DraftPostButton } from "./post-card";

export default function PostsPage(props: PageProps<"/posts">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">LinkedIn posts</h1>
        <p className="text-sm text-zinc-400">
          Drafted from your receipts when you ship. You approve, then post it yourself in one click: founder(ish) never posts on your behalf.
        </p>
      </div>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Posts {...props} />
      </Suspense>
    </main>
  );
}

async function Posts({ searchParams }: PageProps<"/posts">) {
  const project = await currentProject((await searchParams).project);
  if (!project) return <p className="text-zinc-500">No project yet.</p>;

  const posts = await db
    .select()
    .from(schema.drafts)
    .where(and(eq(schema.drafts.projectId, project.id), eq(schema.drafts.kind, "post")))
    .orderBy(desc(schema.drafts.createdAt));
  const factIds = [...new Set(posts.flatMap((p) => p.factIds))];
  const facts = factIds.length
    ? await db.select({ id: schema.facts.id, text: schema.facts.text }).from(schema.facts).where(inArray(schema.facts.id, factIds))
    : [];
  const factText = Object.fromEntries(facts.map((f) => [f.id, f.text]));

  return (
    <>
      <DraftPostButton projectId={project.id} />
      {posts.length === 0 && <p className="text-zinc-500">No posts yet. Push to {project.repoUrl.replace("https://github.com/", "")} or draft one above.</p>}
      <div className="flex flex-col gap-4">
        {posts.map((p) => (
          <PostCard key={p.id} post={{ id: p.id, status: p.status, body: p.body }} facts={p.factIds.map((id) => factText[id] ?? "(fact removed)")} />
        ))}
      </div>
    </>
  );
}
