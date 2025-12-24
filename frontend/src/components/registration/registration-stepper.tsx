import type { RegistrationStep } from "@/hooks/use-registration";

const statusStyles: Record<RegistrationStep["status"], string> = {
  pending: "border-slate-200 text-slate-400",
  in_progress: "border-brand text-brand",
  completed: "border-emerald-500 text-emerald-600",
  error: "border-red-500 text-red-500",
};

const statusIcon: Record<RegistrationStep["status"], string> = {
  pending: "○",
  in_progress: "⏳",
  completed: "✓",
  error: "!",
};

export function RegistrationStepper({ steps }: { steps: RegistrationStep[] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        {steps.map((step) => (
          <div key={step.id} className="flex items-start gap-3">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold ${
                statusStyles[step.status]
              }`}
            >
              {statusIcon[step.status]}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900">{step.label}</span>
              <span className="text-xs text-slate-500 capitalize">
                {step.status.replace("_", " ")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
