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

type LogoIconProps = React.SVGProps<SVGSVGElement>;

export function LogoIcon(props: LogoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-label="nanoboard logo"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#ffffff" />
      <rect x="4" y="4" width="4" height="16" rx="1.5" fill="#2E9F45" />
      <rect x="10" y="4" width="4" height="11" rx="1.5" fill="#2E9F45" />
      <rect x="16" y="4" width="4" height="5" rx="1.5" fill="#2E9F45" />
      <rect
        x="16"
        y="11"
        width="4"
        height="4"
        rx="1.5"
        opacity="0.45"
        fill="#2E9F45"
      />
    </svg>
  );
}

export function BackgroundLogo(props: LogoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      aria-label="nanoboard logo"
      {...props}
    >
      <rect width="24" height="24" rx="5" fill="#2E9F45" />
      <rect x="4" y="4" width="4" height="16" rx="1.5" fill="#ffffff" />
      <rect x="10" y="4" width="4" height="11" rx="1.5" fill="#ffffff" />
      <rect x="16" y="4" width="4" height="5" rx="1.5" fill="#ffffff" />
      <rect
        x="16"
        y="11"
        width="4"
        height="4"
        rx="1.5"
        opacity="0.45"
        fill="#ffffff"
      />
    </svg>
  );
}
