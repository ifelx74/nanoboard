import React from "react";

type PriorityOutlineProps = React.SVGProps<SVGSVGElement>;

export default function PriorityOutline({ ...props }: PriorityOutlineProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      aria-hidden="true"
      {...props}
    >
      <path
        fill="currentColor"
        d="M3.375 13.334v-2.667a.625.625 0 1 1 1.25 0v2.667a.625.625 0 0 1-1.25 0m4 0V6.667a.625.625 0 1 1 1.25 0v6.667a.625.625 0 0 1-1.25 0m4 0V2.667a.625.625 0 1 1 1.25 0v10.667a.625.625 0 0 1-1.25 0"
      ></path>
    </svg>
  );
}
