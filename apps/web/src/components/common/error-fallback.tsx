import { Link, type ErrorComponentProps } from "@tanstack/react-router";
import { CopyIcon, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("common");
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
      : String(error) || t("error.unexpectedOccurred");
  const errorStack = error instanceof Error ? error.stack : undefined;
  const componentStack = info?.componentStack;

  let title = t("error.somethingWentWrong");
  let message = t("error.unexpected");

  switch (code) {
    case 400:
      title = t("error.badRequestTitle");
      message = t("error.badRequestMessage");
      break;
    case 404:
      title = t("error.notFoundTitle");
      message = t("error.notFoundMessage");
      break;
    case 500:
      title = t("error.serverErrorTitle");
      message = t("error.serverErrorMessage");
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
      toast.success(t("error.copied"));
    } catch {
      toast.error(t("error.copyFailed"));
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
        <Button onClick={() => reset()}>{t("error.tryAgain")}</Button>
        <Link to="/" className={buttonVariants({ variant: "secondary" })}>
          {t("error.goHome")}
        </Link>
      </div>

      {import.meta.env.DEV && errorMessage && (
        <div className="max-h-100 w-full max-w-3xl overflow-auto rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium">{t("error.errorDetailsDev")}</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("error.copyDetails")}
                    onClick={handleCopyError}
                  >
                    <CopyIcon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("error.copyDetails")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-medium">{t("error.message")}</p>
              <p className="wrap-break-word rounded-md bg-background p-2 font-mono text-xs text-muted-foreground">
                {errorMessage}
              </p>
            </div>

            {errorStack && (
              <div>
                <p className="mb-2 text-xs font-medium">{t("error.stackTrace")}</p>
                <pre className="overflow-auto whitespace-pre-wrap wrap-break-word rounded-md bg-background p-2 font-mono text-xs text-muted-foreground">
                  {errorStack}
                </pre>
              </div>
            )}

            {componentStack && (
              <div>
                <p className="mb-2 text-xs font-medium">{t("error.componentStack")}</p>
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
