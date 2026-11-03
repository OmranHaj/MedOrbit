import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  demoKey: text("demo_key").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  scientificTopic: text("scientific_topic").notNull(),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true });
export type ProductRecord = typeof productsTable.$inferSelect;
