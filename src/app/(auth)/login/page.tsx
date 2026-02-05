"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { ROUTES } from "@/constants";
import { useAuthStore } from "@/store";
import { authService } from "@/services/authService";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNewUserPrompt, setShowNewUserPrompt] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setShowNewUserPrompt(false);
    setLoading(true);
    try {
      const res = await authService.login({ email, password });
      authService.persistToken(res.token);
      authService.persistUser(res.user);
      setAuth(res.user, res.token);
      router.push(ROUTES.DASHBOARD);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
      const emailRegistered = err && typeof err === "object" && "emailRegistered" in err ? (err as { emailRegistered?: boolean }).emailRegistered : undefined;
      setShowNewUserPrompt(emailRegistered === false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-10">
      <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6">Log in</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-xl bg-white/90 border-white/80 shadow-sm"
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded-xl bg-white/90 border-white/80 shadow-sm"
        />
        <div className="flex justify-end">
          <Link
            href={ROUTES.FORGOT_PASSWORD}
            className="text-sm text-violet-700 hover:text-violet-800 font-medium"
          >
            Forgot password?
          </Link>
        </div>
        {error && (
          <div className="space-y-1">
            <p className="text-sm text-red-600 bg-red-50/90 rounded-xl px-3 py-2">{error}</p>
            {showNewUserPrompt && (
              <p className="text-sm text-slate-600">
                New user?{" "}
                <Link href={ROUTES.SIGNUP} className="font-semibold text-violet-700 hover:underline">
                  Sign up first
                </Link>
              </p>
            )}
          </div>
        )}
        <Button
          type="submit"
          className="w-full rounded-xl py-3.5 font-semibold bg-slate-800 hover:bg-slate-900 text-white"
          isLoading={loading}
        >
          Log in
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link href={ROUTES.SIGNUP} className="font-semibold text-violet-700 hover:text-violet-800 underline-offset-2 hover:underline">
          Sign up
        </Link>
      </p>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-300/60" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-transparent px-3 text-slate-500 font-medium">Or</span>
        </div>
      </div>

      <div className="space-y-3">
        <GoogleButton mode="login" disabled={loading} onError={setError} />
      </div>
    </div>
  );
}
