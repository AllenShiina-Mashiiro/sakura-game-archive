import { NextResponse } from "next/server";
import { randomInt, createHmac } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/postgres";
import { emailVerificationCodes } from "@/drizzle/schema";
import { sendVerificationCode } from "@/lib/email";

export const runtime = "nodejs";
const normalizeEmail = (value: string) => value.trim().toLowerCase();
function hashCode(email: string, code: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET 配置无效");
  return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.email !== "string") return NextResponse.json({ error: "请输入邮箱地址" }, { status: 400 });
  const email = normalizeEmail(body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  const recent = await db.select({ id: emailVerificationCodes.id }).from(emailVerificationCodes)
    .where(and(eq(emailVerificationCodes.email, email), gt(emailVerificationCodes.createdAt, new Date(Date.now() - 60_000))))
    .limit(1);
  if (recent.length) return NextResponse.json({ error: "验证码已发送，请 60 秒后再试" }, { status: 429 });
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(emailVerificationCodes).values({
    email, codeHash: hashCode(email, code), purpose: "register",
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  try {
    await sendVerificationCode(email, code);
  } catch (error) {
    await db.delete(emailVerificationCodes).where(and(eq(emailVerificationCodes.email, email), eq(emailVerificationCodes.codeHash, hashCode(email, code))));
    console.error("发送注册验证码失败", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "邮件发送失败" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, message: "验证码已发送，请检查邮箱" });
}
