import React from "react";

type PriorityLowProps = React.SVGProps<SVGSVGElement>;

export default function PriorityLow({ ...props }: PriorityLowProps) {
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
        d="M3 10.25a1.25 1.25 0 1 1 2.5 0v2.5a1.25 1.25 0 1 1-2.5 0z"
      ></path>
      <path
        fill="var(--priority-unlit)"
        d="M7 6.75a1.25 1.25 0 1 1 2.5 0v6a1.25 1.25 0 1 1-2.5 0zM10.75 3.251a1.25 1.25 0 1 1 2.5 0v9.5a1.25 1.25 0 0 1-2.5 0z"
      ></path>
    </svg>
  );
}
