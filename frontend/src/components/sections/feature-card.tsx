import type { ReactNode } from "react";

type FeatureCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
};

export function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-700">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
