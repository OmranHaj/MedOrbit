import { pgTable, uuid, text, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Anonymous demo identities, not sign-in accounts or real staff authorization.
export const demoSessionsTable = pgTable("demo_sessions", {
  id: uuid("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  role: text("role").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  check("demo_session_role", sql`${t.role} IN ('representative', 'clinic_demo')`),
]);
