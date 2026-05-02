/**
 * diff.ts — Field-level object diff for ScopeGuard audit trail
 *
 * Generates minimal, human-readable diffs between two object snapshots.
 * Only changed fields are recorded — no full snapshots.
 * Output is JSON-serializable and frontend-renderable.
 *
 * Complexity: O(n) where n = number of keys in the new object.
 * Safe for objects with up to ~200 fields.
 */

export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  fieldType: "string" | "number" | "boolean" | "date" | "array" | "object" | "null" | "unknown";
  changedAt: string;
}

const DEFAULT_EXCLUDE_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "organizationId",
  "passwordHash",
  "approvalToken",
  "clientSignature",
]);

/**
 * Normalize a value for comparison and JSON-safe serialization.
 * Dates → ISO string, undefined → null, all others pass through.
 */
function normalizeValue(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  return value;
}

/**
 * Infer a display-friendly type label from a normalized value.
 */
function inferFieldType(value: unknown): FieldChange["fieldType"] {
  if (value === null) return "null";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return "date";
    return "string";
  }
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "unknown";
}

/**
 * Generate a field-level diff between two plain object snapshots.
 *
 * @param oldObj          Previous state (pass null for creation events)
 * @param newObj          Current state (required)
 * @param excludeFields   Additional field names to skip (merged with defaults)
 * @returns               Array of FieldChange records, sorted by field name
 *
 * @example
 * objectDiff({ status: "DRAFT", title: "Foo" }, { status: "SENT", title: "Foo" })
 * // → [{ field: "status", old: "DRAFT", new: "SENT", fieldType: "string", changedAt: "..." }]
 *
 * objectDiff(null, { title: "New CO", estimatedHours: 8 })
 * // → [{ field: "estimatedHours", old: null, new: 8, ... }, { field: "title", old: null, new: "New CO", ... }]
 */
export function objectDiff(
  oldObj: Record<string, unknown> | null,
  newObj: Record<string, unknown>,
  excludeFields?: string[],
): FieldChange[] {
  const excluded = new Set([
    ...DEFAULT_EXCLUDE_FIELDS,
    ...(excludeFields ?? []),
  ]);

  const changedAt = new Date().toISOString();
  const changes: FieldChange[] = [];

  for (const field of Object.keys(newObj)) {
    if (excluded.has(field) || field.startsWith("_")) continue;

    const newRaw = newObj[field];
    const oldRaw = oldObj?.[field] ?? null;

    const newNorm = normalizeValue(newRaw);
    const oldNorm = normalizeValue(oldRaw);

    const newStr = JSON.stringify(newNorm);
    const oldStr = JSON.stringify(oldNorm);

    if (newStr !== oldStr) {
      changes.push({
        field,
        oldValue: oldNorm,
        newValue: newNorm,
        fieldType: inferFieldType(newNorm ?? oldNorm),
        changedAt,
      });
    }
  }

  return changes.sort((a, b) => a.field.localeCompare(b.field));
}

/**
 * Convert a Drizzle model row to a plain object suitable for diffing.
 * Strips prototype methods and converts Dates to ISO strings.
 */
export function toAuditSnapshot(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    result[k] = normalizeValue(v);
  }
  return result;
}
