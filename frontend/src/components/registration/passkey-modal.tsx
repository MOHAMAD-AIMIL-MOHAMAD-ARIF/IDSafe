import { useEffect } from "react";

type PasskeyModalProps = {
  open: boolean;
  title?: string;
  description?: string;
};

export function PasskeyModal({
  open,
  title = "Create your passkey",
  description = "Use your device biometrics/screen lock to create a passkey.",
}: PasskeyModalProps) {
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-2xl">
          🔐
        </div>
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>
        <div className="mt-6 rounded-2xl border border-dashed border-brand/40 bg-brand/5 px-4 py-3 text-xs text-brand">
          Your browser will open the WebAuthn prompt.
        </div>
      </div>
    </div>
  );
}
