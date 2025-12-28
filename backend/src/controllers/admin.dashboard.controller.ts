// src/controllers/admin.dashboard.controller.ts
import type { Request, Response } from "express";
import { prisma } from "../db.js";

const RECOVERY_PREFIXES = ["RECOVERY.", "WEBAUTHN.RECOVERY."] as const;
const AUTH_PREFIXES = ["WEBAUTHN.", "RECOVERY.", "ADMIN.LOGIN", "ADMIN.WEBAUTHN."] as const;

type EventStatus = "success" | "failed" | "pending";

function deriveStatus(eventType: string): EventStatus {
  if (eventType.endsWith(".OK") || eventType.endsWith(".SUCCESS")) return "success";
  if (
    eventType.endsWith(".FAIL") ||
    eventType.endsWith(".FAILURE") ||
    eventType.endsWith(".DENIED")
  ) {
    return "failed";
  }
  return "pending";
}

function deriveMethod(eventType: string): string {
  if (eventType.includes("WEBAUTHN.RECOVERY")) return "WebAuthn";
  if (eventType.startsWith("RECOVERY.")) return "Recovery link";
  return "Recovery";
}

function startsWithAny(prefixes: readonly string[]) {
  return prefixes.map((prefix) => ({ eventType: { startsWith: prefix } }));
}

function buildSuccessRecoveryFilters() {
  const suffixes = [".OK", ".SUCCESS"] as const;
  const filters: { AND: { eventType: { startsWith?: string; endsWith?: string } }[] }[] = [];

  RECOVERY_PREFIXES.forEach((prefix) => {
    suffixes.forEach((suffix) => {
      filters.push({
        AND: [{ eventType: { startsWith: prefix } }, { eventType: { endsWith: suffix } }],
      });
    });
  });

  return filters;
}

/**
 * GET /admin/summary
 */
export async function adminSummary(_req: Request, res: Response) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [userCount, lockedAccounts, recoveryEvents24h, authEvents] = await Promise.all([
    prisma.user.count({ where: { role: "END_USER" } }),
    prisma.user.count({ where: { role: "END_USER", status: "LOCKED" } }),
    prisma.auditLog.count({
      where: {
        createdAt: { gte: since },
        OR: buildSuccessRecoveryFilters(),
      },
    }),
    prisma.auditLog.findMany({
      where: {
        createdAt: { gte: since },
        OR: startsWithAny(AUTH_PREFIXES),
      },
      select: { eventType: true },
    }),
  ]);

  const totalAuthEvents = authEvents.length;
  const failedAuthEvents = authEvents.filter((event) => deriveStatus(event.eventType) === "failed").length;
  const errorRate = totalAuthEvents === 0 ? 0 : (failedAuthEvents / totalAuthEvents) * 100;

  return res.json({
    userCount,
    lockedAccounts,
    recoveryEvents24h,
    errorRate,
  });
}

/**
 * GET /admin/recovery-events
 */
export async function adminRecoveryEvents(_req: Request, res: Response) {
  const events = await prisma.auditLog.findMany({
    where: { OR: startsWithAny(RECOVERY_PREFIXES) },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: {
      logId: true,
      eventType: true,
      createdAt: true,
      subject: { select: { email: true } },
    },
  });

  return res.json({
    events: events.map((event) => ({
      id: String(event.logId),
      userEmail: event.subject?.email ?? "Unknown",
      status: deriveStatus(event.eventType),
      method: deriveMethod(event.eventType),
      occurredAt: event.createdAt.toISOString(),
    })),
  });
}
