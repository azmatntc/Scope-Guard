/**
 * transaction.ts — Atomic DB mutations with guaranteed audit logging
 *
 * Wraps any DB mutation in a Drizzle transaction that includes the audit log write.
 * If either the mutation OR the audit log write fails, the entire transaction rolls back.
 * This eliminates the SOC 2 compliance risk of partial writes.
 *
 * Usage:
 *   const updated = await atomicWithAudit(
 *     async (tx) => {
 *       const [row] = await tx.update(changeRequestsTable)
 *         .set({ status: "SENT" }).where(eq(...)).returning();
 *       return row;
 *     },
 *     {
 *       organizationId: org.id,
 *       userId: user.id,
 *       userEmail: user.email,
 *       action: "CR_SENT",
 *       resourceType: "change_request",
 *       resourceId: cr.id,
 *       resourceLabel: cr.title,
 *       before: beforeSnapshot,
 *       after: afterSnapshot,
 *     }
 *   );
 */

import { db } from "@workspace/db";
import { auditLogTable } from "@workspace/db";
import type { AuditLog } from "@workspace/db";
import { objectDiff } from "./diff";

export interface AuditMeta {
  organizationId: string;
  userId?: string;
  userEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceLabel?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
  /** Pre-mutation snapshot for field-level diff */
  before?: Record<string, unknown> | null;
  /** Post-mutation snapshot for field-level diff */
  after?: Record<string, unknown>;
  /** Override field changes (skip auto-diff when provided) */
  fieldChanges?: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
  excludeDiffFields?: string[];
}

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Execute a DB mutation and audit log write atomically.
 * Both succeed or both roll back.
 *
 * @param mutationFn  Async function receiving a Drizzle transaction client
 * @param audit       Metadata for the audit log entry
 * @returns           Result returned by mutationFn
 *
 * @throws            Propagates any error from mutationFn or audit log write
 */
export async function atomicWithAudit<T>(
  mutationFn: (tx: DrizzleTx) => Promise<T>,
  audit: AuditMeta,
): Promise<T> {
  return db.transaction(async (tx) => {
    const result = await mutationFn(tx);

    const fieldChanges = audit.fieldChanges
      ?? (audit.before !== undefined || audit.after !== undefined
        ? objectDiff(
            audit.before ?? null,
            audit.after ?? {},
            audit.excludeDiffFields,
          )
        : []);

    await tx.insert(auditLogTable).values({
      organizationId: audit.organizationId,
      userId: audit.userId ?? null,
      userEmail: audit.userEmail ?? null,
      action: audit.action as typeof auditLogTable.$inferInsert["action"],
      resourceType: audit.resourceType,
      resourceId: audit.resourceId ?? null,
      resourceLabel: audit.resourceLabel ?? null,
      ipAddress: audit.ipAddress ?? null,
      metadata: {
        ...(audit.metadata ?? {}),
        _wroteAt: new Date().toISOString(),
        _transactionId: Math.random().toString(36).slice(2),
      },
      fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined,
    });

    return result;
  });
}
