import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/postgres";
import { authSessions, users } from "@/drizzle/schema";
import type { User } from "./types";
const scrypt=promisify(scryptCb);
const COOKIE="gra_session";
const SESSION_MS=14*24*60*60*1000;
function secret(){const s=process.env.SESSION_SECRET;if(!s||s.length<32)throw new Error("SESSION_SECRET 必须设置为至少 32 位随机字符串");return s;}
function tokenHash(token:string){return createHmac("sha256",secret()).update(token).digest("hex");}
export async function hashPassword(password:string){const salt=randomBytes(16).toString("hex");const key=await scrypt(password,salt,64) as Buffer;return salt+":"+key.toString("hex");}
export async function verifyPassword(password:string,stored:string){const [salt,hex]=stored.split(":");if(!salt||!hex)return false;const key=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(hex,"hex");return key.length===expected.length&&timingSafeEqual(key,expected);}
function toUser(row:typeof users.$inferSelect):User{return {id:row.id,username:row.username,email:row.email,emailVerifiedAt:row.emailVerifiedAt?.toISOString(),passwordHash:row.passwordHash??"",nickname:row.nickname,avatar:row.avatar,role:row.role as User["role"],status:row.status as User["status"],createdAt:row.createdAt.toISOString(),exp:row.exp,badges:row.badges,title:row.title,lastLoginAt:row.lastLoginAt?.toISOString(),lastLoginIp:row.lastLoginIp??undefined,lastDailyLogin:row.lastDailyLogin??undefined,lastCheckIn:row.lastCheckIn??undefined,selectedBadge:row.selectedBadge??undefined,avatarFrame:row.avatarFrame??undefined,cardBackground:row.cardBackground??undefined,sakuraCoins:row.sakuraCoins,expConverted:row.expConverted,themeColor:row.themeColor??undefined,themeMode:(row.themeMode as User["themeMode"])??undefined,sakuraEnabled:row.sakuraEnabled,discoverable:row.discoverable};}
export async function createSession(userId:string){const token=randomBytes(32).toString("base64url");const expiresAt=new Date(Date.now()+SESSION_MS);await db.insert(authSessions).values({userId,tokenHash:tokenHash(token),expiresAt});(await cookies()).set(COOKIE,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",expires:expiresAt});}
export async function clearSession(){const token=(await cookies()).get(COOKIE)?.value;if(token)await db.delete(authSessions).where(eq(authSessions.tokenHash,tokenHash(token)));(await cookies()).delete(COOKIE);}
export async function getSessionUser():Promise<User|null>{const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;try{const [row]=await db.select({user:users}).from(authSessions).innerJoin(users,eq(authSessions.userId,users.id)).where(and(eq(authSessions.tokenHash,tokenHash(token)),gt(authSessions.expiresAt,new Date()))).limit(1);return row?.user.status==="active"?toUser(row.user):null;}catch{return null;}}
export async function requireUser(){const user=await getSessionUser();if(!user)throw new Error("UNAUTHORIZED");return user;}
export async function requireAdmin(){const user=await requireUser();if(user.role!=="admin")throw new Error("FORBIDDEN");return user;}
export function clientUser(user:User){const {passwordHash,...safe}=user;return safe;}
export async function bootstrapAdmin(){const [existing]=await db.select({id:users.id}).from(users).where(eq(users.role,"admin")).limit(1);if(existing)return;const password=process.env.ADMIN_PASSWORD;if(!password||password.length<10)return;const passwordHash=await hashPassword(password);await db.insert(users).values({username:"admin",email:"admin@local.invalid",emailVerifiedAt:new Date(),nickname:"管理员",passwordHash,avatar:"",role:"admin",status:"active",exp:0,badges:["站点管理员"],title:"站点管理员"}).onConflictDoNothing();}
