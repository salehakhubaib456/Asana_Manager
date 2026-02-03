"use client";

import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "none" | "sm" | "md";
}

export function Card({
  padding = "md",
  className = "",
  children,
  ...props
}: CardProps) {
  const paddingClass =
    padding === "none" ? "" : padding === "sm" ? "p-4" : "p-6";
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 shadow-sm ${paddingClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
