"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/approvals", label: "Approvals" },
  { href: "/people", label: "People" },
  { href: "/posts", label: "Posts" },
  { href: "/niche", label: "Niche" },
];

export function NavLinks() {
  const pathname = usePathname();
  return NAV.map((n) => {
    const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
    return (
      <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={`text-sm ${active ? "text-white" : "text-zinc-400 hover:text-white"}`}>
        {n.label}
      </Link>
    );
  });
}
