import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientContactsTable } from "./clientContacts";
import { organizationsTable } from "./organizations";

export const projectStatusEnum = pgEnum("project_status", ["ACTIVE", "COMPLETED", "ARCHIVED"]);

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  clientContactId: uuid("client_contact_id")
    .notNull()
    .references(() => clientContactsTable.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  hourlyRateCents: integer("hourly_rate_cents").notNull(),
  status: projectStatusEnum("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
