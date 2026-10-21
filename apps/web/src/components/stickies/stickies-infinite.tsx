import React, { useRef } from "react";
import { StickiesLayout } from "./stickies-layout";

export default function StickiesInfinite() {
  // ref
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef} className="space-y-4">
      <StickiesLayout />
    </div>
  );
}
