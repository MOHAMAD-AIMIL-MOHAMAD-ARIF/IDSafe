// src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

import { env } from "./config/env.js";
import { pool, prisma } from "./db.js";
import { httpsOnly } from "./middleware/httpsOnly.js";
import { webauthnLimiter, recoveryLimiter } from "./middleware/rateLimiters.js";

export const app = express();

if (env.TRUST_PROXY) app.set("trust proxy", 1);

// NFR-S4: enforce HTTPS (enable only when TLS exists at proxy)
app.use(httpsOnly(env.FORCE_HTTPS));

// Security headers
app.use(
  helmet({
    // If your Next.js frontend is on a different origin and you embed resources,
    // you may need to tune CSP later. Start with defaults.
    // You can enable CSP later once frontend routes are stable.
    contentSecurityPolicy: false,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// CORS for Next.js frontend + cookie sessions
app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Requested-With"],
  }),
);

// Session store (Postgres) — recommended vs MemoryStore
// Session store in Postgres
const PgSession = connectPgSimple(session);

app.use(
  session({
    name: env.SESSION_NAME,
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    // “rolling” refreshes cookie expiry on activity → good for “idle timeout”
    rolling: true,

    cookie: {
      httpOnly: true, // NFR-S5 :contentReference[oaicite:5]{index=5}
      secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
      sameSite: env.COOKIE_SAMESITE, // "lax" recommended; "none" requires secure=true
      maxAge: env.SESSION_MAX_AGE_MS,
    },

    store: new PgSession({
      pool,
      createTableIfMissing: true,
      // ttl is in seconds; match cookie maxAge
      ttl: Math.floor(env.SESSION_MAX_AGE_MS / 1000),
    }),
  }),
);

// ---- Routes ----

// Health: checks DB connectivity through Prisma
app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
});

// ---- End-user WebAuthn ----
app.post("/auth/webauthn/register/start", webauthnLimiter, (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

app.post("/auth/webauthn/register/finish", webauthnLimiter, (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

app.post("/auth/webauthn/login/start", webauthnLimiter, (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

app.post("/auth/webauthn/login/finish", webauthnLimiter, (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

// ---- After recovery: WebAuthn re-registration ----
app.post("/auth/webauthn/recovery/register/start", recoveryLimiter, (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

app.post("/auth/webauthn/recovery/register/finish", recoveryLimiter, (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

// ---- WebAuthn credential management (NOT required by NFR-S8, so no limiter by default) ----
app.get("/auth/webauthn/credentials", (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

app.delete("/auth/webauthn/credentials/:credentialId", (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

// ---- Device-binding (not required by NFR-S8; optionally add a limiter later if you want) ----
app.post("/auth/device/bind", (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

app.get("/auth/device/list", (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

app.delete("/auth/device/:deviceId", (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

// ---- Admin WebAuthn policy/visibility (not part of NFR-S8) ----
app.get("/admin/webauthn/credentials", (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

app.get("/admin/webauthn/policy", (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

app.put("/admin/webauthn/policy", (_req, res) =>
  res.status(501).json({ error: "Not implemented" }),
);

// NFR-S5: Invalidate session on logout
app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Failed to logout" });

    res.clearCookie(env.SESSION_NAME, {
      httpOnly: true,
      secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
      sameSite: env.COOKIE_SAMESITE,
    });

    return res.json({ ok: true });
  });
});
