import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const auditActionEnum = pgEnum("audit_action", [
  "CR_CREATED",
  "CR_UPDATED",
  "CR_DELETED",
  "CR_SENT",
  "CR_APPROVED",
  "CR_REJECTED",
  "CR_REVISED",
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_ARCHIVED",
  "CONTACT_CREATED",
  "CONTACT_UPDATED",
  "CONTACT_DELETED",
  "MEMBER_INVITED",
  "MEMBER_REMOVED",
  "MEMBER_ROLE_CHANGED",
  "WEBHOOK_CREATED",
  "WEBHOOK_DELETED",
  "EXPORT_GENERATED",
  "LOGIN",
  "LOGOUT",
]);

export const auditLogTable = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userEmail: text("user_email"),
  action: auditActionEnum("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  resourceLabel: text("resource_label"),
  fieldChanges: jsonb("field_changes").$type<Array<{ field: string; oldValue: unknown; newValue: unknown }>>().default([]),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type AuditLog = typeof auditLogTable.$inferSelect;
