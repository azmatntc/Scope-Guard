import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().nullable().optional(),
  primaryColor: z.string().nullable().optional(),
});

router.get("/organizations/me", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, user.organizationId)).limit(1);
  if (!org) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Organization not found" } });
  return res.json({ id: org.id, name: org.name, slug: org.slug, logoUrl: org.logoUrl, primaryColor: org.primaryColor, createdAt: org.createdAt });
});

router.patch("/organizations/me", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = updateOrgSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.logoUrl !== undefined) updates.logoUrl = parsed.data.logoUrl;
  if (parsed.data.primaryColor !== undefined) updates.primaryColor = parsed.data.primaryColor;

  const [org] = await db.update(organizationsTable).set(updates).where(eq(organizationsTable.id, user.organizationId)).returning();
  return res.json({ id: org.id, name: org.name, slug: org.slug, logoUrl: org.logoUrl, primaryColor: org.primaryColor, createdAt: org.createdAt });
});

export default router;
