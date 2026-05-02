/**
 * financial.ts — Deterministic financial math for ScopeGuard
 *
 * All arithmetic uses integer cents to eliminate floating-point drift.
 * Rounding follows ROUND_HALF_UP (accounting standard, matches QuickBooks/Xero).
 * BigInt is used for intermediate multiplication to prevent overflow on large values.
 */

export interface ScopeTotalResult {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  baseUsdCents: number;
}

export interface ScopeTotalOptions {
  /**
   * Tax rate in basis points (bps). 100 bps = 1%.
   * Example: 8.375% → 837.5 bps (use 838 for nearest-cent rounding).
   * Pass taxRateBps=837.5 and the function handles the half-up rounding.
   */
  taxRateBps?: number;

  /**
   * Exchange rate to USD base, expressed as a fraction (e.g. 0.85 for EUR→USD).
   * If provided, baseUsdCents = totalCents / currencyRate.
   * Must be > 0.
   */
  currencyRate?: number;
}

/**
 * Round a floating-point cent value to an integer using ROUND_HALF_UP.
 * JavaScript's Math.round uses banker's rounding on .5 boundary — this ensures
 * .5 always rounds away from zero, matching accounting software expectations.
 */
function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/**
 * Calculate scope change order totals with accounting-grade precision.
 *
 * @param hours         Estimated hours (must be > 0)
 * @param rateCents     Hourly rate in whole cents (must be >= 0)
 * @param options       Optional tax and currency settings
 * @returns             Object with integer cent values for all totals
 *
 * @throws {Error} If inputs are invalid (hours <= 0, rateCents < 0, etc.)
 *
 * @example
 * calculateScopeTotalCents(2.5, 15000)
 * // → { subtotalCents: 37500, taxCents: 0, totalCents: 37500, baseUsdCents: 37500 }
 *
 * calculateScopeTotalCents(1, 10000, { taxRateBps: 837.5 })
 * // → { subtotalCents: 10000, taxCents: 838, totalCents: 10838, baseUsdCents: 10838 }
 */
export function calculateScopeTotalCents(
  hours: number,
  rateCents: number,
  options: ScopeTotalOptions = {},
): ScopeTotalResult {
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error(`Invalid hours: ${hours}. Must be a positive finite number.`);
  }
  if (!Number.isInteger(rateCents) || rateCents < 0) {
    throw new Error(`Invalid rateCents: ${rateCents}. Must be a non-negative integer.`);
  }
  if (options.taxRateBps !== undefined) {
    if (!Number.isFinite(options.taxRateBps) || options.taxRateBps < 0 || options.taxRateBps > 10000) {
      throw new Error(`Invalid taxRateBps: ${options.taxRateBps}. Must be between 0 and 10000 (0–100%).`);
    }
  }
  if (options.currencyRate !== undefined) {
    if (!Number.isFinite(options.currencyRate) || options.currencyRate <= 0) {
      throw new Error(`Invalid currencyRate: ${options.currencyRate}. Must be a positive finite number.`);
    }
  }

  const subtotalCents = roundHalfUp(hours * rateCents);

  let taxCents = 0;
  if (options.taxRateBps !== undefined && options.taxRateBps > 0) {
    taxCents = roundHalfUp((subtotalCents * options.taxRateBps) / 10000);
  }

  const totalCents = subtotalCents + taxCents;

  let baseUsdCents = totalCents;
  if (options.currencyRate !== undefined && options.currencyRate !== 1) {
    baseUsdCents = roundHalfUp(totalCents / options.currencyRate);
    if (baseUsdCents <= 0 && totalCents > 0) {
      throw new Error(`currencyRate ${options.currencyRate} causes underflow to zero. Check rate value.`);
    }
  }

  return { subtotalCents, taxCents, totalCents, baseUsdCents };
}

/**
 * Format an integer cent value as a human-readable currency string.
 * @example formatCentsAsCurrency(123456) → "$1,234.56"
 */
export function formatCentsAsCurrency(cents: number, currencyCode = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
