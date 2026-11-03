import { pgTable, serial, integer, text, uuid, date, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { doctorsTable } from "./doctors";
import { productsTable } from "./products";
import { pendingVisitsTable } from "./pending-visits";

export const visitsTable = pgTable("visits", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "restrict" }),
  pendingVisitId: uuid("pending_visit_id").unique().references(() => pendingVisitsTable.id, { onDelete: "restrict" }),
  verificationStatus: text("verification_status").notNull().default("Unverified legacy report"),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "restrict" }),
  outcome: text("outcome").notNull(),
  notes: text("notes").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (t) => [
  index("visits_doctor_idx").on(t.doctorId),
  index("visits_date_idx").on(t.date),
  check("visits_outcome_valid", sql`${t.outcome} IN ('مهتم', 'متابعة لاحقة', 'غير مهتم', 'لم تتم الزيارة')`),
  check("visits_verification_consistent", sql`(${t.pendingVisitId} IS NULL AND ${t.verificationStatus} = 'Unverified legacy report') OR (${t.pendingVisitId} IS NOT NULL AND ${t.verificationStatus} = 'Confirmed by clinic demo code')`),
]);

export const insertVisitSchema = createInsertSchema(visitsTable).omit({ id: true, createdAt: true });
export type VisitRecord = typeof visitsTable.$inferSelect;
