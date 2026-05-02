import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { changeRequestsTable } from "./changeRequests";

export const reminderStatusEnum = pgEnum("reminder_status", [
  "PENDING",
  "SENT",
  "CANCELLED",
]);

export const remindersTable = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  changeRequestId: uuid("change_request_id")
    .notNull()
    .references(() => changeRequestsTable.id, { onDelete: "cascade" }),
  scheduledFor: timestamp("scheduled_for").notNull(),
  delayHours: integer("delay_hours").notNull(),
  message: text("message").notNull().default(""),
  status: reminderStatusEnum("status").notNull().default("PENDING"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Reminder = typeof remindersTable.$inferSelect;
