import Link from "next/link";

export default function AdminPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-slate-900">Admin Console</h1>
        <Link href="/" className="text-sm font-medium text-brand hover:text-brand/80">
          Return home
        </Link>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
        Admin authentication, audit logs, and policy configuration will be surfaced in this route.
      </div>
    </div>
  );
}
