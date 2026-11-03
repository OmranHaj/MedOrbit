import { pgTable, uuid, integer, text, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { doctorsTable } from "./doctors";
import { demoSessionsTable } from "./demo-sessions";

export const pendingVisitsTable = pgTable("pending_visits", {
  id: uuid("id").primaryKey(),
  doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "restrict" }),
  representativeId: uuid("representative_id").notNull().references(() => demoSessionsTable.id, { onDelete: "restrict" }),
  otpHash: text("otp_hash"),
  // Encrypted delivery envelope ONLY for the demo secretary; never a plaintext OTP.
  clinicEnvelope: text("clinic_envelope"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("pending_visits_representative_idx").on(t.representativeId),
  index("pending_visits_expiry_idx").on(t.expiresAt),
  check("pending_visits_attempts", sql`${t.failedAttempts} BETWEEN 0 AND 5`),
]);
export type PendingVisitRecord = typeof pendingVisitsTable.$inferSelect;
