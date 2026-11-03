import { createHash } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/postgres";
import { loginFailures } from "@/drizzle/schema";

const WINDOW_SECONDS = 15 * 60;
const MAX_FAILED_ATTEMPTS = 10;
const WINDOW_MS = WINDOW_SECONDS * 1000;

function getKey(ip: string) {
  return createHash("sha256").update(ip).digest("hex");
}

export async function isLoginBlocked(ip: string) {
  const [row] = await db.select({ count: loginFailures.count })
    .from(loginFailures)
    .where(and(eq(loginFailures.key, getKey(ip)), gt(loginFailures.windowStartedAt, new Date(Date.now() - WINDOW_MS))))
    .limit(1);
  return Number(row?.count ?? 0) >= MAX_FAILED_ATTEMPTS;
}

export async function recordLoginFailure(ip: string) {
  const key = getKey(ip);
  const now = new Date();
  const cutoff = new Date(now.getTime() - WINDOW_MS);
  const rows = await db.insert(loginFailures)
    .values({ key, count: 1, windowStartedAt: now })
    .onConflictDoUpdate({
      target: loginFailures.key,
      set: {
        count: sql`CASE WHEN ${loginFailures.windowStartedAt} <= ${cutoff} THEN 1 ELSE ${loginFailures.count} + 1 END`,
        windowStartedAt: sql`CASE WHEN ${loginFailures.windowStartedAt} <= ${cutoff} THEN ${now} ELSE ${loginFailures.windowStartedAt} END`,
      },
    })
    .returning({ count: loginFailures.count });
  return Number(rows[0]?.count ?? 0);
}

export async function clearLoginFailures(ip: string) {
  await db.delete(loginFailures).where(eq(loginFailures.key, getKey(ip)));
}
