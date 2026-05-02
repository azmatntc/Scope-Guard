import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { changeRequestsTable, projectsTable, clientContactsTable, activityLogTable, remindersTable } from "@workspace/db";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";
import { writeNotificationForOrg } from "./notifications";
import { fireWebhookEvent } from "./webhooks";
import { writeAuditLog } from "./auditLogs";
import { calculateScopeTotalCents } from "../lib/financial";
import { validateStateTransition } from "../lib/workflow";
import { buildChangeRequestQuery } from "../lib/queries";
import { atomicWithAudit } from "../lib/transaction";
import { toAuditSnapshot } from "../lib/diff";

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

  const results = await buildChangeRequestQuery(user.organizationId, {
    projectId: projectId || undefined,
    status: status as any || undefined,
    search: search || undefined,
  });

  return res.json(results);
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

  const { totalCents } = calculateScopeTotalCents(parsed.data.estimatedHours, project.hourlyRateCents);

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
    const { totalCents: newTotal } = calculateScopeTotalCents(
      parsed.data.estimatedHours,
      row.change_requests.hourlyRateCents,
    );
    updates.totalCents = newTotal;
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

  const transitionResult = validateStateTransition(row.change_requests.status, "SENT", user.role);
  if (!transitionResult.allowed) {
    return res.status(400).json({ error: { code: transitionResult.errorCode ?? "INVALID_TRANSITION", message: transitionResult.errorMessage } });
  }

  const beforeSnapshot = toAuditSnapshot(row.change_requests as Record<string, unknown>);

  const cr = await atomicWithAudit<typeof changeRequestsTable.$inferSelect>(
    async (tx) => {
      const [updated] = await tx.update(changeRequestsTable)
        .set({ status: "SENT", updatedAt: new Date() })
        .where(eq(changeRequestsTable.id, req.params.id))
        .returning();
      return updated;
    },
    {
      organizationId: row.projects.organizationId,
      userId: user.id,
      userEmail: user.email,
      action: "CR_SENT",
      resourceType: "change_request",
      resourceId: String(req.params.id),
      resourceLabel: String(row.change_requests.title),
      ipAddress: String(req.ip ?? "").split(",")[0].trim() || undefined,
      before: beforeSnapshot,
      after: { ...beforeSnapshot, status: "SENT" },
    },
  );

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
        const bulkTransition = validateStateTransition(row.change_requests.status, "SENT", user.role);
        if (!bulkTransition.allowed) {
          results.push({ id, ok: false, error: bulkTransition.errorMessage ?? `Cannot send a ${row.change_requests.status} CO` });
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
