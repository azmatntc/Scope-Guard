import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { remindersTable, changeRequestsTable, projectsTable, clientContactsTable } from "@workspace/db";
import { and, eq, lte, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const createSchema = z.object({
  changeRequestId: z.string().uuid(),
  delayHours: z.number().int().min(1).max(720),
  message: z.string().max(1000).optional().default(""),
});

router.get("/reminders", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const rows = await db.select().from(remindersTable)
    .innerJoin(changeRequestsTable, eq(remindersTable.changeRequestId, changeRequestsTable.id))
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .where(and(eq(remindersTable.organizationId, user.organizationId)))
    .orderBy(desc(remindersTable.scheduledFor))
    .limit(100);

  return res.json(rows.map((r) => ({
    ...r.reminders,
    changeRequestTitle: r.change_requests.title,
    projectName: r.projects.name,
  })));
});

router.post("/reminders", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const [crRow] = await db.select().from(changeRequestsTable)
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .where(and(eq(changeRequestsTable.id, parsed.data.changeRequestId), eq(projectsTable.organizationId, user.organizationId)))
    .limit(1);

  if (!crRow) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Change request not found" } });

  const scheduledFor = new Date(Date.now() + parsed.data.delayHours * 3600 * 1000);

  const [reminder] = await db.insert(remindersTable).values({
    organizationId: user.organizationId,
    changeRequestId: parsed.data.changeRequestId,
    delayHours: parsed.data.delayHours,
    message: parsed.data.message ?? "",
    scheduledFor,
  }).returning();

  return res.status(201).json(reminder);
});

router.delete("/reminders/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [deleted] = await db.delete(remindersTable)
    .where(and(eq(remindersTable.id, req.params.id), eq(remindersTable.organizationId, user.organizationId)))
    .returning();
  if (!deleted) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Reminder not found" } });
  return res.status(204).send();
});

router.post("/reminders/process", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const due = await db.select().from(remindersTable)
    .innerJoin(changeRequestsTable, eq(remindersTable.changeRequestId, changeRequestsTable.id))
    .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
    .innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id))
    .where(and(
      eq(remindersTable.organizationId, user.organizationId),
      eq(remindersTable.status, "PENDING"),
      lte(remindersTable.scheduledFor, new Date()),
    ));

  let processed = 0;
  for (const row of due) {
    await db.update(remindersTable)
      .set({ status: "SENT", sentAt: new Date() })
      .where(eq(remindersTable.id, row.reminders.id));
    processed++;
  }

  return res.json({ processed });
});

export default router;
