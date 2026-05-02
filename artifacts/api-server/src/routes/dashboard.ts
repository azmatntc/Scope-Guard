import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { changeRequestsTable, projectsTable, activityLogTable, clientContactsTable } from "@workspace/db";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const user = (req as any).user;

  const [allProjects, allCRs] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.organizationId, user.organizationId)),
    db.select().from(changeRequestsTable)
      .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
      .where(eq(projectsTable.organizationId, user.organizationId)),
  ]);

  const totalProjects = allProjects.length;
  const activeProjects = allProjects.filter((p) => p.status === "ACTIVE").length;

  const crs = allCRs.map((r) => r.change_requests);
  const totalChangeRequests = crs.length;
  const draftCount = crs.filter((cr) => cr.status === "DRAFT").length;
  const sentCount = crs.filter((cr) => cr.status === "SENT").length;
  const approvedCount = crs.filter((cr) => cr.status === "APPROVED").length;
  const rejectedCount = crs.filter((cr) => cr.status === "REJECTED").length;
  const revisedCount = crs.filter((cr) => cr.status === "REVISED").length;
  const pendingApproval = sentCount;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const approvedThisMonth = crs.filter(
    (cr) => cr.status === "APPROVED" && cr.approvedAt && new Date(cr.approvedAt) >= startOfMonth
  ).length;

  const totalApprovedCents = crs
    .filter((cr) => cr.status === "APPROVED")
    .reduce((sum, cr) => sum + cr.totalCents, 0);

  return res.json({
    totalProjects,
    activeProjects,
    totalChangeRequests,
    pendingApproval,
    approvedThisMonth,
    totalApprovedCents,
    totalApprovedFormatted: `$${(totalApprovedCents / 100).toFixed(2)}`,
    draftCount,
    sentCount,
    approvedCount,
    rejectedCount,
    revisedCount,
  });
});

router.get("/dashboard/recent-activity", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  const rows = await db.select().from(activityLogTable)
    .innerJoin(changeRequestsTable, eq(activityLogTable.changeRequestId, changeRequestsTable.id))
    .innerJoin(projectsTable, eq(activityLogTable.projectId, projectsTable.id))
    .where(eq(projectsTable.organizationId, user.organizationId))
    .orderBy(sql`${activityLogTable.createdAt} desc`)
    .limit(limit);

  return res.json(rows.map((r) => ({
    id: r.activity_log.id,
    changeRequestId: r.activity_log.changeRequestId,
    changeRequestTitle: r.activity_log.changeRequestTitle,
    projectName: r.activity_log.projectName,
    clientName: r.activity_log.clientName,
    action: r.activity_log.action,
    totalCents: r.activity_log.totalCents,
    totalFormatted: `$${(r.activity_log.totalCents / 100).toFixed(2)}`,
    createdAt: r.activity_log.createdAt,
  })));
});

export default router;
