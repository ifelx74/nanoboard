import { useEffect, useRef, useState } from "react";
import {
  QUICK_ADD_TITLE_MAX,
  QUICK_ADD_TITLE_MIN,
  updateTaskTitle,
} from "@/lib/db/queries";
import type { Task } from "@/lib/db/schema";
import { toast } from "@/lib/toast";

export default function TaskTitle({ task }: { task: Task }) {
  const [value, setValue] = useState(task.title);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);
  const taskRef = useRef(task);
  taskRef.current = task;

  function persist(next: string) {
    updateTaskTitle(taskRef.current.id, next).catch((error: unknown) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to update title",
      );
    });
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending !== null && pending !== taskRef.current.title) {
        persist(pending);
      }
    },
    [],
  );

  function handleChange(next: string) {
    setValue(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    const trimmed = next.trim();
    if (
      trimmed.length < QUICK_ADD_TITLE_MIN ||
      trimmed.length > QUICK_ADD_TITLE_MAX ||
      trimmed === task.title
    ) {
      pendingRef.current = null;
      return;
    }
    pendingRef.current = trimmed;
    timerRef.current = setTimeout(() => {
      pendingRef.current = null;
      persist(trimmed);
    }, 800);
  }

  return (
    <input
      type="text"
      value={value}
      maxLength={QUICK_ADD_TITLE_MAX}
      placeholder="Task title"
      aria-label="Task title"
      onChange={(event) => handleChange(event.target.value)}
      className="block h-auto w-full appearance-none border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground"
    />
  );
}
