import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db, pendingVisitsTable, type PendingVisitRecord } from "@workspace/db";
import { and, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { representativeLabel } from "./demo-session";

export type VisitTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const CONFIRMED_STATUS = "Confirmed by clinic demo code" as const;
export const MAX_ATTEMPTS = 5;

function key(purpose: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error("A persistent SESSION_SECRET of at least 16 characters is required for demo OTP verification.");
  return createHmac("sha256", secret).update(`medorbit:visit-otp:v1:${purpose}`).digest();
}
export function assertOtpConfiguration() { key("hash"); key("clinic-envelope"); }
export const otpContext = (id: string, doctorId: number, representativeId: string) =>
  JSON.stringify([id, doctorId, representativeId]);

export function hashOtp(code: string, context: string) {
  return createHmac("sha256", key("hash")).update(`${context}\0${code}`).digest("hex");
}
export function matchesOtp(code: string, context: string, expected: string) {
  const actual = Buffer.from(hashOtp(code, context), "hex");
  const stored = Buffer.from(expected, "hex");
  return stored.length === actual.length && timingSafeEqual(actual, stored);
}
export function encryptClinicCode(code: string, context: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("clinic-envelope"), nonce);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [nonce, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64")).join(".");
}
export function decryptClinicCode(envelope: string, context: string) {
  const [nonce, tag, ciphertext] = envelope.split(".").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key("clinic-envelope"), nonce);
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
export async function databaseNow(tx: VisitTransaction) {
  const result = await tx.execute<{ now: Date }>(sql`SELECT clock_timestamp() AS now`);
  return new Date(result.rows[0].now);
}
export function pendingView(row: PendingVisitRecord, doctorName: string, now: Date) {
  const status = row.submittedAt ? "reported" : row.supersededAt ? "superseded" :
    row.verifiedAt ? "confirmed" : row.failedAttempts >= MAX_ATTEMPTS ? "locked" :
      row.expiresAt <= now ? "expired" : "pending";
  return {
    id: row.id, doctorId: row.doctorId, doctorName,
    representativeId: row.representativeId, representativeLabel: representativeLabel(row.representativeId),
    expiresAt: row.expiresAt.toISOString(), serverTime: now.toISOString(), status,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - row.failedAttempts),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
  };
}
export async function clearExpiredOtpSecrets() {
  await db.update(pendingVisitsTable).set({ otpHash: null, clinicEnvelope: null }).where(and(
    isNull(pendingVisitsTable.verifiedAt), isNotNull(pendingVisitsTable.otpHash),
    lte(pendingVisitsTable.expiresAt, sql`clock_timestamp()`),
  ));
}
