export { cn } from "cn";

/** The message of an thrown value, for toasts and inline error notes. */
export function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}
