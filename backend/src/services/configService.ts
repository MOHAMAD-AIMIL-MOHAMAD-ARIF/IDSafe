// backend/src/services/configService.ts
import type { PrismaClient } from "../generated/prisma/client.js";

type CacheEntry = {
  value: string;
  updatedAt: Date;
  expiresAtMs: number;
};

export type ConfigServiceOptions = {
  ttlMs?: number; // cache TTL
};

export class ConfigService {
  private prisma: PrismaClient;
  private ttlMs: number;
  private cache = new Map<string, CacheEntry>();

  constructor(prisma: PrismaClient, opts?: ConfigServiceOptions) {
    this.prisma = prisma;
    this.ttlMs = opts?.ttlMs ?? Number(process.env.CONFIG_CACHE_TTL_MS ?? 60_000);
  }

  invalidate(key: string) {
    this.cache.delete(key);
  }

  invalidateAll() {
    this.cache.clear();
  }

  private isFresh(entry: CacheEntry): boolean {
    return Date.now() < entry.expiresAtMs;
  }

  private async fetchRaw(key: string): Promise<CacheEntry | null> {
    const row = await this.prisma.systemConfig.findUnique({
      where: { configKey: key },
      select: { configValue: true, updatedAt: true },
    });

    if (!row) return null;

    return {
      value: row.configValue,
      updatedAt: row.updatedAt,
      expiresAtMs: Date.now() + this.ttlMs,
    };
  }

  /**
   * Raw config fetch (string). Uses cache unless forceRefresh=true.
   */
  async getString(key: string, fallback?: string, forceRefresh = false): Promise<string> {
    const cached = this.cache.get(key);
    if (!forceRefresh && cached && this.isFresh(cached)) return cached.value;

    const fresh = await this.fetchRaw(key);
    if (fresh) {
      this.cache.set(key, fresh);
      return fresh.value;
    }

    if (fallback !== undefined) return fallback;
    throw new Error(`Missing SystemConfig key: ${key}`);
  }

  async getInt(key: string, fallback: number, forceRefresh = false): Promise<number> {
    const s = await this.getString(key, String(fallback), forceRefresh);
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }

  async getBool(key: string, fallback: boolean, forceRefresh = false): Promise<boolean> {
    const s = (await this.getString(key, fallback ? "true" : "false", forceRefresh)).toLowerCase().trim();
    if (["1", "true", "yes", "on"].includes(s)) return true;
    if (["0", "false", "no", "off"].includes(s)) return false;
    return fallback;
  }

  async getJson<T>(key: string, fallback: T, forceRefresh = false): Promise<T> {
    const s = await this.getString(key, "", forceRefresh);
    if (!s) return fallback;
    try {
      return JSON.parse(s) as T;
    } catch {
      return fallback;
    }
  }

  /**
   * Fetch multiple keys efficiently (still caches per key).
   */
  async getMany(keys: string[], forceRefresh = false): Promise<Record<string, string | null>> {
    const out: Record<string, string | null> = {};
    const now = Date.now();

    const needFetch: string[] = [];
    for (const k of keys) {
      const cached = this.cache.get(k);
      if (!forceRefresh && cached && now < cached.expiresAtMs) {
        out[k] = cached.value;
      } else {
        needFetch.push(k);
      }
    }

    if (needFetch.length === 0) return out;

    const rows = await this.prisma.systemConfig.findMany({
      where: { configKey: { in: needFetch } },
      select: { configKey: true, configValue: true, updatedAt: true },
    });

    const found = new Map(rows.map((r) => [r.configKey, r]));
    for (const k of needFetch) {
      const r = found.get(k);
      if (!r) {
        out[k] = null;
        continue;
      }
      const entry: CacheEntry = {
        value: r.configValue,
        updatedAt: r.updatedAt,
        expiresAtMs: Date.now() + this.ttlMs,
      };
      this.cache.set(k, entry);
      out[k] = r.configValue;
    }

    return out;
  }
}
