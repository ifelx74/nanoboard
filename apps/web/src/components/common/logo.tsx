import { Link } from "@tanstack/react-router";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`flex h-8 items-center px-2 font-heading text-lg font-semibold tracking-tight ${className}`}
    >
      nanoboard
    </Link>
  );
}
