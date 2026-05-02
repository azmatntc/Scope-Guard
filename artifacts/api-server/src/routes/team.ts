import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, teamInvitesTable, organizationsTable } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";
import { writeAuditLog } from "./auditLogs";

const router: IRouter = Router();

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]),
});

const updateRoleSchema = z.object({
  role: z.enum(["ADMIN", "PROJECT_MANAGER", "FINANCE_VIEWER"]),
});

function requireAdmin(req: any, res: any, next: any) {
  if ((req as any).user?.role !== "ADMIN") {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin access required" } });
  }
  next();
}

router.get("/team/members", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const members = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.organizationId, user.organizationId));
  return res.json(members);
});

router.get("/team/invites", requireAuth, requireAdmin, async (req, res) => {
  const user = (req as any).user;
  const invites = await db.select().from(teamInvitesTable)
    .where(and(eq(teamInvitesTable.organizationId, user.organizationId), eq(teamInvitesTable.status, "PENDING")));
  return res.json(invites);
});

router.post("/team/invites", requireAuth, requireAdmin, async (req, res) => {
  const user = (req as any).user;
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const existing = await db.select().from(usersTable)
    .where(and(eq(usersTable.email, parsed.data.email.toLowerCase()), eq(usersTable.organizationId, user.organizationId)))
    .limit(1);
  if (existing.length > 0) {
    return res.status(409).json({ error: { code: "ALREADY_MEMBER", message: "User is already a team member" } });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const [invite] = await db.insert(teamInvitesTable).values({
    organizationId: user.organizationId,
    invitedByUserId: user.id,
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    expiresAt,
  }).returning();

  await writeAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    userEmail: user.email,
    action: "MEMBER_INVITED",
    resourceType: "team_invite",
    resourceId: invite.id,
    resourceLabel: parsed.data.email,
  });

  return res.status(201).json(invite);
});

router.delete("/team/invites/:id", requireAuth, requireAdmin, async (req, res) => {
  const user = (req as any).user;
  await db.delete(teamInvitesTable)
    .where(and(eq(teamInvitesTable.id, req.params.id), eq(teamInvitesTable.organizationId, user.organizationId)));
  return res.status(204).send();
});

router.patch("/team/members/:id/role", requireAuth, requireAdmin, async (req, res) => {
  const user = (req as any).user;
  if (req.params.id === user.id) {
    return res.status(400).json({ error: { code: "INVALID_OPERATION", message: "Cannot change your own role" } });
  }
  const parsed = updateRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }

  const [member] = await db.update(usersTable)
    .set({ role: parsed.data.role as any, updatedAt: new Date() })
    .where(and(eq(usersTable.id, req.params.id), eq(usersTable.organizationId, user.organizationId)))
    .returning();

  if (!member) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Member not found" } });

  await writeAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    userEmail: user.email,
    action: "MEMBER_ROLE_CHANGED",
    resourceType: "user",
    resourceId: member.id,
    resourceLabel: member.email,
    fieldChanges: [{ field: "role", oldValue: member.role, newValue: parsed.data.role }],
  });

  return res.json({ id: member.id, name: member.name, email: member.email, role: member.role });
});

router.delete("/team/members/:id", requireAuth, requireAdmin, async (req, res) => {
  const user = (req as any).user;
  if (req.params.id === user.id) {
    return res.status(400).json({ error: { code: "INVALID_OPERATION", message: "Cannot remove yourself" } });
  }

  const [removed] = await db.delete(usersTable)
    .where(and(eq(usersTable.id, req.params.id), eq(usersTable.organizationId, user.organizationId)))
    .returning();

  if (!removed) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Member not found" } });

  await writeAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    userEmail: user.email,
    action: "MEMBER_REMOVED",
    resourceType: "user",
    resourceId: removed.id,
    resourceLabel: removed.email,
  });

  return res.status(204).send();
});

export default router;
