import { pgTable, serial, integer, text, date, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { doctorsTable } from "./doctors";
import { productsTable } from "./products";

export const visitsTable = pgTable("visits", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id").notNull().references(() => doctorsTable.id, { onDelete: "restrict" }),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "restrict" }),
  outcome: text("outcome").notNull(),
  notes: text("notes").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (t) => [
  index("visits_doctor_idx").on(t.doctorId),
  index("visits_date_idx").on(t.date),
  check("visits_outcome_valid", sql`${t.outcome} IN ('مهتم', 'متابعة لاحقة', 'غير مهتم', 'لم تتم الزيارة')`),
]);

export const insertVisitSchema = createInsertSchema(visitsTable).omit({ id: true, createdAt: true });
export type VisitRecord = typeof visitsTable.$inferSelect;
