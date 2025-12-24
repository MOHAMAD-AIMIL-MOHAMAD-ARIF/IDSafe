import Link from "next/link";

export function RegistrationComplete() {
  return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-slate-900">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <h2 className="text-2xl font-semibold">Your vault is ready.</h2>
            <p className="text-sm text-emerald-700">
              Setup complete. You can start using IDSafe now.
            </p>
          </div>
        </div>
        <div className="grid gap-2 text-sm text-emerald-900">
          <p>• You’ll sign in with biometrics/passkey.</p>
          <p>• Keep your recovery passphrase safe (only needed if you lose this device).</p>
        </div>
        <Link
          href="/vault"
          className="mt-2 inline-flex w-fit items-center justify-center rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
        >
          Go to Vault
        </Link>
      </div>
    </div>
  );
}
