import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  inet,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const changeRequestStatusEnum = pgEnum("change_request_status", [
  "DRAFT",
  "SENT",
  "APPROVED",
  "REJECTED",
  "REVISED",
]);

export const changeRequestsTable = pgTable("change_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }).notNull(),
  hourlyRateCents: integer("hourly_rate_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  deadline: date("deadline"),
  status: changeRequestStatusEnum("status").notNull().default("DRAFT"),
  approvalToken: uuid("approval_token").notNull().defaultRandom().unique(),
  approvedAt: timestamp("approved_at"),
  approvedByIp: inet("approved_by_ip"),
  clientComments: text("client_comments").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertChangeRequestSchema = createInsertSchema(changeRequestsTable).omit({
  id: true,
  approvalToken: true,
  approvedAt: true,
  approvedByIp: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertChangeRequest = z.infer<typeof insertChangeRequestSchema>;
export type ChangeRequest = typeof changeRequestsTable.$inferSelect;
