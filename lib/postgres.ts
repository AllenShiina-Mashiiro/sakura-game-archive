import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/drizzle/schema";

const globalForPostgres = globalThis as typeof globalThis & { sakuraPgPool?: Pool };
function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL 未配置。请在本地 .env.local 中设置 PostgreSQL 连接地址。");
  return new Pool({ connectionString, max: Number(process.env.DATABASE_POOL_MAX || 10), idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined });
}
const pool = globalForPostgres.sakuraPgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForPostgres.sakuraPgPool = pool;
export const db = drizzle(pool, { schema });
export { pool as postgresPool };
