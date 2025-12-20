// backend/src/services/auditLogService.ts
import type { Request } from "express";
import { Prisma } from "../generated/prisma/client.js";
import type { PrismaClient } from "../generated/prisma/client.js";

export type AuditEventType =
  | "AUTH.LOGIN.SUCCESS"
  | "AUTH.LOGIN.FAIL"
  | "RECOVERY.MAGIC_LINK.REQUEST"
  | "RECOVERY.MAGIC_LINK.VERIFIED"
  | "WEBAUTHN.REGISTER.SUCCESS"
  | "WEBAUTHN.REGISTER.FAIL"
  | "VAULT.ENTRY.CREATE"
  | "VAULT.ENTRY.UPDATE"
  | "VAULT.ENTRY.DELETE"
  | (string & {}); // allow custom strings

export type AuditLogWrite = {
  userId?: number | null; // subject user (the account impacted)
  actorId?: number | null; // who performed the action (often same as userId)
  eventType: AuditEventType;

  ipAddress?: string | null;
  userAgent?: string | null;

  detailsJson?: Prisma.InputJsonValue | typeof Prisma.DbNull | null;
};

function getUserAgent(req: Request): string | null {
  const ua = req.get("user-agent");
  return ua ? ua.slice(0, 500) : null; // basic cap to avoid huge headers
}

/**
 * Best-effort client IP.
 * If you're behind a reverse proxy, set `app.set("trust proxy", 1)` so req.ip is correct.
 */
function getClientIp(req: Request): string | null {
  // Prefer req.ip (works with trust proxy)
  if (req.ip) return req.ip;

  // Fallback: x-forwarded-for first IP
  const xff = req.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    return first || null;
  }

  // Last resort: socket address
  return req.socket?.remoteAddress ?? null;
}

/**
 * Low-level writer. Never throw to break the main request path.
 */
export async function writeAuditLog(prisma: PrismaClient, entry: AuditLogWrite): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        actorId: entry.actorId ?? null,
        eventType: entry.eventType,

        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,

        // Prisma Json? rules:
        // - omit if undefined
        // - use Prisma.DbNull to clear DB column
        ...(entry.detailsJson === undefined
          ? {}
          : {
              detailsJson:
                entry.detailsJson === null ? Prisma.DbNull : (entry.detailsJson as Prisma.InputJsonValue | typeof Prisma.DbNull),
            }),
      },
    });
  } catch {
    // Intentionally swallow errors: audit logging must not break your main flow.
    // You can add a console.warn in dev if you want, but avoid logging sensitive data.
  }
}

/**
 * Convenience wrapper: fill ip/userAgent from req automatically.
 */
export async function auditFromReq(
  prisma: PrismaClient,
  req: Request,
  entry: Omit<AuditLogWrite, "ipAddress" | "userAgent">,
): Promise<void> {
  return writeAuditLog(prisma, {
    ...entry,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  });
}
