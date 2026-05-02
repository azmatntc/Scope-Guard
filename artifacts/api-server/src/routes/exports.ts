import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { changeRequestsTable, projectsTable, clientContactsTable, activityLogTable, auditLogTable } from "@workspace/db";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { writeAuditLog } from "./auditLogs";

const router: IRouter = Router();

router.get("/exports/change-requests", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { status, dateFrom, dateTo } = req.query as Record<string, string>;

  const conditions: any[] = [eq(projectsTable.organizationId, user.organizationId)];
  if (status) conditions.push(eq(changeRequestsTable.status, status as any));
  if (dateFrom) conditions.push(gte(changeRequestsTable.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(changeRequestsTable.createdAt, new Date(dateTo)));

  const rows = await db.select().from(changeRequestsTable)
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id))
    .where(and(...conditions))
    .orderBy(changeRequestsTable.createdAt);

  const headers = ["ID", "Title", "Project", "Client", "Status", "Hours", "Rate", "Total (USD)", "Created", "Approved", "Comments"];
  const csvRows = rows.map((r) => {
    const cr = r.change_requests;
    return [
      cr.id,
      `"${cr.title.replace(/"/g, '""')}"`,
      `"${r.projects.name.replace(/"/g, '""')}"`,
      `"${r.client_contacts.name.replace(/"/g, '""')}"`,
      cr.status,
      parseFloat(cr.estimatedHours).toFixed(2),
      (cr.hourlyRateCents / 100).toFixed(2),
      (cr.totalCents / 100).toFixed(2),
      cr.createdAt ? new Date(cr.createdAt).toISOString() : "",
      cr.approvedAt ? new Date(cr.approvedAt).toISOString() : "",
      `"${(cr.clientComments || "").replace(/"/g, '""')}"`,
    ].join(",");
  });

  await writeAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    userEmail: user.email,
    action: "EXPORT_GENERATED",
    resourceType: "change_requests_csv",
    resourceLabel: `${rows.length} records`,
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="change_requests_${Date.now()}.csv"`);
  return res.send([headers.join(","), ...csvRows].join("\n"));
});

router.get("/exports/financial-summary", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { dateFrom, dateTo } = req.query as Record<string, string>;

  const conditions: any[] = [eq(projectsTable.organizationId, user.organizationId), eq(changeRequestsTable.status, "APPROVED")];
  if (dateFrom) conditions.push(gte(changeRequestsTable.approvedAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(changeRequestsTable.approvedAt, new Date(dateTo)));

  const rows = await db.select().from(changeRequestsTable)
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id))
    .where(and(...conditions));

  const byProject = new Map<string, { name: string; client: string; count: number; totalCents: number }>();
  for (const r of rows) {
    const key = r.projects.id;
    const ex = byProject.get(key) ?? { name: r.projects.name, client: r.client_contacts.name, count: 0, totalCents: 0 };
    ex.count++;
    ex.totalCents += r.change_requests.totalCents;
    byProject.set(key, ex);
  }

  const grandTotal = rows.reduce((s, r) => s + r.change_requests.totalCents, 0);

  await writeAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    userEmail: user.email,
    action: "EXPORT_GENERATED",
    resourceType: "financial_summary",
  });

  return res.json({
    generatedAt: new Date().toISOString(),
    grandTotalCents: grandTotal,
    grandTotalFormatted: `$${(grandTotal / 100).toFixed(2)}`,
    byProject: Array.from(byProject.values()),
    approvedCount: rows.length,
  });
});

export default router;
