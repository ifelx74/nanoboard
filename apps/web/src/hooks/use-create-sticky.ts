import { useCallback, useState } from "react";
import type { Sticky } from "@/lib/db/schema";
import { createSticky, EmptyStickyExistsError } from "@/lib/db/stickies";
import { i18n } from "@/lib/i18n";
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
      const message = i18n.t("stickies:create.created");
      toast.success(message);
      return { ok: true, sticky };
    } catch (error: unknown) {
      if (error instanceof EmptyStickyExistsError) {
        const message = i18n.t("stickies:create.emptyExists");
        toast.warning(message);
        return { ok: false, reason: "empty-exists" };
      }
      const fallback = i18n.t("stickies:create.failed");
      toast.error(fallback);
      return { ok: false, reason: "failed" };
    } finally {
      setIsCreating(false);
    }
  }, [isCreating]);

  return { isCreating, addSticky };
}
