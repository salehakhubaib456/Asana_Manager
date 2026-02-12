"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store";
import { authService } from "@/services/authService";
import { OnboardingModal } from "./OnboardingModal";

/**
 * Renders onboarding modal when user is logged in and has not completed onboarding.
 * Used inside dashboard layout so only dashboard routes show the flow.
 */
export function OnboardingGate() {
  const { user, token, isHydrated, setUser } = useAuthStore();
  const [showModal, setShowModal] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isHydrated || !token) {
      setShowModal(false);
      return;
    }
    authService
      .me()
      .then((fresh) => {
        setUser(fresh);
        authService.persistUser(fresh);
        const needsOnboarding =
          fresh &&
          (fresh.onboarding_completed_at == null ||
            fresh.onboarding_completed_at === "");
        setShowModal(!!needsOnboarding);
      })
      .catch(() => setShowModal(false));
  }, [isHydrated, token, setUser]);

  if (showModal !== true || !user) return null;

  return (
    <OnboardingModal
      user={user}
      onComplete={() => setShowModal(false)}
    />
  );
}
