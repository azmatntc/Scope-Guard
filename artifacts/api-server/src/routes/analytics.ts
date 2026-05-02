import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { changeRequestsTable, projectsTable, activityLogTable, clientContactsTable } from "@workspace/db";
import { and, eq, gte, lte, sql, count, sum } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/analytics/overview", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { dateFrom, dateTo } = req.query as { dateFrom?: string; dateTo?: string };

  const fromDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const toDate = dateTo ? new Date(dateTo) : new Date();

  const allCRs = await db.select().from(changeRequestsTable)
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .where(and(
      eq(projectsTable.organizationId, user.organizationId),
      gte(changeRequestsTable.createdAt, fromDate),
      lte(changeRequestsTable.createdAt, toDate),
    ));

  const crs = allCRs.map((r) => r.change_requests);
  const approved = crs.filter((cr) => cr.status === "APPROVED");
  const rejected = crs.filter((cr) => cr.status === "REJECTED");
  const sent = crs.filter((cr) => cr.status === "SENT");

  const totalRevenue = approved.reduce((s, cr) => s + cr.totalCents, 0);
  const avgApprovalHours = approved
    .filter((cr) => cr.approvedAt && cr.createdAt)
    .map((cr) => (new Date(cr.approvedAt!).getTime() - new Date(cr.createdAt).getTime()) / 3600000)
    .reduce((a, b, _, arr) => a + b / arr.length, 0);

  const approvalRate = crs.length > 0
    ? Math.round((approved.length / Math.max(approved.length + rejected.length, 1)) * 100)
    : 0;

  const weeklyMap = new Map<string, { week: string; approved: number; rejected: number; sent: number; revenueCents: number }>();
  for (const cr of crs) {
    const d = new Date(cr.createdAt);
    d.setDate(d.getDate() - d.getDay());
    const key = d.toISOString().slice(0, 10);
    const existing = weeklyMap.get(key) ?? { week: key, approved: 0, rejected: 0, sent: 0, revenueCents: 0 };
    if (cr.status === "APPROVED") { existing.approved++; existing.revenueCents += cr.totalCents; }
    if (cr.status === "REJECTED") existing.rejected++;
    if (cr.status === "SENT") existing.sent++;
    weeklyMap.set(key, existing);
  }
  const weeklyTrends = Array.from(weeklyMap.values()).sort((a, b) => a.week.localeCompare(b.week));

  const categoryMap = new Map<string, { category: string; count: number; revenueCents: number }>();
  for (const cr of approved) {
    const text = (cr.title + " " + cr.description).toLowerCase();
    const cat = text.includes("design") ? "Design"
      : text.includes("develop") || text.includes("code") || text.includes("build") ? "Development"
      : text.includes("content") || text.includes("copy") || text.includes("write") ? "Content"
      : text.includes("seo") || text.includes("marketing") ? "Marketing"
      : "Other";
    const ex = categoryMap.get(cat) ?? { category: cat, count: 0, revenueCents: 0 };
    ex.count++;
    ex.revenueCents += cr.totalCents;
    categoryMap.set(cat, ex);
  }
  const topCategories = Array.from(categoryMap.values()).sort((a, b) => b.revenueCents - a.revenueCents);

  return res.json({
    summary: {
      totalCRs: crs.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      pendingCount: sent.length,
      totalRevenueCents: totalRevenue,
      approvalRate,
      avgApprovalHours: Math.round(avgApprovalHours * 10) / 10,
    },
    weeklyTrends,
    topCategories,
  });
});

export default router;
