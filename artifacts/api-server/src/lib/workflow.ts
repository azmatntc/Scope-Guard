/**
 * workflow.ts — Change order state machine for ScopeGuard
 *
 * Enforces valid status transitions and RBAC rules at the API layer.
 * Invalid transitions are blocked before any DB write occurs.
 *
 * State diagram:
 *   DRAFT → SENT → { APPROVED, REJECTED, REVISED }
 *                        ↓              ↓
 *                    [terminal]      DRAFT, SENT
 *                  REVISED → SENT, DRAFT
 */

export type CRStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "REVISED";
export type UserRole = "ADMIN" | "PROJECT_MANAGER" | "FINANCE_VIEWER";

export type TransitionErrorCode =
  | "INVALID_TRANSITION"
  | "INSUFFICIENT_PERMISSIONS"
  | "TERMINAL_STATE"
  | "UNKNOWN_STATUS";

export interface TransitionResult {
  allowed: boolean;
  errorCode?: TransitionErrorCode;
  errorMessage?: string;
}

interface TransitionRule {
  allowedTargets: CRStatus[];
  /** Roles that may trigger this transition (empty = client-token or any authenticated user) */
  requiredRoles: UserRole[];
  /** If true, the transition may also be triggered by an unauthenticated client token */
  allowClientToken: boolean;
}

const TRANSITION_RULES: Record<CRStatus, TransitionRule> = {
  DRAFT: {
    allowedTargets: ["SENT"],
    requiredRoles: ["ADMIN", "PROJECT_MANAGER"],
    allowClientToken: false,
  },
  SENT: {
    allowedTargets: ["APPROVED", "REJECTED", "REVISED"],
    requiredRoles: [],
    allowClientToken: true,
  },
  REVISED: {
    allowedTargets: ["SENT", "DRAFT"],
    requiredRoles: ["ADMIN", "PROJECT_MANAGER"],
    allowClientToken: false,
  },
  APPROVED: {
    allowedTargets: [],
    requiredRoles: [],
    allowClientToken: false,
  },
  REJECTED: {
    allowedTargets: ["DRAFT", "REVISED"],
    requiredRoles: ["ADMIN", "PROJECT_MANAGER"],
    allowClientToken: false,
  },
};

/**
 * Validate whether a status transition is permitted.
 *
 * @param currentStatus  Current status of the change request
 * @param targetStatus   Desired new status
 * @param userRole       Role of the acting user (omit for client-token requests)
 * @param isClientToken  True if request comes from a client approval link
 * @returns              TransitionResult with allowed flag and error details
 *
 * @example
 * validateStateTransition("DRAFT", "SENT", "PROJECT_MANAGER")
 * // → { allowed: true }
 *
 * validateStateTransition("APPROVED", "SENT", "ADMIN")
 * // → { allowed: false, errorCode: "TERMINAL_STATE", errorMessage: "..." }
 */
export function validateStateTransition(
  currentStatus: string,
  targetStatus: string,
  userRole?: UserRole,
  isClientToken = false,
): TransitionResult {
  const rule = TRANSITION_RULES[currentStatus as CRStatus];

  if (!rule) {
    return {
      allowed: false,
      errorCode: "UNKNOWN_STATUS",
      errorMessage: `Unknown status: "${currentStatus}". Cannot determine valid transitions.`,
    };
  }

  if (rule.allowedTargets.length === 0) {
    return {
      allowed: false,
      errorCode: "TERMINAL_STATE",
      errorMessage: `Change orders in "${currentStatus}" status cannot be transitioned further.`,
    };
  }

  if (!rule.allowedTargets.includes(targetStatus as CRStatus)) {
    return {
      allowed: false,
      errorCode: "INVALID_TRANSITION",
      errorMessage: `Cannot transition from "${currentStatus}" to "${targetStatus}". Allowed: ${rule.allowedTargets.join(", ")}.`,
    };
  }

  if (rule.requiredRoles.length > 0 && !isClientToken) {
    if (!userRole || !rule.requiredRoles.includes(userRole)) {
      return {
        allowed: false,
        errorCode: "INSUFFICIENT_PERMISSIONS",
        errorMessage: `Role "${userRole ?? "none"}" cannot transition from "${currentStatus}" to "${targetStatus}". Required: ${rule.requiredRoles.join(" or ")}.`,
      };
    }
  }

  if (!isClientToken && rule.allowClientToken && rule.requiredRoles.length === 0) {
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Get all valid target statuses for a given current status and role.
 * Useful for building UI affordances (e.g., which buttons to show).
 */
export function getAllowedTransitions(
  currentStatus: string,
  userRole?: UserRole,
  isClientToken = false,
): CRStatus[] {
  const rule = TRANSITION_RULES[currentStatus as CRStatus];
  if (!rule) return [];
  return rule.allowedTargets.filter((target) =>
    validateStateTransition(currentStatus, target, userRole, isClientToken).allowed,
  );
}
