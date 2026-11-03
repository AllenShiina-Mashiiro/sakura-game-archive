import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/postgres";
import { emailVerificationCodes, users } from "@/drizzle/schema";
import { hashPassword, createSession, bootstrapAdmin } from "@/lib/auth";

export const runtime = "nodejs";

function hashCode(email: string, code: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET 配置无效");
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

export async function POST(req: Request) {
  await bootstrapAdmin();
  const body = await req.json().catch(() => null);
  if (!body || typeof body.username !== "string" || typeof body.email !== "string"
    || typeof body.code !== "string" || typeof body.password !== "string" || typeof body.nickname !== "string") {
    return NextResponse.json({ error: "注册信息不完整，需要 ID、昵称、邮箱、验证码和密码" }, { status: 400 });
  }

  const username = body.username.trim().toLowerCase().replace(/^@/, "");
  const email = body.email.trim().toLowerCase();
  const code = body.code.trim();
  const nickname = body.nickname.trim();

  if (!/^[a-z0-9_]{3,24}$/.test(username)) return NextResponse.json({ error: "ID 需为 3-24 位小写字母、数字或下划线" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "请输入 6 位邮箱验证码" }, { status: 400 });
  if (body.password.length < 8 || body.password.length > 128) return NextResponse.json({ error: "密码长度需为 8-128 位" }, { status: 400 });
  if (nickname.length < 1 || nickname.length > 24) return NextResponse.json({ error: "昵称长度需为 1-24 个字符" }, { status: 400 });

  const now = new Date();
  try {
    const created = await db.transaction(async (tx) => {
      const [verification] = await tx.select().from(emailVerificationCodes)
        .where(and(
          eq(emailVerificationCodes.email, email),
          eq(emailVerificationCodes.purpose, "register"),
          isNull(emailVerificationCodes.consumedAt),
          gt(emailVerificationCodes.expiresAt, now),
        ))
        .orderBy(desc(emailVerificationCodes.createdAt))
        .limit(1)
        .for("update");

      if (!verification || verification.attempts >= 5 || verification.codeHash !== hashCode(email, code)) {
        if (verification) {
          await tx.update(emailVerificationCodes)
            .set({ attempts: verification.attempts + 1 })
            .where(eq(emailVerificationCodes.id, verification.id));
        }
        return { error: "验证码错误或已过期" as const };
      }

      const [existingUsername] = await tx.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (existingUsername) return { error: "用户名已被使用" as const };
      const [existingEmail] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existingEmail) return { error: "该邮箱已注册" as const };

      const passwordHash = await hashPassword(body.password);
      const [user] = await tx.insert(users).values({
        username, email, emailVerifiedAt: now, passwordHash, nickname,
        avatar: "", role: "user", status: "active", exp: 0, badges: [], title: "见习档案员",
      }).returning({ id: users.id, username: users.username });

      await tx.update(emailVerificationCodes)
        .set({ consumedAt: now })
        .where(eq(emailVerificationCodes.id, verification.id));
      return { user };
    });

    if ("error" in created) return NextResponse.json({ error: created.error }, { status: 400 });
    await createSession(created.user.id);
    return NextResponse.json({ ok: true, username: created.user.username });
  } catch (error) {
    console.error("注册失败", error);
    return NextResponse.json({ error: "用户名或邮箱已注册，或注册暂时失败" }, { status: 409 });
  }
}
