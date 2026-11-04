import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { CopyIcon, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button, buttonVariants } from "@/components/ui/button";
import { toast } from "@/lib/toast";

function getStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

export function ErrorFallback({ error, info, reset }: ErrorComponentProps) {
  const loggedError = useRef<unknown>(null);

  useEffect(() => {
    if (import.meta.env.DEV && loggedError.current !== error) {
      loggedError.current = error;
      console.error(error);
    }
  }, [error]);

  const code = getStatusCode(error);
  const errorMessage =
    error instanceof Error && error.message
      ? error.message
      : String(error) || "An unexpected error occurred.";
  const errorStack = error instanceof Error ? error.stack : undefined;
  const componentStack = info?.componentStack;

  let title = "Something went wrong";
  let message =
    "An unexpected error stopped this page from loading. You can try again, or head back home.";

  switch (code) {
    case 400:
      title = "Bad request";
      message = "The request could not be completed. Please try again.";
      break;
    case 404:
      title = "Not found";
      message = "The page or item you were looking for could not be found.";
      break;
    case 500:
      title = "Internal server error";
      message = "Something went wrong on our side. Please try again.";
      break;
  }

  async function handleCopyError() {
    const errorText = [
      `Error: ${errorMessage}`,
      errorStack ? `\nStack trace:\n${errorStack}` : "",
      componentStack ? `\nComponent stack:${componentStack}` : "",
    ].join("\n");

    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard is not available");
      }
      await navigator.clipboard.writeText(errorText);
      toast.success("Error details copied to clipboard");
    } catch {
      toast.error("Failed to copy error details");
    }
  }

  return (
    <div
      role="alert"
      className="flex min-h-svh w-full flex-col items-center justify-center gap-6 bg-background p-4 text-foreground"
    >
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlert className="size-7" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-semibold">{title}</h1>
          <p className="text-[13px] text-muted-foreground">{message}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Link to="/" className={buttonVariants({ variant: "secondary" })}>
          Go to Home
        </Link>
      </div>

      {import.meta.env.DEV && errorMessage && (
        <div className="max-h-100 w-full max-w-3xl overflow-auto rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium">Error details (development)</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy error details"
                    onClick={handleCopyError}
                  >
                    <CopyIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy error details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-medium">Message</p>
              <p className="wrap-break-word rounded-md bg-background p-2 font-mono text-xs text-muted-foreground">
                {errorMessage}
              </p>
            </div>

            {errorStack && (
              <div>
                <p className="mb-2 text-xs font-medium">Stack trace</p>
                <pre className="overflow-auto whitespace-pre-wrap wrap-break-word rounded-md bg-background p-2 font-mono text-xs text-muted-foreground">
                  {errorStack}
                </pre>
              </div>
            )}

            {componentStack && (
              <div>
                <p className="mb-2 text-xs font-medium">Component stack</p>
                <pre className="overflow-auto whitespace-pre-wrap wrap-break-word rounded-md bg-background p-2 font-mono text-xs text-muted-foreground">
                  {componentStack}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
