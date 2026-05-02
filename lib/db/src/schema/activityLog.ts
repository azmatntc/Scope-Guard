import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { changeRequestsTable } from "./changeRequests";
import { projectsTable } from "./projects";

export const activityActionEnum = pgEnum("activity_action", [
  "CREATED",
  "SENT",
  "APPROVED",
  "REJECTED",
  "REVISED",
  "UPDATED",
]);

export const activityLogTable = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  changeRequestId: uuid("change_request_id")
    .notNull()
    .references(() => changeRequestsTable.id, { onDelete: "cascade" }),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  changeRequestTitle: text("change_request_title").notNull(),
  projectName: text("project_name").notNull(),
  clientName: text("client_name").notNull(),
  action: activityActionEnum("action").notNull(),
  totalCents: integer("total_cents").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ActivityLog = typeof activityLogTable.$inferSelect;
