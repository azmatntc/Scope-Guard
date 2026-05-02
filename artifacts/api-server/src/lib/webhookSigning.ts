/**
 * webhookSigning.ts — HMAC-SHA256 webhook signing for ScopeGuard
 *
 * Signature format matches Stripe's standard for broad ecosystem compatibility:
 *   "t={unix_timestamp},v1={hex_hmac_sha256}"
 *
 * Security properties:
 * ✅ HMAC-SHA256 — tamper detection
 * ✅ Timestamp — replay attack prevention (default 5-min window)
 * ✅ Constant-time compare — timing attack prevention
 * ✅ Sorted-key JSON — deterministic payload serialization
 * ✅ Raw-body support — verify against the exact bytes received
 */

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Sign a webhook payload with HMAC-SHA256 + timestamp.
 *
 * @param payload    Object to sign (sorted-key JSON serialized) or pre-serialized string
 * @param secret     Signing secret (from env, never hardcoded)
 * @param timestamp  Unix seconds (defaults to Date.now()/1000)
 * @returns          Signature header string: "t=1714752000,v1=abc123..."
 *
 * @example
 * const sig = signWebhookPayload({ event: "change_request.approved", id: "cr-1" }, process.env.WEBHOOK_SECRET!);
 * // → "t=1714752000,v1=3a4b5c..."
 */
export function signWebhookPayload(
  payload: Record<string, unknown> | string,
  secret: string,
  timestamp?: number,
): string {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const payloadStr =
    typeof payload === "string"
      ? payload
      : JSON.stringify(payload, Object.keys(payload).sort());
  const message = `${ts}.${payloadStr}`;
  const sig = createHmac("sha256", secret).update(message, "utf8").digest("hex");
  return `t=${ts},v1=${sig}`;
}

/**
 * Verify a ScopeGuard webhook signature.
 *
 * @param payload           Original payload (same as what was signed)
 * @param signatureHeader   Value of the X-ScopeGuard-Signature header
 * @param secret            Signing secret used to generate the signature
 * @param toleranceSeconds  Max acceptable timestamp age (default: 300s)
 * @returns                 true if valid and fresh, false otherwise
 *
 * @example
 * const valid = verifyWebhookSignature(req.body, req.headers["x-scopeguard-signature"], secret);
 * if (!valid) return res.status(401).json({ error: "Invalid signature" });
 */
export function verifyWebhookSignature(
  payload: Record<string, unknown> | string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300,
): boolean {
  try {
    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(",")) {
      const idx = part.indexOf("=");
      if (idx === -1) return false;
      parts[part.slice(0, idx)] = part.slice(idx + 1);
    }

    if (!parts.t || !parts.v1) return false;

    const timestamp = parseInt(parts.t, 10);
    if (isNaN(timestamp)) return false;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

    const expectedFull = signWebhookPayload(payload, secret, timestamp);
    const expectedSig = expectedFull.split(",")[1]?.split("=")[1];
    if (!expectedSig) return false;

    return timingSafeEqual(
      Buffer.from(parts.v1, "hex"),
      Buffer.from(expectedSig, "hex"),
    );
  } catch {
    return false;
  }
}
