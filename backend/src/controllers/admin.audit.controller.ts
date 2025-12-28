// src/controllers/admin.audit.controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";

const auditQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  actorId: z.coerce.number().int().positive().optional(),
  userEmail: z.string().email().optional(),
  actorEmail: z.string().email().optional(),
  eventType: z.string().optional(),
  ipAddress: z.string().optional(),
  status: z.enum(["success", "failure"]).optional(),
  level: z.enum(["debug", "info", "warn", "error"]).optional(),
  service: z.string().optional(),
  query: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(5000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

type AuditQueryOptions = {
  defaultLimit: number;
  maxLimit: number;
};

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildEventTypeFilter(eventTypeRaw?: string): Prisma.StringFilter | undefined {
  if (!eventTypeRaw) return undefined;

  const eventTypes = eventTypeRaw
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is string => v.length > 0);

  if (eventTypes.length === 0) return undefined;

  if (eventTypes.length === 1) {
    const only = eventTypes[0];
    if (only === undefined) return undefined; // satisfies noUncheckedIndexedAccess
    return { equals: only };
  }

  return { in: eventTypes };
}

function buildLevelFilter(level?: string): Prisma.AuditLogWhereInput | undefined {
  if (!level) return undefined;

  if (level === "debug") {
    return { eventType: { endsWith: ".DEBUG" } };
  }

  if (level === "info") {
    return {
      OR: [{ eventType: { endsWith: ".SUCCESS" } }, { eventType: { endsWith: ".OK" } }],
    };
  }

  if (level === "error") {
    return {
      OR: [
        { eventType: { endsWith: ".FAIL" } },
        { eventType: { endsWith: ".FAILURE" } },
        { eventType: { endsWith: ".DENIED" } },
      ],
    };
  }

  if (level === "warn") {
    return {
      NOT: {
        OR: [
          { eventType: { endsWith: ".SUCCESS" } },
          { eventType: { endsWith: ".OK" } },
          { eventType: { endsWith: ".FAIL" } },
          { eventType: { endsWith: ".FAILURE" } },
          { eventType: { endsWith: ".DENIED" } },
          { eventType: { endsWith: ".DEBUG" } },
        ],
      },
    };
  }

  return undefined;
}

function buildServiceFilter(serviceRaw?: string): Prisma.StringFilter | undefined {
  if (!serviceRaw) return undefined;
  const service = serviceRaw.trim();
  if (!service) return undefined;
  const prefix = service.endsWith(".") ? service : `${service}.`;
  return { startsWith: prefix, mode: "insensitive" };
}

function buildSearchFilter(queryRaw?: string): Prisma.AuditLogWhereInput | undefined {
  if (!queryRaw) return undefined;
  const query = queryRaw.trim();
  if (!query) return undefined;

  const numeric = Number(query);
  const idFilter =
    Number.isInteger(numeric) && numeric > 0
      ? [{ userId: numeric }, { actorId: numeric }]
      : [];

  return {
    OR: [
      { eventType: { contains: query, mode: "insensitive" } },
      { ipAddress: { contains: query } },
      { userAgent: { contains: query, mode: "insensitive" } },
      { subject: { email: { contains: query, mode: "insensitive" } } },
      { actor: { email: { contains: query, mode: "insensitive" } } },
      ...idFilter,
    ],
  };
}

function buildAuditLogWhere(parsed: z.infer<typeof auditQuerySchema>): Prisma.AuditLogWhereInput {
  const clauses: Prisma.AuditLogWhereInput[] = [];

  if (parsed.userId !== undefined) clauses.push({ userId: parsed.userId });
  if (parsed.actorId !== undefined) clauses.push({ actorId: parsed.actorId });
  if (parsed.userEmail) clauses.push({ subject: { email: parsed.userEmail } });
  if (parsed.actorEmail) clauses.push({ actor: { email: parsed.actorEmail } });
  if (parsed.ipAddress) clauses.push({ ipAddress: parsed.ipAddress });

  const eventTypeFilter = buildEventTypeFilter(parsed.eventType);
  if (eventTypeFilter) clauses.push({ eventType: eventTypeFilter });

  const levelFilter = buildLevelFilter(parsed.level);
  if (levelFilter) clauses.push(levelFilter);

  const serviceFilter = buildServiceFilter(parsed.service);
  if (serviceFilter) clauses.push({ eventType: serviceFilter });

  const searchFilter = buildSearchFilter(parsed.query);
  if (searchFilter) clauses.push(searchFilter);

  if (parsed.status === "success") {
    clauses.push({ eventType: { endsWith: ".SUCCESS" } });
  }

  if (parsed.status === "failure") {
    clauses.push({
      OR: [
        { eventType: { endsWith: ".FAIL" } },
        { eventType: { endsWith: ".FAILURE" } },
        { eventType: { endsWith: ".DENIED" } },
      ],
    });
  }

  const fromDate = parseDate(parsed.from);
  const toDate = parseDate(parsed.to);

  if (parsed.from && !fromDate) {
    throw new Error("Invalid from date");
  }
  if (parsed.to && !toDate) {
    throw new Error("Invalid to date");
  }

  if (fromDate || toDate) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (fromDate) createdAt.gte = fromDate;
    if (toDate) createdAt.lte = toDate;
    clauses.push({ createdAt });
  }

  if (clauses.length === 0) return {};
  return { AND: clauses };
}

function deriveStatus(eventType: string): string | null {
  if (eventType.endsWith(".SUCCESS")) return "success";
  if (eventType.endsWith(".FAIL") || eventType.endsWith(".FAILURE") || eventType.endsWith(".DENIED")) {
    return "failure";
  }
  return null;
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values: unknown[]): string {
  return values.map(escapeCsv).join(",");
}

async function resolveAuditQuery(req: Request, options: AuditQueryOptions) {
  const parsed = auditQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return { error: parsed.error.issues } as const;
  }

  const take = Math.min(parsed.data.limit ?? options.defaultLimit, options.maxLimit);
  const skip = parsed.data.offset ?? 0;

  try {
    const where = buildAuditLogWhere(parsed.data);
    return { where, take, skip } as const;
  } catch (err) {
    return { error: [{ message: (err as Error).message }] } as const;
  }
}

/**
 * GET /admin/audit-logs
 */
export async function adminListAuditLogs(req: Request, res: Response) {
  const resolved = await resolveAuditQuery(req, { defaultLimit: 50, maxLimit: 500 });
  if ("error" in resolved) {
    return res.status(400).json({ error: "Invalid query", issues: resolved.error });
  }

  const { where, take, skip } = resolved;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        logId: true,
        userId: true,
        actorId: true,
        eventType: true,
        ipAddress: true,
        userAgent: true,
        detailsJson: true,
        createdAt: true,
        subject: { select: { email: true } },
        actor: { select: { email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return res.json({ logs, total, limit: take, offset: skip });
}

/**
 * GET /admin/audit-logs/export
 */
export async function adminExportAuditLogs(req: Request, res: Response) {
  const resolved = await resolveAuditQuery(req, { defaultLimit: 1000, maxLimit: 5000 });
  if ("error" in resolved) {
    return res.status(400).json({ error: "Invalid query", issues: resolved.error });
  }

  const { where, take, skip } = resolved;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    skip,
    select: {
      logId: true,
      userId: true,
      actorId: true,
      eventType: true,
      ipAddress: true,
      userAgent: true,
      detailsJson: true,
      createdAt: true,
      subject: { select: { email: true } },
      actor: { select: { email: true } },
    },
  });

  const header = toCsvRow([
    "logId",
    "createdAt",
    "eventType",
    "status",
    "userId",
    "userEmail",
    "actorId",
    "actorEmail",
    "ipAddress",
    "userAgent",
    "details",
  ]);

  const rows = logs.map((log) =>
    toCsvRow([
      log.logId,
      log.createdAt.toISOString(),
      log.eventType,
      deriveStatus(log.eventType) ?? "",
      log.userId ?? "",
      log.subject?.email ?? "",
      log.actorId ?? "",
      log.actor?.email ?? "",
      log.ipAddress ?? "",
      log.userAgent ?? "",
      log.detailsJson ? JSON.stringify(log.detailsJson) : "",
    ]),
  );

  const csv = [header, ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=audits.csv");

  return res.status(200).send(csv);
}
