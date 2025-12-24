import { FeatureCard } from "@/components/sections/feature-card";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ButtonLink } from "@/components/ui/button-link";

const features = [
  {
    title: "WebAuthn-first access",
    description:
      "Register and sign in using platform authenticators for passwordless, biometric-first security.",
    icon: "🔐",
  },
  {
    title: "Client-side encryption",
    description:
      "Vault entries are encrypted in the browser using AES-256-GCM before they ever reach the server.",
    icon: "🛡️",
  },
  {
    title: "Recovery-ready",
    description:
      "Set a recovery passphrase to derive a KEK and re-wrap the vault key when devices change.",
    icon: "🧩",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12">
        <SiteHeader />

        <main className="flex flex-col gap-12">
          <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="flex flex-col gap-6">
              <span className="w-fit rounded-full bg-brand/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
                Passkey-first onboarding
              </span>
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                IDSafe keeps your vault locked behind passkeys and client-side encryption.
              </h1>
              <p className="text-lg leading-7 text-slate-600">
                Create your account with a passkey, set a recovery passphrase, and let IDSafe set up
                your encrypted vault automatically.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <ButtonLink href="/register">Create account (Passkey)</ButtonLink>
                <ButtonLink href="/login" variant="secondary">
                  Sign in
                </ButtonLink>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Status
                  </p>
                  <p className="text-2xl font-semibold text-slate-900">Ready to onboard</p>
                  <p className="text-sm text-slate-500">
                    Register a passkey and keep your recovery phrase safe to unlock cross-device access.
                  </p>
                </div>
                <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>WebAuthn-ready auth flow</span>
                    <span className="font-semibold text-emerald-600">Active</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Vault encryption pipeline</span>
                    <span className="font-semibold text-emerald-600">Active</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Recovery & admin views</span>
                    <span className="font-semibold text-slate-800">Planned</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </section>
        </main>

        <SiteFooter />
      </div>
    </div>
  );
}
