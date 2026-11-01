import Link from "next/link";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/approvals", label: "Approvals" },
];

// TODO(B): Network, Users, Niche, Posts pages.
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            founder<span className="text-zinc-400">(ish)</span>
          </Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
