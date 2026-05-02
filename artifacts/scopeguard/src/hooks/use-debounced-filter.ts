/**
 * use-debounced-filter.ts — Smart debounced filter hook with URL sync
 *
 * Features:
 * - Debounce rapid changes (300ms default) to prevent API spam
 * - Sync filter state to URL query params for bookmarkable/shareable views
 * - Immediate subscriber notification for responsive UI (URL sync is debounced)
 * - Works with wouter's useSearch/useLocation for SPA routing
 * - SSR-safe: all URL operations guarded by typeof window checks
 *
 * Adapted from the SvelteKit spec to React + wouter.
 */

import { useRef, useState, useCallback, useEffect } from "react";
import { useSearch, useLocation } from "wouter";

export interface FilterConfig {
  /** Debounce delay in ms (default: 300) */
  delay?: number;
  /** Sync to URL query params (default: true) */
  urlSync?: boolean;
  /** Fields NOT pushed to URL (e.g., ephemeral UI state) */
  excludeFromUrl?: string[];
  /** URL param prefix to avoid collisions (default: "f_") */
  prefix?: string;
}

type FilterState = Record<string, unknown>;

function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.join(",");
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function deserializeValue(raw: string): unknown {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.includes(",")) return raw.split(",").map((s) => s.trim());
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (!isNaN(Number(raw)) && raw.trim() !== "") return Number(raw);
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

function parseFiltersFromSearch(
  search: string,
  prefix: string,
  excludeFromUrl: string[],
): FilterState {
  if (typeof window === "undefined" || !search) return {};
  const params = new URLSearchParams(search);
  const result: FilterState = {};
  params.forEach((value, key) => {
    if (key.startsWith(prefix)) {
      const filterKey = key.slice(prefix.length);
      if (!excludeFromUrl.includes(filterKey)) {
        result[filterKey] = deserializeValue(value);
      }
    }
  });
  return result;
}

function buildSearchString(
  filters: FilterState,
  prefix: string,
  excludeFromUrl: string[],
  existingSearch: string,
): string {
  if (typeof window === "undefined") return existingSearch;
  const params = new URLSearchParams(existingSearch);
  // Clear old filter params
  Array.from(params.keys()).forEach((k) => {
    if (k.startsWith(prefix)) params.delete(k);
  });
  for (const [key, value] of Object.entries(filters)) {
    if (excludeFromUrl.includes(key)) continue;
    const serialized = serializeValue(value);
    if (serialized !== null) {
      params.set(`${prefix}${key}`, serialized);
    }
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

export interface UseDebouncedFilterReturn {
  /** Current filter state */
  filters: FilterState;
  /** Apply partial filter updates — URL sync debounced */
  apply: (partial: FilterState) => void;
  /** Apply immediately without debounce */
  applyNow: (partial: FilterState) => void;
  /** Reset to initial state */
  reset: () => void;
  /** Replace entire filter state */
  setFilters: (state: FilterState) => void;
}

/**
 * Hook for managing debounced, URL-synced filter state.
 *
 * @param initialFilters  Starting filter values
 * @param config          Optional debounce/URL sync settings
 * @returns               Filter state + apply/reset actions
 *
 * @example
 * const { filters, apply, reset } = useDebouncedFilter(
 *   { status: "ALL", search: "" },
 *   { delay: 400 }
 * );
 *
 * // In a search input:
 * onChange={(e) => apply({ search: e.target.value })}
 *
 * // Pass to query:
 * getListChangeRequestsQueryOptions({ search: filters.search as string })
 */
export function useDebouncedFilter(
  initialFilters: FilterState = {},
  config: FilterConfig = {},
): UseDebouncedFilterReturn {
  const {
    delay = 300,
    urlSync = true,
    excludeFromUrl = [],
    prefix = "f_",
  } = config;

  const search = useSearch();
  const [, setLocation] = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize from URL on first render
  const [filters, setFiltersState] = useState<FilterState>(() => {
    if (urlSync && typeof window !== "undefined") {
      const fromUrl = parseFiltersFromSearch(search, prefix, excludeFromUrl);
      return { ...initialFilters, ...fromUrl };
    }
    return { ...initialFilters };
  });

  const syncToUrl = useCallback(
    (state: FilterState) => {
      if (!urlSync || typeof window === "undefined") return;
      const newSearch = buildSearchString(state, prefix, excludeFromUrl, search);
      setLocation(window.location.pathname + newSearch, { replace: true });
    },
    [urlSync, prefix, excludeFromUrl, search, setLocation],
  );

  const apply = useCallback(
    (partial: FilterState) => {
      setFiltersState((prev) => {
        const next = { ...prev, ...partial };
        // Debounce URL sync
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          syncToUrl(next);
          timerRef.current = null;
        }, delay);
        return next;
      });
    },
    [delay, syncToUrl],
  );

  const applyNow = useCallback(
    (partial: FilterState) => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      setFiltersState((prev) => {
        const next = { ...prev, ...partial };
        syncToUrl(next);
        return next;
      });
    },
    [syncToUrl],
  );

  const reset = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setFiltersState(initialFilters);
    syncToUrl(initialFilters);
  }, [initialFilters, syncToUrl]);

  const setFilters = useCallback(
    (state: FilterState) => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      setFiltersState(state);
      syncToUrl(state);
    },
    [syncToUrl],
  );

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { filters, apply, applyNow, reset, setFilters };
}
