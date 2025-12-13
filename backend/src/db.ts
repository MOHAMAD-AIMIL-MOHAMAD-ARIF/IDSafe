// src/db.ts
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import { env } from "./config/env.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

// ✅ Driver-adapter mode: PrismaClient needs { adapter }
export const prisma = new PrismaClient({ adapter });
