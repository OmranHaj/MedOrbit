import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const representativesTable = pgTable("representatives", {
  id: serial("id").primaryKey(),
  demoKey: text("demo_key").notNull().unique(),
  name: text("name").notNull(),
});
export const insertRepresentativeSchema = createInsertSchema(representativesTable).omit({ id: true });
export type RepresentativeRecord = typeof representativesTable.$inferSelect;
