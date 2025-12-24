import Link from "next/link";
import { routes } from "@/lib/config/routes";

export default function RecoveryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 py-12 text-slate-900">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand">Account recovery</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Re-bind a new device</h1>
          <p className="text-base text-slate-600">
            Use your recovery passphrase to unlock and re-wrap the vault key on this device. Once
            complete, you can return to passkey-only logins.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Recovery checklist</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Have your recovery passphrase available.</li>
              <li>Keep this device ready for passkey registration.</li>
              <li>Complete the recovery steps to bind a new device key.</li>
            </ul>
            <p>
              Recovery flow UI will be added here next. If you need help now, contact your
              administrator or support team.
            </p>
          </div>
        </section>

        <div className="flex items-center gap-4 text-sm">
          <Link href={routes.login} className="font-medium text-brand hover:text-brand/80">
            Back to login
          </Link>
          <Link href={routes.home} className="text-slate-500 hover:text-slate-700">
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
