import { check, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { productsTable } from "./products";

/** Fictional aggregate entries only: intentionally no doctor/patient IDs, notes, or file fields. */
export const pharmacyObservationsTable = pgTable("pharmacy_observations", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "restrict" }),
  region: text("region").notNull(),
  period: text("period").notNull(),
  unitsSold: integer("units_sold").notNull(),
  availability: text("availability").notNull(),
  sourceLabel: text("source_label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("pharmacy_product_region_period_unique").on(t.productId, t.region, t.period),
  check("pharmacy_units_valid", sql`${t.unitsSold} BETWEEN 0 AND 1000000`),
  check("pharmacy_period_valid", sql`${t.period} ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'`),
  check("pharmacy_region_fictional", sql`${t.region} IN ('الإقليم التجريبي أ', 'الإقليم التجريبي ب', 'الإقليم التجريبي ج')`),
  check("pharmacy_source_fictional", sql`${t.sourceLabel} IN ('تجميع خيالي أ', 'تجميع خيالي ب', 'تجميع خيالي ج')`),
  check("pharmacy_availability_valid", sql`${t.availability} IN ('متوفر', 'محدود', 'غير متوفر')`),
]);
export const insertPharmacyObservationSchema = createInsertSchema(pharmacyObservationsTable)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type PharmacyObservationRecord = typeof pharmacyObservationsTable.$inferSelect;
