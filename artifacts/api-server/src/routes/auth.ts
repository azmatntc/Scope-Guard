import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { organizationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createHash, timingSafeEqual } from "crypto";
import { authRateLimit } from "../middlewares/rateLimiter";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return createHash("sha256").update(password + process.env.SESSION_SECRET).digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  const inputHash = hashPassword(password);
  return timingSafeEqual(Buffer.from(inputHash), Buffer.from(hash));
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

const registerSchema = z.object({
  organizationName: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/auth/register", authRateLimit, async (req: any, res: any) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const { organizationName, name, email, password } = parsed.data;

  const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (existingUser.length > 0) {
    return res.status(409).json({ error: { code: "EMAIL_EXISTS", message: "Email already in use" } });
  }

  const baseSlug = slugify(organizationName);
  let slug = baseSlug;
  let attempt = 0;
  while (true) {
    const existing = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, slug)).limit(1);
    if (existing.length === 0) break;
    attempt++;
    slug = `${baseSlug}-${attempt}`;
  }

  const [org] = await db.insert(organizationsTable).values({
    name: organizationName,
    slug,
  }).returning();

  const [user] = await db.insert(usersTable).values({
    organizationId: org.id,
    name,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    role: "ADMIN",
  }).returning();

  (req.session as any).userId = user.id;

  return res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId, createdAt: user.createdAt },
    organization: { id: org.id, name: org.name, slug: org.slug, logoUrl: org.logoUrl, primaryColor: org.primaryColor, createdAt: org.createdAt },
  });
});

router.post("/auth/login", authRateLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
  }

  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, user.organizationId)).limit(1);

  (req.session as any).userId = user.id;

  return res.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId, createdAt: user.createdAt },
    organization: { id: org.id, name: org.name, slug: org.slug, logoUrl: org.logoUrl, primaryColor: org.primaryColor, createdAt: org.createdAt },
  });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ message: "Logged out" });
});

router.get("/auth/me", async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Session expired" } });
  }

  return res.json({ id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId, createdAt: user.createdAt });
});

export default router;
