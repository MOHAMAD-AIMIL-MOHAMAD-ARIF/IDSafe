// src/middleware/httpsOnly.ts
import type { Request, Response, NextFunction } from "express";

export function httpsOnly(forceHttps: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!forceHttps) return next();

    // If behind proxy, Express uses X-Forwarded-Proto when trust proxy is enabled
    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
    if (isSecure) return next();

    // Redirect HTTP -> HTTPS
    const host = req.headers.host;
    if (!host) return res.status(400).send("Bad Request");
    return res.redirect(308, `https://${host}${req.originalUrl}`);
  };
}
