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
  const b = await req.json().catch(() => null);
  if (!b || typeof b.username !== "string" || typeof b.email !== "string" || typeof b.code !== "string" || typeof b.password !== "string" || typeof b.nickname !== "string") {
    return NextResponse.json({ error: "注册信息不完整，需要用户名、邮箱、验证码、昵称和密码" }, { status: 400 });
  }
  const username = b.username.trim().toLowerCase();
  const email = b.email.trim().toLowerCase();
  const code = b.code.trim();
  const nickname = b.nickname.trim();
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return NextResponse.json({ error: "用户名需为 3-24 位小写字母、数字或下划线" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "请输入 6 位邮箱验证码" }, { status: 400 });
  if (b.password.length < 8 || b.password.length > 128) return NextResponse.json({ error: "密码长度需为 8-128 位" }, { status: 400 });
  if (nickname.length < 1 || nickname.length > 24) return NextResponse.json({ error: "昵称长度需为 1-24 个字符" }, { status: 400 });

  const [verification] = await db.select().from(emailVerificationCodes)
    .where(and(eq(emailVerificationCodes.email, email), eq(emailVerificationCodes.purpose, "register"), isNull(emailVerificationCodes.consumedAt), gt(emailVerificationCodes.expiresAt, new Date())))
    .orderBy(desc(emailVerificationCodes.createdAt)).limit(1);
  if (!verification || verification.attempts >= 5 || verification.codeHash !== hashCode(email, code)) {
    if (verification) await db.update(emailVerificationCodes).set({ attempts: verification.attempts + 1 }).where(eq(emailVerificationCodes.id, verification.id));
    return NextResponse.json({ error: "验证码错误或已过期" }, { status: 400 });
  }

  const existing = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.username, username))).limit(1);
  const existingEmail = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email)).limit(1);
  if (existing.length) return NextResponse.json({ error: "用户名已被使用" }, { status: 409 });
  if (existingEmail.length) return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });

  const passwordHash = await hashPassword(b.password);
  const now = new Date();
  try {
    const [created] = await db.insert(users).values({
      username, email, emailVerifiedAt: now, passwordHash,
      nickname, avatar: "", role: "user", status: "active",
      exp: 0, badges: [], title: "见习档案员",
    }).returning({ id: users.id });
    await db.update(emailVerificationCodes).set({ consumedAt: now }).where(eq(emailVerificationCodes.id, verification.id));
    await createSession(created.id);
    return NextResponse.json({ ok: true, username: created.username });
  } catch (error) {
    console.error("注册失败", error);
    return NextResponse.json({ error: "用户名或邮箱已注册，或注册暂时失败" }, { status: 409 });
  }
}
