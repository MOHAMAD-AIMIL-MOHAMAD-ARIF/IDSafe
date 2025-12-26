import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for env var: ${name}`);
  return n;
}

function bool(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "true";
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: num("PORT", 4000),

  // Origins
  FRONTEND_ORIGIN: req("FRONTEND_ORIGIN"), // e.g. http://localhost:3000
  BACKEND_ORIGIN: process.env.BACKEND_ORIGIN ?? `http://localhost:${num("PORT", 4000)}`,

  // Recovery UX redirect
  FRONTEND_RECOVERY_PATH: process.env.FRONTEND_RECOVERY_PATH ?? "/recovery",

  // Session
  SESSION_SECRET: req("SESSION_SECRET"),
  SESSION_NAME: process.env.SESSION_NAME ?? "idsafe.sid",
  SESSION_MAX_AGE_MS: num("SESSION_MAX_AGE_MS", 30 * 60 * 1000),

  // Behind reverse proxy (Render, Nginx, etc.)
  TRUST_PROXY: bool("TRUST_PROXY", false),

  // Force HTTPS redirect (only enable when TLS is present at proxy)
  FORCE_HTTPS: bool("FORCE_HTTPS", false),

  // Cookie policy
  COOKIE_SECURE: bool("COOKIE_SECURE", false),
  COOKIE_SAMESITE: (process.env.COOKIE_SAMESITE ?? "lax") as "lax" | "strict" | "none",

  // Rate limiting knobs
  RL_AUTH_WINDOW_MS: num("RL_AUTH_WINDOW_MS", 10 * 60 * 1000),
  RL_AUTH_MAX: num("RL_AUTH_MAX", 10),

  RL_RECOVERY_WINDOW_MS: num("RL_RECOVERY_WINDOW_MS", 15 * 60 * 1000),
  RL_RECOVERY_MAX: num("RL_RECOVERY_MAX", 5),

  // Recovery TTLs + hashing
  RECOVERY_SESSION_TTL_MS: num("RECOVERY_SESSION_TTL_MS", 15 * 60 * 1000),
  RECOVERY_TOKEN_TTL_MS: num("RECOVERY_TOKEN_TTL_MS", 15 * 60 * 1000),
  RECOVERY_TOKEN_PEPPER: process.env.RECOVERY_TOKEN_PEPPER ?? "",
  RECOVERY_TOKEN_TYPE: process.env.RECOVERY_TOKEN_TYPE ?? "RECOVERY",

  // Admin OTP auth
  ADMIN_OTP_TTL_MS: num("ADMIN_OTP_TTL_MS", 5 * 60 * 1000),
  ADMIN_OTP_PEPPER: process.env.ADMIN_OTP_PEPPER ?? "",
  ADMIN_LOGIN_MAX_ATTEMPTS: num("ADMIN_LOGIN_MAX_ATTEMPTS", 5),
  ADMIN_LOGIN_LOCK_MINUTES: num("ADMIN_LOGIN_LOCK_MINUTES", 15),

  // SMTP (optional in dev; required if you actually send emails)
  EMAIL_SMTP_HOST: process.env.EMAIL_SMTP_HOST ?? "",
  EMAIL_SMTP_PORT: num("EMAIL_SMTP_PORT", 587),
  EMAIL_SMTP_USER: process.env.EMAIL_SMTP_USER ?? "",
  EMAIL_SMTP_PASS: process.env.EMAIL_SMTP_PASS ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "no-reply@idsafe.local",

  // ConfigService cache TTL
  CONFIG_CACHE_TTL_MS: num("CONFIG_CACHE_TTL_MS", 60_000),

  // WebAuthn
  WEBAUTHN_RP_ID: process.env.WEBAUTHN_RP_ID ?? "localhost",
  WEBAUTHN_RP_NAME: process.env.WEBAUTHN_RP_NAME ?? "IDSafe",
  WEBAUTHN_EXPECTED_ORIGIN: process.env.WEBAUTHN_EXPECTED_ORIGIN ?? req("FRONTEND_ORIGIN"),

  // DB URL (used for Prisma + session store)
  DATABASE_URL: req("DATABASE_URL"),
};
