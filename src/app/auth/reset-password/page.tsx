"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useRef(createSupabaseBrowser()).current;
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error_description") ?? params.get("error");

    if (urlError) {
      setError("Invalid or expired reset link. Please request a new one.");
      return;
    }

    // The /auth/callback route already exchanged the code server-side.
    // Check for an active session and listen for PASSWORD_RECOVERY.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => router.push("/login"), 2000);
    return () => clearTimeout(id);
  }, [success, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Password updated</h1>
          <p className="text-slate-400 text-sm">Redirecting you to sign in…</p>
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-4">
        <div className="w-full max-w-sm text-center">
          {error ? (
            <>
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={() => window.location.href = "/login"}
                className="mt-4 text-slate-500 hover:text-slate-300 text-xs transition-colors"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <p className="text-slate-400 text-sm">Verifying reset link…</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-100 mb-1 text-center">Grant Scout</h1>
        <p className="text-slate-500 text-sm mb-8 text-center">Choose a new password</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-400"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-400"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            {loading ? "…" : "Set new password"}
          </button>
        </form>
      </div>
    </main>
  );
}
