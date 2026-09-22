import type { ComponentProps } from "react";

export function Card({ className = "", ...divProps }: ComponentProps<"div">) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface p-5 sm:p-6 ${className}`}
      {...divProps}
    />
  );
}
