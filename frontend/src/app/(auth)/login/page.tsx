import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold text-slate-900">Login</h1>
      <p className="text-slate-600">
        WebAuthn login flow placeholder. This route will host the credential assertion ceremony.
      </p>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/" className="font-medium text-brand hover:text-brand/80">
          Back to home
        </Link>
        <Link href="/register" className="text-slate-500 hover:text-slate-700">
          Create an account
        </Link>
      </div>
    </div>
  );
}
