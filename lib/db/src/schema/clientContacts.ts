import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";

export const clientContactsTable = pgTable(
  "client_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizationsTable.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("unique_org_client_email").on(t.organizationId, t.email)],
);

export const insertClientContactSchema = createInsertSchema(clientContactsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClientContact = z.infer<typeof insertClientContactSchema>;
export type ClientContact = typeof clientContactsTable.$inferSelect;
