import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout";
import { AuthHydrate } from "@/components/providers/AuthHydrate";
import { GoogleProvider } from "@/components/auth/GoogleProvider";

export const metadata: Metadata = {
  title: "Asanamanager",
  description: "Next.js + MySQL + TypeScript – Project Management",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23334155'/><text x='16' y='22' font-size='18' font-weight='bold' fill='white' text-anchor='middle'>A</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AuthHydrate />
        <Header />
        <GoogleProvider>
          {children}
        </GoogleProvider>
      </body>
    </html>
  );
}
