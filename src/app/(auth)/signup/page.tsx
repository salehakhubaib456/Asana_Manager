"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { ROUTES } from "@/constants";
import { useAuthStore } from "@/store";
import { authService } from "@/services/authService";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { getPasswordChecks, getPasswordStrength, validatePassword, PASSWORD } from "@/lib/password";
import { isValidEmail, INVALID_EMAIL_MESSAGE } from "@/lib/email";

function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const width =
    strength === "weak" ? "33%" : strength === "medium" ? "66%" : "100%";
  const color =
    strength === "weak"
      ? "bg-red-500"
      : strength === "medium"
        ? "bg-amber-500"
        : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${color}`}
            style={{ width }}
          />
        </div>
        <span
          className={`text-xs font-medium capitalize ${
            strength === "weak"
              ? "text-red-600"
              : strength === "medium"
                ? "text-amber-600"
                : "text-emerald-600"
          }`}
        >
          {strength}
        </span>
      </div>
    </div>
  );
}

function PasswordRequirements({ password }: { password: string }) {
  const checks = useMemo(() => getPasswordChecks(password), [password]);
  const items: { label: string; ok: boolean }[] = [
    { label: `${PASSWORD.MIN_LENGTH}–${PASSWORD.MAX_LENGTH} characters`, ok: checks.length },
    { label: "Uppercase + lowercase", ok: checks.uppercase && checks.lowercase },
    { label: "Number", ok: checks.number },
    { label: "Special character (!@#)", ok: checks.special },
    { label: "Not a common password", ok: checks.notCommon },
  ];
  return (
    <ul className="text-xs text-slate-600 space-y-0.5">
      {items.map(({ label, ok }) => (
        <li key={label} className={ok ? "text-emerald-600" : "text-slate-500"}>
          {ok ? "✓ " : "○ "}
          {label}
        </li>
      ))}
    </ul>
  );
}

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
    const trimmedEmail = email.trim();
    if (!isValidEmail(trimmedEmail)) {
      setError(INVALID_EMAIL_MESSAGE);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    const pwdValidation = validatePassword(password);
    if (!pwdValidation.valid) {
      setError(pwdValidation.error ?? "Invalid password");
      return;
    }
    setLoading(true);
    try {
      const parts = fullName.trim().split(/\s+/);
      const firstName = parts[0] ?? "";
      const lastName = parts.slice(1).join(" ") ?? "";
      const res = await authService.signup({
        email: trimmedEmail,
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
          minLength={PASSWORD.MIN_LENGTH}
          maxLength={PASSWORD.MAX_LENGTH}
          className="rounded-xl bg-white/90 border-white/80 shadow-sm"
        />
        {password && (
          <>
            <PasswordStrengthMeter password={password} />
            <PasswordRequirements password={password} />
          </>
        )}
        <Input
          label="Confirm Password"
          type="password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={PASSWORD.MIN_LENGTH}
          maxLength={PASSWORD.MAX_LENGTH}
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
