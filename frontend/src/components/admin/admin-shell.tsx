"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useAdminSession } from "@/hooks/use-admin-session";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/logs", label: "Logs" },
  { href: "/admin/config/kdf", label: "KDF policy" },
  { href: "/admin/config/webauthn", label: "WebAuthn" },
  { href: "/admin/config/session", label: "Session" },
  { href: "/admin/health", label: "Health & metrics" },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

function navClass(isCurrent: boolean) {
  return [
    "rounded-2xl px-3 py-2 text-sm font-semibold transition",
    isCurrent ? "bg-brand/10 text-brand" : "text-slate-600 hover:bg-slate-100",
  ].join(" ");
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = useMemo(() => {
    if (!pathname) return false;
    return ["/admin/login", "/admin/login/start", "/admin/login/verify-otp"].includes(pathname);
  }, [pathname]);
  const { status, error } = useAdminSession(isLogin ? null : pathname, { enabled: !isLogin });

  useEffect(() => {
    if (!isLogin && status === "unauthenticated") {
      router.replace("/admin/login/start");
    }
  }, [isLogin, router, status]);

  if (isLogin) {
    return <div className="min-h-screen bg-slate-50 px-6 py-10">{children}</div>;
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-600">
        Verifying admin session...
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-600">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? "Unable to verify admin session. Please try again."}
        </div>
        <Link
          className="mt-4 inline-flex text-sm font-semibold text-brand"
          href="/admin/login/start"
        >
          Return to admin login
        </Link>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-64">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                IDSafe Admin
              </p>
              <h1 className="text-xl font-semibold">Operations</h1>
              <p className="mt-2 text-sm text-slate-500">
                Monitor access security, recovery, and platform policies.
              </p>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navClass(isActive(pathname, item.href))}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Admin access is restricted to security operators.
            </div>
          </div>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
