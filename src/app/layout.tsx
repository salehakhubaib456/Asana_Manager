import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout";
import { AuthHydrate } from "@/components/providers/AuthHydrate";

export const metadata: Metadata = {
  title: "Asanamanager",
  description: "Next.js + MySQL + TypeScript – Project Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthHydrate />
        <Header />
        {children}
      </body>
    </html>
  );
}
