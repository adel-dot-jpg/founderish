import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { WaitlistForm } from "./waitlist-form";

// Public landing page + waitlist. TODO(B): design pass.
export default function LandingPage(props: PageProps<"/p/[slug]">) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-16">
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <Landing {...props} />
      </Suspense>
    </main>
  );
}

async function Landing({ params, searchParams }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const { t } = await searchParams;
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.slug, slug));
  if (!project) notFound();

  return (
    <>
      <h1 className="text-4xl font-semibold tracking-tight">{project.name}</h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-300">{project.pitch ?? project.description}</p>
      <WaitlistForm slug={slug} token={typeof t === "string" ? t : undefined} />
    </>
  );
}
