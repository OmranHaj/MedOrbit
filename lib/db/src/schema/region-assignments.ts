import { pgTable, text, integer, serial, timestamp, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { representativesTable } from "./representatives";

export const regionAssignmentsTable = pgTable("region_assignments", {
  region: text("region").primaryKey(),
  representativeId: integer("representative_id").notNull().references(() => representativesTable.id, { onDelete: "restrict" }),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (t) => [check("assignment_version_positive", sql`${t.version} > 0`)]);
export const regionTransfersTable = pgTable("region_transfers", {
  id: serial("id").primaryKey(),
  region: text("region").notNull(),
  fromRepresentativeId: integer("from_representative_id").references(() => representativesTable.id, { onDelete: "restrict" }),
  toRepresentativeId: integer("to_representative_id").notNull().references(() => representativesTable.id, { onDelete: "restrict" }),
  version: integer("version").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (t) => [check("transfer_changes_owner", sql`${t.fromRepresentativeId} IS NULL OR ${t.fromRepresentativeId} <> ${t.toRepresentativeId}`)]);
export const insertRegionAssignmentSchema = createInsertSchema(regionAssignmentsTable).omit({ updatedAt: true });
export const insertRegionTransferSchema = createInsertSchema(regionTransfersTable).omit({ id: true, createdAt: true });
export type RegionAssignmentRecord = typeof regionAssignmentsTable.$inferSelect;
export type RegionTransferRecord = typeof regionTransfersTable.$inferSelect;
