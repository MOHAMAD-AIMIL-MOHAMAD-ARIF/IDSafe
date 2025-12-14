// src/middleware/rateLimiters.ts
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

function limiter(opts: {
  windowMs: number;
  max: number;
  message: string;
}) {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: opts.message },
  });
}

// WebAuthn (login/registration): brute-force + abuse protection (NFR-S8) :contentReference[oaicite:1]{index=1}
export const webauthnLimiter = limiter({
  windowMs: env.RL_AUTH_WINDOW_MS,
  max: env.RL_AUTH_MAX,
  message: "Too many authentication attempts. Please try again later.",
});

// Recovery (magic link + passphrase flow): abuse protection (NFR-S8) :contentReference[oaicite:2]{index=2}
export const recoveryLimiter = limiter({
  windowMs: env.RL_RECOVERY_WINDOW_MS,
  max: env.RL_RECOVERY_MAX,
  message: "Too many recovery requests. Please try again later.",
});
