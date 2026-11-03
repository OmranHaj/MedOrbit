import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, demoSessionsTable } from "@workspace/db";

type Role = "representative" | "clinic_demo";
const cookieNames: Record<Role, string> = {
  representative: "medorbit_demo_representative",
  clinic_demo: "medorbit_demo_clinic",
};
const cookiePath = "/api";
const ttl = 7 * 24 * 60 * 60 * 1000;
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
export const representativeLabel = (id: string) => `مندوب تجريبي ${id.slice(0, 8)}`;

export async function getDemoSession(req: Request, role: Role) {
  const name = cookieNames[role];
  const token = req.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [session] = await db.select().from(demoSessionsTable).where(and(
    eq(demoSessionsTable.tokenHash, digest(token)),
    eq(demoSessionsTable.role, role),
    gt(demoSessionsTable.expiresAt, sql`clock_timestamp()`),
  ));
  return session ?? null;
}

export async function ensureDemoSession(req: Request, res: Response, role: Role) {
  const existing = await getDemoSession(req, role);
  if (existing) return sessionView(existing);
  const token = randomBytes(32).toString("hex");
  const [session] = await db.insert(demoSessionsTable).values({
    id: randomUUID(), tokenHash: digest(token), role,
    expiresAt: sql`clock_timestamp() + interval '7 days'`,
  }).returning();
  const secure = req.secure || req.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
  res.cookie(cookieNames[role], token, { path: cookiePath, httpOnly: true, sameSite: "strict", secure, maxAge: ttl });
  return sessionView(session);
}

function sessionView(session: typeof demoSessionsTable.$inferSelect) {
  return {
    id: session.id, role: session.role, expiresAt: session.expiresAt.toISOString(),
    label: session.role === "representative" ? representativeLabel(session.id) : "سكرتير العيادة التجريبي — DEMO",
  };
}
