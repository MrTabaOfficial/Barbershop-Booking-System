import type { ComponentProps } from "react";

type CardProps = ComponentProps<"div"> & { plate?: boolean };

export function Card({ plate = false, className = "", ...divProps }: CardProps) {
  return (
    <div
      className={`rounded-lg bg-surface p-5 sm:p-6 ${
        plate ? "border-2 border-ink" : "border border-line"
      } ${className}`}
      {...divProps}
    />
  );
}
