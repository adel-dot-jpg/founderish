"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function rememberProject(id: string) {
  document.cookie = `fi_project=${id}; path=/; max-age=31536000; samesite=lax`;
}

// Project profiles: the chosen project is remembered in a cookie that every dashboard page reads.
export function ProjectSwitcher({ projects, currentId }: { projects: { id: string; name: string }[]; currentId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get("project");

  // A ?project= link (e.g. right after creating one) becomes the remembered choice.
  useEffect(() => {
    if (fromUrl && fromUrl !== currentId) {
      rememberProject(fromUrl);
      router.refresh();
    }
  }, [fromUrl, currentId, router]);

  if (!projects.length) return null;
  return (
    <select
      aria-label="Project"
      value={fromUrl ?? currentId ?? ""}
      onChange={(e) => {
        rememberProject(e.target.value);
        router.replace(pathname);
        router.refresh();
      }}
      className="rounded-md border border-brand bg-transparent px-2 py-1 text-sm text-brand"
    >
      {projects.map((p) => (
        <option key={p.id} value={p.id} className="bg-zinc-900 text-white">
          {p.name}
        </option>
      ))}
    </select>
  );
}
