"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { ROUTES } from "@/constants";
import { authService } from "@/services/authService";

type Step = "email" | "otp" | "password";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await authService.forgotPassword({ email: email.trim() });
      setMessage(res.message ?? "OTP sent to your email. Check your inbox (e.g. Gmail) and paste it below.");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await authService.verifyResetOtp({ email: email.trim(), otp: otp.trim() });
      setMessage("OTP verified. Now set your new password.");
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired OTP");
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });
      setMessage("Password saved. You can now sign in with your new password.");
      setTimeout(() => {
        window.location.href = ROUTES.LOGIN;
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white/40 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-10">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Forgot password</h1>
        <p className="text-slate-500 mt-1 text-sm">
          {step === "email" &&
            "Enter the email linked to your account. We’ll send a 4-digit OTP to that email."}
          {step === "otp" &&
            "Open your inbox (e.g. Gmail), copy the OTP from the Asanamanager email, and paste it below."}
          {step === "password" && "Set a new password and save. You’ll use it for future login."}
        </p>
      </div>

      {step === "email" && (
        <form onSubmit={handleSendOTP} className="space-y-4">
          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-xl bg-white/90 border-white/80 shadow-sm"
          />
          {message && (
            <p className="text-sm text-green-700 bg-green-50/90 rounded-xl px-3 py-2">{message}</p>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50/90 rounded-xl px-3 py-2">{error}</p>
          )}
          <Button type="submit" className="w-full rounded-xl py-3 font-semibold bg-slate-800 hover:bg-slate-900 text-white" isLoading={loading}>
            Send 4-digit OTP
          </Button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerifyOTP} className="space-y-4">
          <p className="text-sm text-slate-600">OTP sent to <strong>{email}</strong></p>
          <Input
            label="4-digit OTP"
            type="text"
            inputMode="numeric"
            placeholder="Paste OTP from your email"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
            maxLength={4}
            required
            className="rounded-xl bg-white/90 border-white/80 shadow-sm"
          />
          {message && (
            <p className="text-sm text-green-700 bg-green-50/90 rounded-xl px-3 py-2">{message}</p>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50/90 rounded-xl px-3 py-2">{error}</p>
          )}
          <Button type="submit" className="w-full rounded-xl py-3 font-semibold bg-slate-800 hover:bg-slate-900 text-white" isLoading={loading}>
            Verify OTP
          </Button>
          <button
            type="button"
            onClick={() => { setStep("email"); setOtp(""); setMessage(""); setError(""); }}
            className="w-full text-sm text-slate-500 hover:text-slate-700"
          >
            Use a different email
          </button>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={handleSavePassword} className="space-y-4">
          <Input
            label="Set new password"
            type="password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
            className="rounded-xl bg-white/90 border-white/80 shadow-sm"
          />
          <Input
            label="Confirm new password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            className="rounded-xl bg-white/90 border-white/80 shadow-sm"
          />
          {message && (
            <p className="text-sm text-green-700 bg-green-50/90 rounded-xl px-3 py-2">{message}</p>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50/90 rounded-xl px-3 py-2">{error}</p>
          )}
          <Button type="submit" className="w-full rounded-xl py-3 font-semibold bg-slate-800 hover:bg-slate-900 text-white" isLoading={loading}>
            Save new password
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href={ROUTES.LOGIN} className="font-semibold text-violet-700 hover:text-violet-800">
          ← Back to sign in
        </Link>
      </p>
    </div>
  );
}
