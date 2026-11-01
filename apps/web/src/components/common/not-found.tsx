import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import notFoundIllustration from "@/icons/not-found-illustration.svg";
import notFoundIllustrationDark from "@/icons/not-found-illustration-dark.svg";

// Modeled on Plane's 404: illustration, one apology line, a single way back.
// The illustration ships as two colorways — its ground and outlines are
// baked-in fills, so dark mode swaps to a recolored copy instead of CSS.
export function NotFound() {
  return (
    <div className="grid h-svh w-full place-items-center p-4">
      <div className="flex flex-col items-center gap-8 text-center">
        <img
          src={notFoundIllustration}
          alt=""
          className="h-auto w-72 max-w-full sm:w-80 lg:w-96 dark:hidden"
        />
        <img
          src={notFoundIllustrationDark}
          alt=""
          className="hidden h-auto w-72 max-w-full sm:w-80 lg:w-96 dark:block"
        />
        <div className="flex flex-col gap-2">
          <h1 className="text-base font-semibold text-foreground">
            Oops! Something went wrong.
          </h1>
          <p className="max-w-sm text-[13px] text-muted-foreground">
            Sorry, the page you are looking for cannot be found. It may have
            been removed, had its name changed, or is temporarily unavailable.
          </p>
        </div>
        <Link to="/" className={buttonVariants({ variant: "secondary" })}>
          Go to Home
        </Link>
      </div>
    </div>
  );
}
