import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { webhooksTable, webhookDeliveriesTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { randomBytes } from "crypto";
import { signWebhookPayload, verifyWebhookSignature } from "../lib/webhookSigning";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const VALID_EVENTS = [
  "change_request.approved",
  "change_request.rejected",
  "change_request.sent",
  "change_request.revised",
  "project.completed",
];

const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).min(1).optional(),
  isActive: z.boolean().optional(),
});

router.get("/webhooks", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const hooks = await db.select().from(webhooksTable)
    .where(eq(webhooksTable.organizationId, user.organizationId))
    .orderBy(desc(webhooksTable.createdAt));
  return res.json(hooks.map((h) => ({ ...h, secret: undefined })));
});

router.post("/webhooks", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }
  const validEvents = parsed.data.events.filter((e) => VALID_EVENTS.includes(e));
  const secret = randomBytes(32).toString("hex");
  const [hook] = await db.insert(webhooksTable).values({
    organizationId: user.organizationId,
    name: parsed.data.name,
    url: parsed.data.url,
    events: validEvents,
    secret,
  }).returning();
  return res.status(201).json({ ...hook });
});

router.patch("/webhooks/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }
  const updates: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.url !== undefined) updates.url = parsed.data.url;
  if (parsed.data.events !== undefined) updates.events = parsed.data.events.filter((e) => VALID_EVENTS.includes(e));
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const [hook] = await db.update(webhooksTable).set(updates)
    .where(and(eq(webhooksTable.id, req.params.id), eq(webhooksTable.organizationId, user.organizationId)))
    .returning();
  if (!hook) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Webhook not found" } });
  return res.json({ ...hook, secret: undefined });
});

router.delete("/webhooks/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db.delete(webhooksTable)
    .where(and(eq(webhooksTable.id, req.params.id), eq(webhooksTable.organizationId, user.organizationId)));
  return res.status(204).send();
});

router.get("/webhooks/:id/deliveries", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [hook] = await db.select().from(webhooksTable)
    .where(and(eq(webhooksTable.id, req.params.id), eq(webhooksTable.organizationId, user.organizationId)))
    .limit(1);
  if (!hook) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Webhook not found" } });
  const deliveries = await db.select().from(webhookDeliveriesTable)
    .where(eq(webhookDeliveriesTable.webhookId, req.params.id))
    .orderBy(desc(webhookDeliveriesTable.createdAt))
    .limit(50);
  return res.json(deliveries);
});

router.post("/webhooks/:id/test", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [hook] = await db.select().from(webhooksTable)
    .where(and(eq(webhooksTable.id, req.params.id), eq(webhooksTable.organizationId, user.organizationId)))
    .limit(1);
  if (!hook) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Webhook not found" } });

  const payload = {
    event: "change_request.approved",
    timestamp: new Date().toISOString(),
    test: true,
    data: { id: "test-id", title: "Test Change Request", totalCents: 150000, status: "APPROVED" },
  };

  const result = await deliverWebhook(hook, "change_request.approved", payload);
  return res.json(result);
});

export async function fireWebhookEvent(organizationId: string, eventType: string, payload: Record<string, unknown>) {
  const hooks = await db.select().from(webhooksTable)
    .where(and(eq(webhooksTable.organizationId, organizationId), eq(webhooksTable.isActive, true)));

  for (const hook of hooks) {
    const events = hook.events as string[];
    if (events.includes(eventType)) {
      deliverWebhook(hook, eventType, payload).catch(() => {});
    }
  }
}

async function deliverWebhook(hook: typeof webhooksTable.$inferSelect, eventType: string, payload: Record<string, unknown>) {
  const fullPayload = { event: eventType, timestamp: new Date().toISOString(), ...payload };
  const body = JSON.stringify(fullPayload);
  const sig = signWebhookPayload(fullPayload, hook.secret);

  let responseStatus: number | null = null;
  let responseBody = "";
  let status: "SUCCESS" | "FAILED" = "FAILED";

  try {
    const resp = await fetch(hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ScopeGuard-Signature": sig,
        "X-ScopeGuard-Event": eventType,
        "User-Agent": "ScopeGuard-Webhook/1.0",
      },
      body,
      signal: AbortSignal.timeout(10000),
    });
    responseStatus = resp.status;
    responseBody = (await resp.text()).slice(0, 1000);
    status = resp.ok ? "SUCCESS" : "FAILED";
  } catch (e: any) {
    responseBody = e?.message ?? "Network error";
  }

  await db.insert(webhookDeliveriesTable).values({
    webhookId: hook.id,
    eventType,
    payload: payload as any,
    responseStatus,
    responseBody,
    status,
    deliveredAt: new Date(),
  });

  return { status, responseStatus, responseBody };
}

export default router;
