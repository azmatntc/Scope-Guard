import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const teamRoleEnum = pgEnum("team_role", [
  "ADMIN",
  "PROJECT_MANAGER",
  "FINANCE_VIEWER",
]);

export const teamInviteStatusEnum = pgEnum("team_invite_status", [
  "PENDING",
  "ACCEPTED",
  "DECLINED",
]);

export const teamInvitesTable = pgTable("team_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  invitedByUserId: uuid("invited_by_user_id")
    .references(() => usersTable.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  role: teamRoleEnum("role").notNull().default("PROJECT_MANAGER"),
  token: uuid("token").notNull().defaultRandom().unique(),
  status: teamInviteStatusEnum("status").notNull().default("PENDING"),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TeamInvite = typeof teamInvitesTable.$inferSelect;
