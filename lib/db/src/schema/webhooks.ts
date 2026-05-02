import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const webhookEventEnum = pgEnum("webhook_event", [
  "change_request.approved",
  "change_request.rejected",
  "change_request.sent",
  "change_request.revised",
  "project.completed",
]);

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "SUCCESS",
  "FAILED",
  "PENDING",
]);

export const webhooksTable = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: jsonb("events").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const webhookDeliveriesTable = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooksTable.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  status: webhookDeliveryStatusEnum("status").notNull().default("PENDING"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Webhook = typeof webhooksTable.$inferSelect;
export type WebhookDelivery = typeof webhookDeliveriesTable.$inferSelect;
