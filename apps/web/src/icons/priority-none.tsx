import React from "react";

type PriorityNoneProps = React.SVGProps<SVGSVGElement>;

export default function PriorityNone({ ...props }: PriorityNoneProps) {
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
        d="M4.25 9.25a1.25 1.25 0 1 1 0-2.5h7.5a1.25 1.25 0 1 1 0 2.5z"
      ></path>
    </svg>
  );
}
