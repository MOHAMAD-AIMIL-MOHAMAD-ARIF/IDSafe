// src/config/env.ts
import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 4000),

  // Next.js origin (for CORS + cookies)
  FRONTEND_ORIGIN: req("FRONTEND_ORIGIN"), // e.g. http://localhost:3000

  // Session
  SESSION_SECRET: req("SESSION_SECRET"),
  SESSION_NAME: process.env.SESSION_NAME ?? "idsafe.sid",
  SESSION_MAX_AGE_MS: Number(process.env.SESSION_MAX_AGE_MS ?? String(30 * 60 * 1000)), // 30 min

  // Behind reverse proxy (Render, Nginx, etc.)
  TRUST_PROXY: process.env.TRUST_PROXY === "true",

  // Force HTTPS redirect (only enable when TLS is present at proxy)
  FORCE_HTTPS: process.env.FORCE_HTTPS === "true",

  // Cookie policy
  COOKIE_SECURE: process.env.COOKIE_SECURE === "true", // recommended true in prod
  COOKIE_SAMESITE: (process.env.COOKIE_SAMESITE ?? "lax") as "lax" | "strict" | "none",

  // Rate limiting knobs
  RL_AUTH_WINDOW_MS: Number(process.env.RL_AUTH_WINDOW_MS ?? String(10 * 60 * 1000)),
  RL_AUTH_MAX: Number(process.env.RL_AUTH_MAX ?? "10"),

  RL_RECOVERY_WINDOW_MS: Number(process.env.RL_RECOVERY_WINDOW_MS ?? String(15 * 60 * 1000)),
  RL_RECOVERY_MAX: Number(process.env.RL_RECOVERY_MAX ?? "5"),

  // DB URL (used for session store)
  DATABASE_URL: req("DATABASE_URL"),
};
