import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import type { Database } from "@/lib/types";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: varchar("username", { length: 24 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  nickname: varchar("nickname", { length: 24 }).notNull(),
  avatar: text("avatar").notNull().default(""),
  role: varchar("role", { length: 16 }).notNull().default("user"),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  exp: integer("exp").notNull().default(0),
  badges: jsonb("badges").$type<string[]>().notNull().default([]),
  title: varchar("title", { length: 80 }).notNull().default("见习档案员"),
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("users_username_uq").on(t.username),
  uniqueIndex("users_email_uq").on(t.email),
]);

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("auth_sessions_token_hash_uq").on(t.tokenHash), index("auth_sessions_user_id_idx").on(t.userId)]);

export const emailVerificationCodes = pgTable("email_verification_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  codeHash: text("code_hash").notNull(),
  purpose: varchar("purpose", { length: 24 }).notNull().default("register"),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("email_verification_email_idx").on(t.email), index("email_verification_expiry_idx").on(t.expiresAt)]);

export const oauthAccounts = pgTable("oauth_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 24 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("oauth_provider_account_uq").on(t.provider, t.providerAccountId), index("oauth_accounts_user_id_idx").on(t.userId)]);

export type UserRecord = typeof users.$inferSelect;
export type NewUserRecord = typeof users.$inferInsert;

export const appState = pgTable("app_state", {
  id: varchar("id", { length: 32 }).primaryKey(),
  data: jsonb("data").$type<Partial<Database>>().notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loginFailures = pgTable("login_failures", {
  key: varchar("key", { length: 64 }).primaryKey(),
  count: integer("count").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull().defaultNow(),
});
