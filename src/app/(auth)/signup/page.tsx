"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { ROUTES } from "@/constants";
import { useAuthStore } from "@/store";
import { authService } from "@/services/authService";
import { GoogleButton } from "@/components/auth/GoogleButton";

export default function SignupPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [schemaError, setSchemaError] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrationLog, setMigrationLog] = useState<string | null>(null);

  async function runMigration() {
    setMigrating(true);
    setMigrationLog(null);
    try {
      const res = await fetch("/api/dev/migrate-auth");
      const data = await res.json().catch(() => ({}));
      if (data.ok && Array.isArray(data.log)) {
        setMigrationLog(data.log.join("\n"));
        setError("");
        setSchemaError(false);
      } else {
        setMigrationLog(data.log?.join("\n") ?? data.error ?? "Migration failed");
      }
    } catch (e) {
      setMigrationLog(e instanceof Error ? e.message : "Request failed");
    } finally {
      setMigrating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSchemaError(false);
    setMigrationLog(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] ?? "";
      const lastName = parts.slice(1).join(" ") ?? "";
      const res = await authService.signup({
        email,
        password,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
      });
      authService.persistToken(res.token);
      authService.persistUser(res.user);
      setAuth(res.user, res.token);
      router.push(ROUTES.DASHBOARD);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      const isSchema =
        typeof msg === "string" &&
        (msg.includes("schema") || msg.includes("password_hash") || msg.includes("user_sessions") || msg.includes("Unknown column"));
      setSchemaError(!!isSchema);
      setError(isSchema ? `${msg}\n\nClick "Run database migration" below to fix.` : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-10">
      <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-6">Sign Up</h1>
      <form id="signup-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          type="text"
          placeholder="John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          className="rounded-xl bg-white/90 border-white/80 shadow-sm"
        />
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
          minLength={6}
          className="rounded-xl bg-white/90 border-white/80 shadow-sm"
        />
        <Input
          label="Confirm Password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={6}
          className="rounded-xl bg-white/90 border-white/80 shadow-sm"
        />
        {error && (
          <p className="text-sm text-red-600 bg-red-50/90 rounded-xl px-3 py-2 whitespace-pre-line">{error}</p>
        )}
        {schemaError && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={runMigration}
              disabled={migrating}
              className="text-sm font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl px-4 py-2.5 border border-violet-200 disabled:opacity-60"
            >
              {migrating ? "Running migration…" : "Run database migration"}
            </button>
            {migrationLog && (
              <pre className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 whitespace-pre-wrap border border-slate-200">
                {migrationLog}
              </pre>
            )}
          </div>
        )}
        <Button
          type="submit"
          className="w-full rounded-xl py-3.5 font-semibold bg-slate-800 hover:bg-slate-900 text-white"
          isLoading={loading}
        >
          Sign Up
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href={ROUTES.LOGIN} className="font-semibold text-violet-700 hover:text-violet-800 underline-offset-2 hover:underline">
          Log in
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
        <GoogleButton mode="signup" disabled={loading} onError={setError} />
      </div>
    </div>
  );
}
