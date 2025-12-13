// src/middleware/rateLimiters.ts
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

export const authLimiter = rateLimit({
  windowMs: env.RL_AUTH_WINDOW_MS,
  max: env.RL_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

export const recoveryLimiter = rateLimit({
  windowMs: env.RL_RECOVERY_WINDOW_MS,
  max: env.RL_RECOVERY_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many recovery requests. Please try again later." },
});
