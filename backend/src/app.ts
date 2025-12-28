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

import { authWebauthnRouter } from "./routes/auth.webauthn.routes.js";
import { authDeviceRouter } from "./routes/auth.device.routes.js";
import { authAccountRouter } from "./routes/auth.account.routes.js";
import { adminAuthPasswordRouter } from "./routes/admin.auth.password.routes.js";
import { adminWebauthnRouter } from "./routes/admin.webauthn.routes.js";
import { adminUsersRouter } from "./routes/admin.users.routes.js";
import { adminAuditRouter } from "./routes/admin.audit.routes.js";
import { adminSystemRouter } from "./routes/admin.system.routes.js";
import { adminDashboardRouter } from "./routes/admin.dashboard.routes.js";
import { adminConfigRouter } from "./routes/admin.config.routes.js";
import { recoveryRouter } from "./routes/recovery.routes.js";
import { vaultEntriesRouter } from "./routes/vault.entries.routes.js";
import { recordResponse } from "./services/metricsService.js";
import { requireAuth } from "./middleware/auth.js";

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
    optionsSuccessStatus: 204,
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

// In-memory request metrics
app.use((req, res, next) => {
  res.on("finish", () => recordResponse(res.statusCode));
  next();
});

//---- Mounted routers ----

// End-user WebAuthn + recovery WebAuthn re-registration + credential management
app.use("/auth/webauthn", authWebauthnRouter);

// End-user account profile
app.use("/auth/account", authAccountRouter);

// Admin WebAuthn auth (separate login/registration)
//app.use("/admin/auth/webauthn", adminAuthWebauthnRouter);

// Admin password + OTP auth
app.use("/admin/auth", adminAuthPasswordRouter);

// Device-binding
app.use("/auth/device", authDeviceRouter);

// Admin WebAuthn config/visibility
app.use("/admin/webauthn", adminWebauthnRouter);

// Admin user management
app.use("/admin/users", adminUsersRouter);

// Admin dashboard summary + recovery feed
app.use("/admin", adminDashboardRouter);

// Admin audit log search/export
app.use("/admin/audit-logs", adminAuditRouter);

// Admin config (KDF)
app.use("/admin/config", adminConfigRouter);

// Admin system config + health
app.use("/admin/system", adminSystemRouter);

// Recovery route (magic link, etc.)
app.use("/recovery", recoveryRouter);

// Vault entries router
app.use("/vault/entries", vaultEntriesRouter);

// Session introspection for frontend auth state (cookie-based)
app.get("/auth/session", requireAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    userId: req.session.userId,
    role: req.session.role ?? "END_USER",
  });
});


// Health: checks DB connectivity through Prisma
app.get("/health", async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: "ok" });
});


// NFR-S5: Invalidate session on logout
app.post("/auth/logout", (req, res) => {
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
