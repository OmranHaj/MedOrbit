import { pgTable, serial, text, doublePrecision, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

export const doctorsTable = pgTable("doctors", {
  id: serial("id").primaryKey(),
  demoKey: text("demo_key").unique(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  region: text("region").notNull(),
  clinicAddress: text("clinic_address").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  visitingStart: text("visiting_start").notNull(),
  visitingEnd: text("visiting_end").notNull(),
  scientificInterests: text("scientific_interests").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
}, (t) => [
  check("doctor_latitude_range", sql`${t.latitude} BETWEEN -90 AND 90`),
  check("doctor_longitude_range", sql`${t.longitude} BETWEEN -180 AND 180`),
  check("doctor_visiting_order", sql`${t.visitingStart} < ${t.visitingEnd}`),
]);

export const insertDoctorSchema = createInsertSchema(doctorsTable).omit({ id: true, createdAt: true, demoKey: true });
export type DoctorRecord = typeof doctorsTable.$inferSelect;
