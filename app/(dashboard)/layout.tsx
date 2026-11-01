import Image from "next/image";
import Link from "next/link";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/approvals", label: "Approvals" },
  { href: "/posts", label: "Posts" },
  { href: "/niche", label: "Niche" },
];

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-800">
        <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" aria-label="founder(ish) home">
            <Image src="/logotransparent.png" alt="founder(ish)" width={148} height={40} priority className="h-8 w-auto" />
          </Link>
          <Link href="/new" className="order-last ml-auto rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 hover:border-zinc-500">
            + New project
          </Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-zinc-400 hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
