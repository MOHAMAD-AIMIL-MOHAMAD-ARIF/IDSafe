/* eslint-disable no-console */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Helpers: keep values as strings so this works whether you used enums or plain strings in Prisma
const ROLE_ADMIN = "ADMIN" as any; // USER.role values: END_USER, ADMIN :contentReference[oaicite:7]{index=7}
const STATUS_ACTIVE = "ACTIVE" as any; // USER.status values: ACTIVE, LOCKED, DEACTIVATED :contentReference[oaicite:8]{index=8}

async function main() {
  const now = new Date();

  // 1) Create (or reuse) default ADMIN user
  // USER fields: email, role, status, created_at, updated_at, last_login_at :contentReference[oaicite:9]{index=9}
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL?.trim() || "admin@idsafe.local";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      role: ROLE_ADMIN,
      status: STATUS_ACTIVE,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    },
    update: {
      role: ROLE_ADMIN,
      status: STATUS_ACTIVE,
      updatedAt: now,
    },
  });

  // 2) Seed SYSTEM_CONFIG rows
  // SYSTEM_CONFIG fields: config_key (PK), config_value, description, updated_at, updated_by_user_id :contentReference[oaicite:10]{index=10}
  // Config values are TEXT, so we store numbers/objects as strings (JSON string when needed).
  const configs: Array<{
    configKey: string;
    configValue: string;
    description?: string | null;
  }> = [
    // Session (cookie-based) policy knobs (NFR-S5) :contentReference[oaicite:11]{index=11}
    {
      configKey: "session.timeoutSeconds",
      configValue: String(60 * 30), // 30 minutes
      description: "Session idle timeout in seconds (invalidate on timeout).",
    },
    {
      configKey: "session.cookie.sameSite",
      configValue: "lax",
      description: "SameSite policy for session cookie (lax/strict/none).",
    },
    {
      configKey: "session.cookie.secure",
      configValue: "true",
      description: "Whether session cookie must be Secure (HTTPS only).",
    },

    // Rate limiting / brute-force protection knobs (NFR-S8) :contentReference[oaicite:12]{index=12}
    {
      configKey: "rateLimit.login.maxRequests",
      configValue: "10",
      description: "Max login attempts per window per IP.",
    },
    {
      configKey: "rateLimit.login.windowSeconds",
      configValue: String(10 * 60), // 10 minutes
      description: "Login rate-limit window size in seconds.",
    },
    {
      configKey: "rateLimit.recovery.maxRequests",
      configValue: "5",
      description: "Max recovery requests per window per IP/email.",
    },
    {
      configKey: "rateLimit.recovery.windowSeconds",
      configValue: String(15 * 60), // 15 minutes
      description: "Recovery rate-limit window size in seconds.",
    },

    // Argon2id defaults for new users (design example: t=3, m=64 MiB, p=1) :contentReference[oaicite:13]{index=13}
    {
      configKey: "kdf.algorithm.default",
      configValue: "argon2id",
      description: "Default KDF algorithm for recovery passphrase KEK derivation.",
    },
    {
      configKey: "kdf.argon2id.timeCost.default",
      configValue: "3",
      description: "Default Argon2id time cost for new users.",
    },
    {
      configKey: "kdf.argon2id.memoryCostKiB.default",
      configValue: "65536",
      description: "Default Argon2id memory cost (KiB) for new users.",
    },
    {
      configKey: "kdf.argon2id.parallelism.default",
      configValue: "1",
      description: "Default Argon2id parallelism for new users.",
    },
    {
      configKey: "kdf.argon2id.hashLenBytes.default",
      configValue: "32",
      description: "Default Argon2id hash length bytes for new users.",
    },

    // WebAuthn attestation policy controls (admin-configurable) :contentReference[oaicite:14]{index=14}
    {
      configKey: "webauthn.attestation.mode",
      configValue: "direct",
      description: "Attestation conveyance preference (none/indirect/direct).",
    },
    {
      configKey: "webauthn.authenticatorAttachment",
      configValue: "platform",
      description: "Preferred authenticator type (platform/cross-platform).",
    },
    {
      configKey: "webauthn.userVerification",
      configValue: "required",
      description: "User verification requirement (required/preferred/discouraged).",
    },
    {
      configKey: "webauthn.allowedAttestationFormats",
      configValue: JSON.stringify(["packed", "tpm", "android-key", "apple"]),
      description: "JSON array of allowed WebAuthn attestation formats.",
    },
    {
      configKey: "webauthn.allowedAAGUIDs",
      configValue: JSON.stringify([]),
      description: "JSON array of allowed authenticator AAGUIDs (empty = allow all).",
    },
    {
      configKey: "webauthn.trustedAttestationRoots",
      configValue: JSON.stringify([]),
      description: "JSON array of trusted attestation root certs/metadata references.",
    },

    // Email + app config placeholders (admin-managed app config) :contentReference[oaicite:15]{index=15}
    {
      configKey: "app.baseUrl",
      configValue: "http://localhost:3000",
      description: "Public base URL used to construct magic links (dev default).",
    },
    {
      configKey: "email.smtp.host",
      configValue: "smtp.example.com",
      description: "SMTP host for recovery magic link emails.",
    },
    {
      configKey: "email.smtp.port",
      configValue: "587",
      description: "SMTP port (e.g., 587 STARTTLS, 465 SMTPS).",
    },
    {
      configKey: "email.smtp.user",
      configValue: "CHANGE_ME",
      description: "SMTP username.",
    },
    {
      configKey: "email.smtp.pass",
      configValue: "CHANGE_ME",
      description: "SMTP password/app-password (store securely in env in prod).",
    },
    {
      configKey: "email.fromAddress",
      configValue: "no-reply@idsafe.local",
      description: "From address used for outbound email.",
    },
  ];

  // Upsert each config so the seed is re-runnable
  for (const c of configs) {
    await prisma.systemConfig.upsert({
      where: { configKey: c.configKey },
      create: {
        configKey: c.configKey,
        configValue: c.configValue,
        description: c.description ?? null,
        updatedByUserId: admin.userId, // FK → USER(user_id) :contentReference[oaicite:16]{index=16}
      },
      update: {
        configValue: c.configValue,
        description: c.description ?? null,
        updatedAt: now,
        updatedByUserId: admin.userId,
      },
    });
  }

  console.log(`Seed completed.`);
  console.log(`Admin: ${adminEmail} (userId=${admin.userId})`);
  console.log(`SYSTEM_CONFIG rows upserted: ${configs.length}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
