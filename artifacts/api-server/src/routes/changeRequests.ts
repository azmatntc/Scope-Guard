import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { changeRequestsTable, projectsTable, clientContactsTable, activityLogTable, remindersTable } from "@workspace/db";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";
import { writeNotificationForOrg } from "./notifications";
import { fireWebhookEvent } from "./webhooks";
import { writeAuditLog } from "./auditLogs";

const router: IRouter = Router();

const createSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().min(1),
  estimatedHours: z.number().positive(),
  deadline: z.string().nullable().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  estimatedHours: z.number().positive().optional(),
  deadline: z.string().nullable().optional(),
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT"],
  SENT: ["APPROVED", "REJECTED", "REVISED"],
  REVISED: ["SENT"],
  APPROVED: [],
  REJECTED: [],
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

async function getEnrichedCR(cr: any, project: any, contact: any) {
  return {
    id: cr.id,
    projectId: cr.projectId,
    projectName: project.name,
    clientName: contact.name,
    clientEmail: contact.email,
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
  };
}

async function logActivity(cr: any, project: any, contact: any, action: string) {
  await db.insert(activityLogTable).values({
    changeRequestId: cr.id,
    projectId: project.id,
    changeRequestTitle: cr.title,
    projectName: project.name,
    clientName: contact.name,
    action: action as any,
    totalCents: cr.totalCents,
  });
}

router.get("/change-requests", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { projectId, status, search } = req.query as { projectId?: string; status?: string; search?: string };

  const rows = await db.select().from(changeRequestsTable)
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id))
    .where(
      and(
        eq(projectsTable.organizationId, user.organizationId),
        projectId ? eq(changeRequestsTable.projectId, projectId) : undefined,
        status ? eq(changeRequestsTable.status, status as any) : undefined,
        search ? or(ilike(changeRequestsTable.title, `%${search}%`), ilike(projectsTable.name, `%${search}%`), ilike(clientContactsTable.name, `%${search}%`)) : undefined,
      )
    ).orderBy(sql`${changeRequestsTable.createdAt} desc`);

  return res.json(rows.map((r) => getEnrichedCR(r.change_requests, r.projects, r.client_contacts)));
});

router.post("/change-requests", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const [project] = await db.select().from(projectsTable).where(
    and(eq(projectsTable.id, parsed.data.projectId), eq(projectsTable.organizationId, user.organizationId))
  ).limit(1);
  if (!project) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });

  const [contact] = await db.select().from(clientContactsTable).where(eq(clientContactsTable.id, project.clientContactId)).limit(1);

  const totalCents = Math.round(parsed.data.estimatedHours * project.hourlyRateCents);

  const [cr] = await db.insert(changeRequestsTable).values({
    projectId: parsed.data.projectId,
    title: parsed.data.title,
    description: parsed.data.description,
    estimatedHours: parsed.data.estimatedHours.toString(),
    hourlyRateCents: project.hourlyRateCents,
    totalCents,
    deadline: parsed.data.deadline || null,
    status: "DRAFT",
    clientComments: "",
  }).returning();

  await logActivity(cr, project, contact, "CREATED");

  return res.status(201).json(await getEnrichedCR(cr, project, contact));
});

router.get("/change-requests/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [row] = await db.select().from(changeRequestsTable)
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id))
    .where(and(eq(changeRequestsTable.id, req.params.id), eq(projectsTable.organizationId, user.organizationId)))
    .limit(1);
  if (!row) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Change request not found" } });
  return res.json(await getEnrichedCR(row.change_requests, row.projects, row.client_contacts));
});

router.patch("/change-requests/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const [row] = await db.select().from(changeRequestsTable)
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id))
    .where(and(eq(changeRequestsTable.id, req.params.id), eq(projectsTable.organizationId, user.organizationId)))
    .limit(1);
  if (!row) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Change request not found" } });

  if (!["DRAFT", "REVISED"].includes(row.change_requests.status)) {
    return res.status(400).json({ error: { code: "INVALID_STATE", message: "Only DRAFT or REVISED change requests can be edited" } });
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.deadline !== undefined) updates.deadline = parsed.data.deadline;
  if (parsed.data.estimatedHours !== undefined) {
    updates.estimatedHours = parsed.data.estimatedHours.toString();
    updates.totalCents = Math.round(parsed.data.estimatedHours * row.change_requests.hourlyRateCents);
  }

  const [cr] = await db.update(changeRequestsTable).set(updates).where(eq(changeRequestsTable.id, req.params.id)).returning();
  await logActivity(cr, row.projects, row.client_contacts, "UPDATED");
  return res.json(await getEnrichedCR(cr, row.projects, row.client_contacts));
});

router.delete("/change-requests/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [row] = await db.select().from(changeRequestsTable)
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .where(and(eq(changeRequestsTable.id, req.params.id), eq(projectsTable.organizationId, user.organizationId)))
    .limit(1);
  if (!row) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Change request not found" } });
  if (row.change_requests.status !== "DRAFT") {
    return res.status(400).json({ error: { code: "INVALID_STATE", message: "Only DRAFT change requests can be deleted" } });
  }
  await db.delete(changeRequestsTable).where(eq(changeRequestsTable.id, req.params.id));
  return res.status(204).send();
});

router.post("/change-requests/:id/send", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [row] = await db.select().from(changeRequestsTable)
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id))
    .where(and(eq(changeRequestsTable.id, req.params.id), eq(projectsTable.organizationId, user.organizationId)))
    .limit(1);
  if (!row) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Change request not found" } });

  const allowed = VALID_TRANSITIONS[row.change_requests.status] ?? [];
  if (!allowed.includes("SENT")) {
    return res.status(400).json({ error: { code: "INVALID_TRANSITION", message: `Cannot send a ${row.change_requests.status} change request` } });
  }

  const [cr] = await db.update(changeRequestsTable).set({ status: "SENT", updatedAt: new Date() }).where(eq(changeRequestsTable.id, req.params.id)).returning();
  await logActivity(cr, row.projects, row.client_contacts, "SENT");

  const scheduledFor = new Date(Date.now() + 48 * 3600 * 1000);
  await db.insert(remindersTable).values({
    organizationId: row.projects.organizationId,
    changeRequestId: cr.id,
    delayHours: 48,
    message: "",
    scheduledFor,
  });

  await writeNotificationForOrg({
    organizationId: row.projects.organizationId,
    type: "CR_SENT",
    title: `Change order "${cr.title}" sent to ${row.client_contacts.name}`,
    body: `Total: $${(cr.totalCents / 100).toFixed(2)} · Project: ${row.projects.name} · Auto-reminder scheduled for 48h.`,
    resourceType: "change_request",
    resourceId: cr.id,
    resourceLabel: cr.title,
    excludeUserId: user.id,
  });

  await writeAuditLog({
    organizationId: row.projects.organizationId,
    userId: user.id,
    userEmail: user.email,
    action: "CR_SENT",
    resourceType: "change_request",
    resourceId: cr.id,
    resourceLabel: cr.title,
    ipAddress: req.ip || undefined,
  });

  fireWebhookEvent(row.projects.organizationId, "change_request.sent", {
    data: {
      id: cr.id,
      title: cr.title,
      projectName: row.projects.name,
      clientName: row.client_contacts.name,
      clientEmail: row.client_contacts.email,
      totalCents: cr.totalCents,
    },
  });

  return res.json(await getEnrichedCR(cr, row.projects, row.client_contacts));
});

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  action: z.enum(["send", "delete"]),
});

router.post("/change-requests/bulk", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = bulkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const { ids, action } = parsed.data;
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const id of ids) {
    try {
      const [row] = await db.select().from(changeRequestsTable)
        .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
        .innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id))
        .where(and(eq(changeRequestsTable.id, id), eq(projectsTable.organizationId, user.organizationId)))
        .limit(1);

      if (!row) { results.push({ id, ok: false, error: "Not found" }); continue; }

      if (action === "send") {
        const allowed = VALID_TRANSITIONS[row.change_requests.status] ?? [];
        if (!allowed.includes("SENT")) {
          results.push({ id, ok: false, error: `Cannot send a ${row.change_requests.status} CO` });
          continue;
        }
        const [cr] = await db.update(changeRequestsTable)
          .set({ status: "SENT", updatedAt: new Date() })
          .where(eq(changeRequestsTable.id, id)).returning();
        await logActivity(cr, row.projects, row.client_contacts, "SENT");
        const scheduledFor = new Date(Date.now() + 48 * 3600 * 1000);
        await db.insert(remindersTable).values({
          organizationId: row.projects.organizationId,
          changeRequestId: cr.id,
          delayHours: 48,
          message: "",
          scheduledFor,
        });
        results.push({ id, ok: true });
      } else if (action === "delete") {
        if (row.change_requests.status !== "DRAFT") {
          results.push({ id, ok: false, error: "Only DRAFT COs can be deleted" });
          continue;
        }
        await db.delete(changeRequestsTable).where(eq(changeRequestsTable.id, id));
        results.push({ id, ok: true });
      }
    } catch (e: any) {
      results.push({ id, ok: false, error: e?.message });
    }
  }

  return res.json({ results, succeeded: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
});

export default router;
