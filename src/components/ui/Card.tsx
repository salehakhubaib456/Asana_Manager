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
      className={`bg-white/60 backdrop-blur-md rounded-xl border border-white/50 shadow-lg ${paddingClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
