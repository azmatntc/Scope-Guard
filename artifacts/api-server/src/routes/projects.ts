import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, clientContactsTable, changeRequestsTable } from "@workspace/db";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  clientContactId: z.string().uuid(),
  hourlyRateCents: z.number().int().min(0),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  clientContactId: z.string().uuid().optional(),
  hourlyRateCents: z.number().int().min(0).optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "ARCHIVED"]).optional(),
});

async function enrichProject(project: any, clientContact: any, changeRequests: any[]) {
  const approvedCRs = changeRequests.filter((cr: any) => cr.status === "APPROVED");
  const totalApprovedCents = approvedCRs.reduce((sum: number, cr: any) => sum + cr.totalCents, 0);
  const pendingCount = changeRequests.filter((cr: any) => cr.status === "SENT").length;
  const approvedCount = approvedCRs.length;

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    hourlyRateCents: project.hourlyRateCents,
    organizationId: project.organizationId,
    clientContactId: project.clientContactId,
    clientName: clientContact.name,
    clientEmail: clientContact.email,
    clientCompany: clientContact.company,
    totalApprovedCents,
    changeRequestCount: changeRequests.length,
    pendingCount,
    approvedCount,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

router.get("/projects", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { search, status } = req.query as { search?: string; status?: string };

  const projects = await db.select().from(projectsTable).innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id)).where(
    and(
      eq(projectsTable.organizationId, user.organizationId),
      status ? eq(projectsTable.status, status as any) : undefined,
      search ? or(ilike(projectsTable.name, `%${search}%`), ilike(clientContactsTable.name, `%${search}%`)) : undefined,
    )
  ).orderBy(sql`${projectsTable.createdAt} desc`);

  const result = await Promise.all(projects.map(async (row) => {
    const crs = await db.select().from(changeRequestsTable).where(eq(changeRequestsTable.projectId, row.projects.id));
    return enrichProject(row.projects, row.client_contacts, crs);
  }));

  return res.json(result);
});

router.post("/projects", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const [contact] = await db.select().from(clientContactsTable).where(
    and(eq(clientContactsTable.id, parsed.data.clientContactId), eq(clientContactsTable.organizationId, user.organizationId))
  ).limit(1);
  if (!contact) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Client contact not found" } });

  const [project] = await db.insert(projectsTable).values({
    organizationId: user.organizationId,
    clientContactId: parsed.data.clientContactId,
    name: parsed.data.name,
    description: parsed.data.description || "",
    hourlyRateCents: parsed.data.hourlyRateCents,
    status: "ACTIVE",
  }).returning();

  return res.status(201).json(await enrichProject(project, contact, []));
});

router.get("/projects/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [row] = await db.select().from(projectsTable).innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id)).where(
    and(eq(projectsTable.id, req.params.id), eq(projectsTable.organizationId, user.organizationId))
  ).limit(1);
  if (!row) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });

  const changeRequests = await db.select().from(changeRequestsTable).where(eq(changeRequestsTable.projectId, req.params.id)).orderBy(sql`${changeRequestsTable.createdAt} desc`);

  const enriched = await enrichProject(row.projects, row.client_contacts, changeRequests);
  const crList = changeRequests.map((cr) => ({
    id: cr.id,
    projectId: cr.projectId,
    projectName: row.projects.name,
    clientName: row.client_contacts.name,
    clientEmail: row.client_contacts.email,
    title: cr.title,
    description: cr.description,
    estimatedHours: parseFloat(cr.estimatedHours),
    hourlyRateCents: cr.hourlyRateCents,
    totalCents: cr.totalCents,
    status: cr.status,
    deadline: cr.deadline,
    approvalToken: cr.approvalToken,
    approvedAt: cr.approvedAt,
    clientComments: cr.clientComments,
    createdAt: cr.createdAt,
    updatedAt: cr.updatedAt,
  }));

  return res.json({ ...enriched, changeRequests: crList });
});

router.patch("/projects/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const [existing] = await db.select().from(projectsTable).where(
    and(eq(projectsTable.id, req.params.id), eq(projectsTable.organizationId, user.organizationId))
  ).limit(1);
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.clientContactId !== undefined) updates.clientContactId = parsed.data.clientContactId;
  if (parsed.data.hourlyRateCents !== undefined) updates.hourlyRateCents = parsed.data.hourlyRateCents;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const [project] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, req.params.id)).returning();
  const [contact] = await db.select().from(clientContactsTable).where(eq(clientContactsTable.id, project.clientContactId)).limit(1);
  const crs = await db.select().from(changeRequestsTable).where(eq(changeRequestsTable.projectId, project.id));

  return res.json(await enrichProject(project, contact, crs));
});

router.delete("/projects/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [existing] = await db.select().from(projectsTable).where(
    and(eq(projectsTable.id, req.params.id), eq(projectsTable.organizationId, user.organizationId))
  ).limit(1);
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });

  await db.update(projectsTable).set({ status: "ARCHIVED", updatedAt: new Date() }).where(eq(projectsTable.id, req.params.id));
  return res.status(204).send();
});

router.get("/projects/:id/export", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [project] = await db.select().from(projectsTable).innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id)).where(
    and(eq(projectsTable.id, req.params.id), eq(projectsTable.organizationId, user.organizationId))
  ).limit(1);
  if (!project) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });

  const crs = await db.select().from(changeRequestsTable).where(
    and(eq(changeRequestsTable.projectId, req.params.id), eq(changeRequestsTable.status, "APPROVED"))
  ).orderBy(changeRequestsTable.approvedAt);

  const rows = [
    ["Date", "Name", "Item", "Description", "Qty", "Rate", "Amount", "Customer:Job", "Memo"].join(","),
    ...crs.map((cr) => [
      cr.approvedAt ? new Date(cr.approvedAt).toLocaleDateString("en-US") : "",
      `"${project.client_contacts.name}"`,
      "Scope Change",
      `"${cr.title}: ${cr.description.slice(0, 50)}"`,
      parseFloat(cr.estimatedHours).toFixed(2),
      (cr.hourlyRateCents / 100).toFixed(2),
      (cr.totalCents / 100).toFixed(2),
      `"${project.client_contacts.name}: ${project.projects.name}"`,
      `"Approved via ScopeGuard - Token: ${cr.approvalToken}"`,
    ].join(","))
  ];

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="scopeguard_export.csv"`);
  return res.send(rows.join("\n"));
});

export default router;
