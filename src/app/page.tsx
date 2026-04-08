"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ResearcherIntakeWizard } from "@/components/ResearcherIntakeWizard";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

interface ResearcherSummary {
  slug: string;
  name: string;
  hasProfile: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [researchers, setResearchers] = useState<ResearcherSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState<string | null>(null);

  // Empty-state intake wizard state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/researchers")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setResearchers(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleCardClick(researcher: ResearcherSummary) {
    setNavigating(researcher.slug);
    setError(null);
    try {
      if (researcher.hasProfile) {
        const res = await fetch("/api/session/hydrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: researcher.slug }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to load researcher");
          return;
        }
      }
      router.push(`/session/${researcher.slug}`);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setNavigating(null);
    }
  }

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/session", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to create session");
        return;
      }
      router.push(`/session/${data.name}`);
    } catch {
      setSubmitError("Network error — is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500 text-sm">Loading…</p>
      </main>
    );
  }

  // Empty state — show intake wizard
  if (researchers.length === 0) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12 relative">
        <button
          onClick={handleSignOut}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-xs transition-colors"
        >
          Sign out
        </button>

        <h1 className="text-2xl font-bold text-slate-100 mb-2">Grant Scout</h1>
        <p className="text-slate-500 text-sm mb-10">Find funding for your research</p>

        <ResearcherIntakeWizard onSubmit={handleSubmit} loading={submitting} />

        {submitError && <p className="mt-4 text-red-400 text-sm">{submitError}</p>}
      </main>
    );
  }

  // Dashboard state — show researcher cards
  return (
    <main className="flex flex-col items-center min-h-screen px-4 py-12 relative">
      <button
        onClick={handleSignOut}
        className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-xs transition-colors"
      >
        Sign out
      </button>

      <h1 className="text-2xl font-bold text-slate-100 mb-2">Grant Scout</h1>
      <p className="text-slate-500 text-sm mb-10">Your researchers</p>

      <div className="w-full max-w-xl flex flex-col gap-3">
        {researchers.map((r) => (
          <button
            key={r.slug}
            onClick={() => handleCardClick(r)}
            disabled={navigating === r.slug}
            className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 rounded-lg px-4 py-3 text-left transition-colors"
          >
            <span className="text-slate-100 text-sm font-medium">{r.name}</span>
            <span className="text-slate-500 text-xs">
              {navigating === r.slug
                ? "Loading…"
                : r.hasProfile
                  ? "Profile complete"
                  : "Getting started"}
            </span>
          </button>
        ))}

        <button
          onClick={() => router.push("/new")}
          className="w-full mt-2 py-2.5 text-sm text-slate-400 hover:text-slate-200 border border-dashed border-slate-700 hover:border-slate-500 rounded-lg transition-colors"
        >
          + New researcher
        </button>
      </div>

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </main>
  );
}
