import Link from "next/link";

const navItems = [
  { label: "Login", href: "/login" },
  { label: "Register", href: "/register" },
  { label: "Vault", href: "/vault" },
  { label: "Account", href: "/account" },
  { label: "Admin", href: "/admin" },
];

export function SiteHeader() {
  return (
    <header className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-sm font-semibold text-white">
          ID
        </span>
        <div>
          <p className="text-sm font-semibold">IDSafe</p>
          <p className="text-xs text-slate-500">Zero-knowledge vault</p>
        </div>
      </div>
      <nav className="hidden items-center gap-4 text-sm font-medium text-slate-600 md:flex">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="transition hover:text-slate-900">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
