import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: "primary" | "secondary";
};

const baseStyles =
  "inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

const variants = {
  primary: "bg-brand text-white hover:bg-brand/90",
  secondary: "border border-slate-300 text-slate-700 hover:border-slate-400",
};

export function ButtonLink({ variant = "primary", className, ...props }: ButtonLinkProps) {
  const classes = `${baseStyles} ${variants[variant]} ${className ?? ""}`.trim();

  return <Link className={classes} {...props} />;
}
