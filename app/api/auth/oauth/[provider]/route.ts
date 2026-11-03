import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/postgres";
import { oauthAccounts, users } from "@/drizzle/schema";
import { createSession } from "@/lib/auth";

export const runtime = "nodejs";

type Provider = "google" | "github";
type OAuthProfile = { id: string; email: string; name: string; avatar: string };

function providerFrom(value: string): Provider | null {
  return value === "google" || value === "github" ? value : null;
}

function callbackUrl(request: NextRequest, provider: Provider) {
  return new URL(`/api/auth/oauth/${provider}`, request.url).toString();
}

function config(provider: Provider) {
  if (provider === "google") {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorize: "https://accounts.google.com/o/oauth2/v2/auth",
      token: "https://oauth2.googleapis.com/token",
    };
  }
  return {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    authorize: "https://github.com/login/oauth/authorize",
    token: "https://github.com/login/oauth/access_token",
  };
}

async function getProfile(provider: Provider, accessToken: string): Promise<OAuthProfile> {
  if (provider === "google") {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("无法读取 Google 账户资料");
    const data = await response.json();
    if (!data.sub || !data.email || data.email_verified !== true) throw new Error("Google 账户没有已验证邮箱");
    return { id: String(data.sub), email: String(data.email).toLowerCase(), name: String(data.name || data.email.split("@")[0]), avatar: String(data.picture || "") };
  }

  const headers = { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const userResponse = await fetch("https://api.github.com/user", { headers, cache: "no-store" });
  if (!userResponse.ok) throw new Error("无法读取 GitHub 账户资料");
  const user = await userResponse.json();
  const emailResponse = await fetch("https://api.github.com/user/emails", { headers, cache: "no-store" });
  if (!emailResponse.ok) throw new Error("无法读取 GitHub 已验证邮箱");
  const emails = await emailResponse.json();
  const primary = Array.isArray(emails) ? emails.find((item: { primary?: boolean; verified?: boolean }) => item.primary && item.verified) : null;
  if (!user.id || !primary?.email) throw new Error("GitHub 账户需要设置并验证一个主邮箱");
  return { id: String(user.id), email: String(primary.email).toLowerCase(), name: String(user.name || user.login || primary.email.split("@")[0]), avatar: String(user.avatar_url || "") };
}

async function uniqueUsername(seed: string) {
  const base = seed.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "").slice(0, 18);
  const normalized = base.length >= 3 ? base : `user_${base || "member"}`;
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? normalized : `${normalized.slice(0, 18)}_${randomBytes(2).toString("hex")}`;
    const [found] = await db.select({ id: users.id }).from(users).where(eq(users.username, candidate)).limit(1);
    if (!found) return candidate;
  }
  throw new Error("无法分配唯一用户 ID，请稍后重试");
}

export async function GET(request: NextRequest, context: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await context.params;
  const provider = providerFrom(rawProvider);
  if (!provider) return NextResponse.json({ error: "不支持的登录平台" }, { status: 404 });

  const settings = config(provider);
  if (!settings.clientId || !settings.clientSecret) {
    return NextResponse.json({ error: `${provider === "google" ? "Google" : "GitHub"} OAuth 尚未配置，请设置对应的 Client ID 和 Client Secret` }, { status: 503 });
  }

  const callback = callbackUrl(request, provider);
  const stateCookie = `gra_oauth_state_${provider}`;
  const clearCookie = (response: NextResponse) => {
    response.cookies.delete(stateCookie);
    return response;
  };
  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) {
    return clearCookie(NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(providerError)}`, request.url)));
  }
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    const state = randomBytes(32).toString("base64url");
    const target = new URL(settings.authorize);
    target.searchParams.set("client_id", settings.clientId);
    target.searchParams.set("redirect_uri", callback);
    target.searchParams.set("response_type", "code");
    target.searchParams.set("state", state);
    target.searchParams.set("scope", provider === "google" ? "openid email profile" : "read:user user:email");
    if (provider === "google") target.searchParams.set("access_type", "online");
    const response = NextResponse.redirect(target);
    response.cookies.set(stateCookie, state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
    return response;
  }

  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(stateCookie)?.value;
  if (!state || !expectedState || state !== expectedState) {
    return clearCookie(NextResponse.redirect(new URL("/login?error=oauth_state", request.url)));
  }

  try {
    const tokenResponse = await fetch(settings.token, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        code,
        redirect_uri: callback,
        ...(provider === "google" ? { grant_type: "authorization_code" } : {}),
      }),
      cache: "no-store",
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error("第三方授权换取令牌失败");

    const profile = await getProfile(provider, String(tokenData.access_token));
    let userId: string;
    const [linked] = await db.select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, profile.id)))
      .limit(1);

    if (linked) {
      userId = linked.userId;
      const [existingUser] = await db.select({ status: users.status }).from(users).where(eq(users.id, userId)).limit(1);
      if (!existingUser || existingUser.status !== "active") throw new Error("该账户当前不可登录");
    } else {
      const [emailUser] = await db.select({ id: users.id, emailVerifiedAt: users.emailVerifiedAt, status: users.status })
        .from(users).where(eq(users.email, profile.email)).limit(1);
      if (emailUser) {
        if (!emailUser.emailVerifiedAt || emailUser.status !== "active") throw new Error("该邮箱已存在账户，请先使用原登录方式验证邮箱");
        userId = emailUser.id;
      } else {
        const username = await uniqueUsername(profile.name || profile.email.split("@")[0]);
        const [created] = await db.insert(users).values({
          username, email: profile.email, emailVerifiedAt: new Date(), passwordHash: null,
          nickname: profile.name.slice(0, 24) || username, avatar: profile.avatar,
          role: "user", status: "active", exp: 0, badges: [], title: "见习档案员",
        }).returning({ id: users.id });
        userId = created.id;
      }
      await db.insert(oauthAccounts).values({ userId, provider, providerAccountId: profile.id }).onConflictDoNothing();
    }

    await createSession(userId);
    return clearCookie(NextResponse.redirect(new URL("/", request.url)));
  } catch (error) {
    console.error(`${provider} OAuth 登录失败`, error);
    const message = error instanceof Error ? error.message : "第三方登录失败";
    const response = NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, request.url));
    return clearCookie(response);
  }
}
