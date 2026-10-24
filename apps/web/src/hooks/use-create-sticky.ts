import { useCallback, useState } from "react";
import type { Sticky } from "@/lib/db/schema";
import { createSticky, EmptyStickyExistsError } from "@/lib/db/stickies";
import { toast } from "@/lib/toast";

export type CreateStickyResult =
  | { ok: true; sticky: Sticky }
  | {
      ok: false;
      /** `in-flight` — another create is running; `empty-exists` — the newest note is still blank; `failed` — write error. */
      reason: "in-flight" | "empty-exists" | "failed";
    };

/**
 * Shared "add sticky" flow for the header, action bar, and all-stickies
 * modal: guards double-submits, toasts the outcome, and reports which guard
 * fired so callers can react (e.g. open the empty note).
 */
export function useCreateSticky() {
  const [isCreating, setIsCreating] = useState(false);

  const addSticky = useCallback(async (): Promise<CreateStickyResult> => {
    if (isCreating) return { ok: false, reason: "in-flight" };
    setIsCreating(true);
    try {
      const sticky = await createSticky();
      toast.success("Sticky created");
      return { ok: true, sticky };
    } catch (error: unknown) {
      if (error instanceof EmptyStickyExistsError) {
        toast.warning("There already exists a sticky with no description");
        return { ok: false, reason: "empty-exists" };
      }
      toast.error("Failed to create sticky");
      return { ok: false, reason: "failed" };
    } finally {
      setIsCreating(false);
    }
  }, [isCreating]);

  return { isCreating, addSticky };
}
