"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);

    const supabase = createSupabaseBrowser();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("signin");
      }
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) {
        setError(error.message);
      } else {
        setInfo("Check your email for a reset link.");
        setMode("signin");
      }
    }

    setLoading(false);
  }

  function switchMode(next: "signin" | "signup" | "forgot") {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-100 mb-1 text-center">Grant Scout</h1>
        <p className="text-slate-500 text-sm mb-8 text-center">
          {mode === "signin"
            ? "Sign in to continue"
            : mode === "signup"
            ? "Create an account"
            : "Reset your password"}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-400"
          />
          {mode !== "forgot" && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-400"
            />
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {info && <p className="text-blue-400 text-sm">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            {loading
              ? "…"
              : mode === "signin"
              ? "Sign in"
              : mode === "signup"
              ? "Create account"
              : "Send reset email"}
          </button>
        </form>

        {mode === "signin" && (
          <button
            onClick={() => switchMode("forgot")}
            className="mt-2 w-full text-slate-500 hover:text-slate-300 text-xs text-center transition-colors"
          >
            Forgot password?
          </button>
        )}

        <button
          onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-slate-500 hover:text-slate-300 text-xs text-center transition-colors"
        >
          {mode === "signin"
            ? "No account? Sign up"
            : mode === "signup"
            ? "Already have an account? Sign in"
            : "Back to sign in"}
        </button>
      </div>
    </main>
  );
}
