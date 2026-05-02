import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db";
import { and, eq, desc, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const rows = await db.select().from(notificationsTable)
    .where(and(
      eq(notificationsTable.organizationId, user.organizationId),
      eq(notificationsTable.userId, user.id),
    ))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  return res.json(rows);
});

router.get("/notifications/unread-count", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [row] = await db.select({ cnt: count() }).from(notificationsTable)
    .where(and(
      eq(notificationsTable.userId, user.id),
      eq(notificationsTable.isRead, false),
    ));
  return res.json({ count: row?.cnt ?? 0 });
});

router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, user.id)));
  return res.json({ ok: true });
});

router.post("/notifications/mark-all-read", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.userId, user.id), eq(notificationsTable.isRead, false)));
  return res.json({ ok: true });
});

export async function writeNotification(params: {
  organizationId: string;
  userId?: string | null;
  type: typeof notificationsTable.$inferInsert["type"];
  title: string;
  body?: string;
  resourceType?: string;
  resourceId?: string;
  resourceLabel?: string;
}) {
  if (!params.userId) return;
  await db.insert(notificationsTable).values({
    organizationId: params.organizationId,
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body ?? "",
    resourceType: params.resourceType ?? null,
    resourceId: params.resourceId ?? null,
    resourceLabel: params.resourceLabel ?? null,
  });
}

export async function writeNotificationForOrg(params: {
  organizationId: string;
  type: typeof notificationsTable.$inferInsert["type"];
  title: string;
  body?: string;
  resourceType?: string;
  resourceId?: string;
  resourceLabel?: string;
  excludeUserId?: string;
}) {
  const members = await db.select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.organizationId, params.organizationId));

  const rows = members
    .filter((m) => m.id !== params.excludeUserId)
    .map((m) => ({
      organizationId: params.organizationId,
      userId: m.id,
      type: params.type,
      title: params.title,
      body: params.body ?? "",
      resourceType: params.resourceType ?? null,
      resourceId: params.resourceId ?? null,
      resourceLabel: params.resourceLabel ?? null,
    }));

  if (rows.length) await db.insert(notificationsTable).values(rows);
}

export default router;
