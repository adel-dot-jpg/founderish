import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentProject } from "@/lib/dashboard";
import { NavLinks } from "./nav-links";
import { ProjectSwitcher } from "./project-switcher";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-800">
        <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" aria-label="founder(ish) home">
            <Image src="/logotransparent.png" alt="founder(ish)" width={148} height={40} priority className="h-8 w-auto" />
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-2">
            <Suspense fallback={null}>
              <Switcher />
            </Suspense>
            <Link href="/new" className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500">
              + New project
            </Link>
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}

// The project profile picker: reads the remembered project (cookie), so it must render inside Suspense.
async function Switcher() {
  const [projects, current] = await Promise.all([
    db.select({ id: schema.projects.id, name: schema.projects.name }).from(schema.projects).orderBy(desc(schema.projects.createdAt)),
    currentProject(),
  ]);
  return <ProjectSwitcher projects={projects} currentId={current?.id ?? null} />;
}
