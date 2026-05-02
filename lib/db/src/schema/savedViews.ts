import { boolean, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

export const savedViewsTable = pgTable("saved_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  searchQuery: text("search_query").notNull().default(""),
  filterJson: jsonb("filter_json").$type<Record<string, unknown>>().notNull().default({}),
  sortField: text("sort_field").notNull().default("createdAt"),
  sortDir: text("sort_dir").notNull().default("desc"),
  isShared: boolean("is_shared").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SavedView = typeof savedViewsTable.$inferSelect;
