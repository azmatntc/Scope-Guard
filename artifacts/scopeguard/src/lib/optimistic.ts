/**
 * optimistic.ts — React Query compatible optimistic mutation helper
 *
 * Provides instant UI feedback while API calls run in the background.
 * On failure, the optimistic item is removed and a toast is shown.
 *
 * Works with any React Query QueryClient cache key — no custom stores needed.
 *
 * Workflow:
 *  1. Snapshot current cache for rollback
 *  2. Immediately insert optimistic item (marked with _optimistic: true)
 *  3. Execute real API call
 *  4. On success: invalidate query to replace optimistic item with server data
 *  5. On failure: restore snapshot + show error toast
 */

import type { QueryClient } from "@tanstack/react-query";

export interface OptimisticOptions<T extends { id: string }> {
  /** React Query client instance */
  queryClient: QueryClient;

  /** Query cache key whose list will receive the optimistic item */
  queryKey: unknown[];

  /** Optimistic payload — will be merged into a temporary item */
  optimisticItem: Omit<T, "id"> & Partial<Pick<T, "id">>;

  /** Async function that performs the real API mutation */
  mutationFn: () => Promise<T>;

  /**
   * How to apply the optimistic item to the existing cache list.
   * "prepend" | "append" | custom function.
   * Default: "prepend"
   */
  placement?: "prepend" | "append" | ((items: T[], item: T) => T[]);

  /** Called with the real server response on success */
  onSuccess?: (item: T) => void;

  /** Called with original temp item and error on rollback */
  onRollback?: (tempItem: T, error: unknown) => void;

  /** Custom toast function — defaults to console.error */
  toastError?: (message: string) => void;

  /** Custom temp ID generator — defaults to crypto.randomUUID */
  generateTempId?: () => string;
}

/**
 * Perform an optimistic UI update with automatic rollback on failure.
 *
 * @returns Promise resolving to the server response
 * @throws  Re-throws the original error after rollback (for caller handling)
 *
 * @example
 * await optimisticMutation({
 *   queryClient,
 *   queryKey: ["change-requests"],
 *   optimisticItem: { title: "New CO", status: "DRAFT", ... },
 *   mutationFn: () => api.post("/api/change-requests", payload),
 *   onSuccess: () => toast({ title: "Created!" }),
 * });
 */
export async function optimisticMutation<T extends { id: string }>(
  options: OptimisticOptions<T>,
): Promise<T> {
  const {
    queryClient,
    queryKey,
    optimisticItem,
    mutationFn,
    placement = "prepend",
    onSuccess,
    onRollback,
    toastError,
    generateTempId = () => crypto.randomUUID(),
  } = options;

  const tempId = optimisticItem.id ?? generateTempId();
  const tempItem = {
    ...optimisticItem,
    id: tempId,
    _optimistic: true,
    _optimisticAt: Date.now(),
  } as unknown as T;

  // 1. Snapshot for rollback
  const previousData = queryClient.getQueryData<T[]>(queryKey);

  // 2. Optimistic update
  queryClient.setQueryData<T[]>(queryKey, (old) => {
    const list = old ?? [];
    if (typeof placement === "function") return placement(list, tempItem);
    return placement === "append" ? [...list, tempItem] : [tempItem, ...list];
  });

  try {
    // 3. Real API call
    const result = await mutationFn();

    // 4. Replace optimistic item with real server data
    queryClient.setQueryData<T[]>(queryKey, (old) =>
      (old ?? []).map((item) =>
        (item as any)._optimistic && item.id === tempId
          ? { ...result, _optimistic: false }
          : item,
      ),
    );

    // 5. Invalidate to sync any server-side computed fields
    queryClient.invalidateQueries({ queryKey });

    onSuccess?.(result);
    return result;
  } catch (error: unknown) {
    // 6. Rollback to snapshot
    queryClient.setQueryData(queryKey, previousData);

    onRollback?.(tempItem, error);

    const message =
      (error as any)?.response?.data?.error?.message ??
      (error as any)?.message ??
      "Action failed. Changes reverted.";

    if (toastError) {
      toastError(message);
    } else {
      console.error("[optimisticMutation] rolled back:", message);
    }

    throw error;
  }
}
