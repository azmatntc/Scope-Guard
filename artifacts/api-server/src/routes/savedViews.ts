import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { savedViewsTable } from "@workspace/db";
import { and, eq, or, desc } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  searchQuery: z.string().optional().default(""),
  filterJson: z.record(z.unknown()).optional().default({}),
  sortField: z.string().optional().default("createdAt"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  isShared: z.boolean().optional().default(false),
});

router.get("/saved-views", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const views = await db.select().from(savedViewsTable)
    .where(and(
      eq(savedViewsTable.organizationId, user.organizationId),
      or(eq(savedViewsTable.userId, user.id), eq(savedViewsTable.isShared, true)),
    ))
    .orderBy(desc(savedViewsTable.updatedAt));
  return res.json(views);
});

router.post("/saved-views", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const [view] = await db.insert(savedViewsTable).values({
    organizationId: user.organizationId,
    userId: user.id,
    ...parsed.data,
  }).returning();

  return res.status(201).json(view);
});

router.patch("/saved-views/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const parsed = createSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const [view] = await db.update(savedViewsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(savedViewsTable.id, req.params.id), eq(savedViewsTable.userId, user.id)))
    .returning();

  if (!view) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Saved view not found" } });
  return res.json(view);
});

router.delete("/saved-views/:id", requireAuth, async (req, res) => {
  const user = (req as any).user;
  await db.delete(savedViewsTable)
    .where(and(eq(savedViewsTable.id, req.params.id), eq(savedViewsTable.userId, user.id)));
  return res.status(204).send();
});

export default router;
