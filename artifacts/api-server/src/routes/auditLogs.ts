import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { auditLogTable, usersTable } from "@workspace/db";
import { and, eq, sql, desc, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/audit-logs", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { resourceType, resourceId, userId, dateFrom, dateTo, limit: limitStr } = req.query as Record<string, string>;
  const limit = Math.min(parseInt(limitStr || "50") || 50, 200);

  const conditions: any[] = [eq(auditLogTable.organizationId, user.organizationId)];
  if (resourceType) conditions.push(eq(auditLogTable.resourceType, resourceType));
  if (resourceId) conditions.push(eq(auditLogTable.resourceId, resourceId));
  if (userId) conditions.push(eq(auditLogTable.userId, userId));
  if (dateFrom) conditions.push(gte(auditLogTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(auditLogTable.createdAt, new Date(dateTo)));

  const rows = await db.select().from(auditLogTable)
    .where(and(...conditions))
    .orderBy(desc(auditLogTable.createdAt))
    .limit(limit);

  return res.json(rows);
});

export async function writeAuditLog(params: {
  organizationId: string;
  userId?: string | null;
  userEmail?: string | null;
  action: typeof auditLogTable.$inferInsert["action"];
  resourceType: string;
  resourceId?: string;
  resourceLabel?: string;
  fieldChanges?: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  await db.insert(auditLogTable).values({
    organizationId: params.organizationId,
    userId: params.userId ?? null,
    userEmail: params.userEmail ?? null,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId ?? null,
    resourceLabel: params.resourceLabel ?? null,
    fieldChanges: params.fieldChanges ?? [],
    metadata: params.metadata ?? {},
    ipAddress: params.ipAddress ?? null,
  });
}

export default router;
