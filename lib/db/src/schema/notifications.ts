import { boolean, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const notificationTypeEnum = pgEnum("notification_type", [
  "CR_APPROVED",
  "CR_REJECTED",
  "CR_REVISED",
  "CR_SENT",
  "REMINDER_DUE",
  "WEBHOOK_FAILED",
  "MEMBER_INVITED",
  "SYSTEM",
]);

export const notificationsTable = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  resourceLabel: text("resource_label"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
