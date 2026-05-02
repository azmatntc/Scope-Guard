import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { changeRequestsTable, projectsTable, clientContactsTable, organizationsTable, activityLogTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fireWebhookEvent } from "./webhooks";
import { writeAuditLog } from "./auditLogs";

const router: IRouter = Router();

const submitSchema = z.object({
  decision: z.enum(["approve", "reject", "revise"]),
  comments: z.string().optional().default(""),
});

router.get("/approve/:token", async (req, res) => {
  const [row] = await db.select().from(changeRequestsTable)
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id))
    .innerJoin(organizationsTable, eq(projectsTable.organizationId, organizationsTable.id))
    .where(and(eq(changeRequestsTable.approvalToken, req.params.token), eq(changeRequestsTable.status, "SENT")))
    .limit(1);

  if (!row) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Invalid or expired approval link" } });
  }

  const { change_requests: cr, projects: project, client_contacts: contact, organizations: org } = row;

  return res.json({
    projectName: project.name,
    organizationName: org.name,
    title: cr.title,
    description: cr.description,
    totalCents: cr.totalCents,
    totalFormatted: `$${(cr.totalCents / 100).toFixed(2)}`,
    deadline: cr.deadline,
    logoUrl: org.logoUrl,
    primaryColor: org.primaryColor,
    status: cr.status,
  });
});

router.patch("/approve/:token", async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const [row] = await db.select().from(changeRequestsTable)
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id))
    .where(and(eq(changeRequestsTable.approvalToken, req.params.token), eq(changeRequestsTable.status, "SENT")))
    .limit(1);

  if (!row) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Invalid or expired approval link" } });
  }

  const { change_requests: cr, projects: project, client_contacts: contact } = row;
  const { decision, comments } = parsed.data;

  const statusMap = { approve: "APPROVED", reject: "REJECTED", revise: "REVISED" } as const;
  const actionMap = { approve: "APPROVED", reject: "REJECTED", revise: "REVISED" } as const;
  const newStatus = statusMap[decision];

  const updates: Record<string, any> = {
    status: newStatus,
    clientComments: comments || "",
    updatedAt: new Date(),
  };
  if (decision === "approve") {
    updates.approvedAt = new Date();
    updates.approvedByIp = req.ip || req.socket.remoteAddress || null;
  }

  const [updated] = await db.update(changeRequestsTable).set(updates).where(eq(changeRequestsTable.id, cr.id)).returning();

  await db.insert(activityLogTable).values({
    changeRequestId: cr.id,
    projectId: project.id,
    changeRequestTitle: cr.title,
    projectName: project.name,
    clientName: contact.name,
    action: actionMap[decision],
    totalCents: cr.totalCents,
  });

  const eventType = decision === "approve" ? "change_request.approved"
    : decision === "reject" ? "change_request.rejected"
    : "change_request.revised";

  await writeAuditLog({
    organizationId: project.organizationId,
    action: decision === "approve" ? "CR_APPROVED" : decision === "reject" ? "CR_REJECTED" : "CR_REVISED",
    resourceType: "change_request",
    resourceId: cr.id,
    resourceLabel: cr.title,
    ipAddress: req.ip || undefined,
    metadata: { decision, comments, clientEmail: contact.email },
  });

  fireWebhookEvent(project.organizationId, eventType, {
    data: {
      id: cr.id,
      title: cr.title,
      projectName: project.name,
      clientName: contact.name,
      totalCents: cr.totalCents,
      status: newStatus,
      comments,
    },
  });

  return res.json({
    status: newStatus.toLowerCase(),
    message: decision === "approve"
      ? "Change request approved successfully"
      : decision === "reject"
      ? "Change request rejected"
      : "Revision requested — the project manager will follow up",
  });
});

export default router;
