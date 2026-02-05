"use client";

import Script from "next/script";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (res: { access_token: string }) => void;
          }) => { requestAccessToken: (options?: { prompt?: string }) => void };
        };
      };
    };
  }
}

const GoogleReadyContext = createContext<boolean>(false);

export function useGoogleReady() {
  return useContext(GoogleReadyContext);
}

export function GoogleProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    const t = setTimeout(() => {
      if (typeof window !== "undefined" && window.google?.accounts?.oauth2) setReady(true);
      else setReady(true);
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {clientId && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setReady(true)}
        />
      )}
      <GoogleReadyContext.Provider value={!!clientId && ready}>
        {children}
      </GoogleReadyContext.Provider>
    </>
  );
}
