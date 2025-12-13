// src/app.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import pgSessionFactory from "connect-pg-simple";
import morgan from "morgan";
import { pool, prisma } from "./db.js";

import { env } from "./config/env.js";
import { httpsOnly } from "./middleware/httpsOnly.js";
import { authLimiter, recoveryLimiter } from "./middleware/rateLimiters.js";

const app = express();

// If behind a proxy (Render/Nginx/etc), this is required for secure cookies + req.secure
if (env.TRUST_PROXY) app.set("trust proxy", 1);

// NFR-S4: enforce HTTPS (enable only when TLS exists at proxy)
app.use(httpsOnly(env.FORCE_HTTPS));

// Basic hardening headers
app.use(
  helmet({
    // If your Next.js frontend is on a different origin and you embed resources,
    // you may need to tune CSP later. Start with defaults.
    contentSecurityPolicy: false,
  }),
);

app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// CORS for Next.js frontend origin + cookie sessions
app.use(
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Requested-With"],
  }),
);

// Session store (Postgres) — recommended vs MemoryStore
const PgSession = pgSessionFactory(session);

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
      secure: env.COOKIE_SECURE || env.NODE_ENV === "production", // set true in prod
      sameSite: env.COOKIE_SAMESITE, // "lax" recommended; "none" requires secure=true
      maxAge: env.SESSION_MAX_AGE_MS,
    },

    store: new PgSession({
      pool,
      tableName: "session", // create automatically by default in many setups
      createTableIfMissing: true,
    }),
  }),
);

// ---- Routes ----

// Health check
app.get("/health", (_req, res) => res.json({ ok: true }));

// Auth endpoints get authLimiter (NFR-S8)
app.use("/api/auth", authLimiter);

// Recovery endpoints get recoveryLimiter (NFR-S8)
app.use("/api/recovery", recoveryLimiter);

// Example logout route to satisfy “invalidate upon logout” (NFR-S5)
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

export { app, pool };
