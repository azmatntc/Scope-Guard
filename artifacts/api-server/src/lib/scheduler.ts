import { db } from "@workspace/db";
import { remindersTable, changeRequestsTable, projectsTable, webhookDeliveriesTable, webhooksTable, clientContactsTable } from "@workspace/db";
import { and, eq, lte, lt, desc } from "drizzle-orm";
import { logger } from "./logger";
import { writeNotificationForOrg } from "../routes/notifications";
import { createHmac } from "crypto";

let schedulerStarted = false;

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  logger.info("Background scheduler started");

  setInterval(processReminders, 60_000);
  setInterval(retryFailedWebhooks, 5 * 60_000);
}

async function processReminders() {
  try {
    const due = await db.select().from(remindersTable)
      .innerJoin(changeRequestsTable, eq(remindersTable.changeRequestId, changeRequestsTable.id))
      .innerJoin(projectsTable, eq(changeRequestsTable.projectId, projectsTable.id))
      .innerJoin(clientContactsTable, eq(projectsTable.clientContactId, clientContactsTable.id))
      .where(and(
        eq(remindersTable.status, "PENDING"),
        lte(remindersTable.scheduledFor, new Date()),
      ))
      .limit(50);

    for (const row of due) {
      await db.update(remindersTable)
        .set({ status: "SENT", sentAt: new Date() })
        .where(eq(remindersTable.id, row.reminders.id));

      await writeNotificationForOrg({
        organizationId: row.reminders.organizationId,
        type: "REMINDER_DUE",
        title: `Reminder: "${row.change_requests.title}" still awaiting approval`,
        body: `${row.client_contacts.name} has not yet responded. The change order has been pending for ${row.reminders.delayHours}h.`,
        resourceType: "change_request",
        resourceId: row.change_requests.id,
        resourceLabel: row.change_requests.title,
      });

      logger.info({ reminderId: row.reminders.id, cr: row.change_requests.title }, "Reminder processed");
    }

    if (due.length > 0) {
      logger.info({ count: due.length }, "Reminders processed");
    }
  } catch (err) {
    logger.error({ err }, "Error processing reminders");
  }
}

async function retryFailedWebhooks() {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const failed = await db.select().from(webhookDeliveriesTable)
      .innerJoin(webhooksTable, eq(webhookDeliveriesTable.webhookId, webhooksTable.id))
      .where(and(
        eq(webhookDeliveriesTable.status, "FAILED"),
        lte(webhookDeliveriesTable.createdAt, twoHoursAgo),
        eq(webhooksTable.isActive, true),
      ))
      .orderBy(desc(webhookDeliveriesTable.createdAt))
      .limit(10);

    for (const row of failed) {
      const hook = row.webhooks;
      const delivery = row.webhook_deliveries;
      const payload = delivery.payload as Record<string, unknown>;
      const body = JSON.stringify({ event: delivery.eventType, timestamp: new Date().toISOString(), ...payload, _retry: true });
      const sig = createHmac("sha256", hook.secret).update(body).digest("hex");

      let responseStatus: number | null = null;
      let responseBody = "";
      let status: "SUCCESS" | "FAILED" = "FAILED";

      try {
        const resp = await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-ScopeGuard-Signature": `sha256=${sig}`,
            "X-ScopeGuard-Event": delivery.eventType,
            "User-Agent": "ScopeGuard-Webhook/1.0",
          },
          body,
          signal: AbortSignal.timeout(8000),
        });
        responseStatus = resp.status;
        responseBody = (await resp.text()).slice(0, 500);
        status = resp.ok ? "SUCCESS" : "FAILED";
      } catch (e: any) {
        responseBody = `retry-error: ${e?.message}`;
      }

      await db.update(webhookDeliveriesTable)
        .set({ status, responseStatus, responseBody, deliveredAt: new Date() })
        .where(eq(webhookDeliveriesTable.id, delivery.id));
    }

    if (failed.length > 0) {
      logger.info({ count: failed.length }, "Webhook retries attempted");
    }
  } catch (err) {
    logger.error({ err }, "Error retrying webhooks");
  }
}
