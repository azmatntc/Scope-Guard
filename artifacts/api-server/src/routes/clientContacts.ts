import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { clientContactsTable } from "@workspace/db";
import { and, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  company: z.string().optional().default(""),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
});

router.get("/client-contacts", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const search = req.query.search as string | undefined;

  let query = db.select().from(clientContactsTable).where(eq(clientContactsTable.organizationId, user.organizationId));

  const contacts = await db.select().from(clientContactsTable).where(
    and(
      eq(clientContactsTable.organizationId, user.organizationId),
      search ? or(ilike(clientContactsTable.name, `%${search}%`), ilike(clientContactsTable.email, `%${search}%`), ilike(clientContactsTable.company, `%${search}%`)) : undefined,
    )
  ).orderBy(clientContactsTable.name);

  return res.json(contacts.map(c => ({ id: c.id, name: c.name, email: c.email, company: c.company, organizationId: c.organizationId, createdAt: c.createdAt })));
});

router.post("/client-contacts", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const existing = await db.select().from(clientContactsTable).where(
    and(eq(clientContactsTable.organizationId, user.organizationId), eq(clientContactsTable.email, parsed.data.email.toLowerCase()))
  ).limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: { code: "EMAIL_EXISTS", message: "Client with this email already exists" } });
  }

  const [contact] = await db.insert(clientContactsTable).values({
    organizationId: user.organizationId,
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    company: parsed.data.company || "",
  }).returning();

  return res.status(201).json({ id: contact.id, name: contact.name, email: contact.email, company: contact.company, organizationId: contact.organizationId, createdAt: contact.createdAt });
});

router.get("/client-contacts/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [contact] = await db.select().from(clientContactsTable).where(
    and(eq(clientContactsTable.id, req.params.id), eq(clientContactsTable.organizationId, user.organizationId))
  ).limit(1);
  if (!contact) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Contact not found" } });
  return res.json({ id: contact.id, name: contact.name, email: contact.email, company: contact.company, organizationId: contact.organizationId, createdAt: contact.createdAt });
});

router.patch("/client-contacts/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const [existing] = await db.select().from(clientContactsTable).where(
    and(eq(clientContactsTable.id, req.params.id), eq(clientContactsTable.organizationId, user.organizationId))
  ).limit(1);
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Contact not found" } });

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.email) updates.email = parsed.data.email.toLowerCase();
  if (parsed.data.company !== undefined) updates.company = parsed.data.company;

  const [contact] = await db.update(clientContactsTable).set(updates).where(eq(clientContactsTable.id, req.params.id)).returning();
  return res.json({ id: contact.id, name: contact.name, email: contact.email, company: contact.company, organizationId: contact.organizationId, createdAt: contact.createdAt });
});

router.delete("/client-contacts/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [existing] = await db.select().from(clientContactsTable).where(
    and(eq(clientContactsTable.id, req.params.id), eq(clientContactsTable.organizationId, user.organizationId))
  ).limit(1);
  if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Contact not found" } });
  await db.delete(clientContactsTable).where(eq(clientContactsTable.id, req.params.id));
  return res.status(204).send();
});

export default router;
