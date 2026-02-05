"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { ROUTES } from "@/constants";

const HIDE_HEADER_PATHS: string[] = [ROUTES.LOGIN, ROUTES.SIGNUP, ROUTES.FORGOT_PASSWORD];

export function HeaderConditional() {
  const pathname = usePathname();
  const hide = HIDE_HEADER_PATHS.includes(pathname);
  if (hide) return null;
  return <Header />;
}
