"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ResearcherIntakeWizard } from "@/components/ResearcherIntakeWizard";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export default function NewResearcherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/session", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create session");
        return;
      }
      router.push(`/session/${data.name}`);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12 relative">
      <button
        onClick={handleSignOut}
        className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 text-xs transition-colors"
      >
        Sign out
      </button>

      <button
        onClick={() => router.push("/")}
        className="absolute top-4 left-4 text-slate-500 hover:text-slate-300 text-xs transition-colors"
      >
        ← Back
      </button>

      <h1 className="text-2xl font-bold text-slate-100 mb-2">New researcher</h1>
      <p className="text-slate-500 text-sm mb-10">Find funding for your research</p>

      <ResearcherIntakeWizard onSubmit={handleSubmit} loading={loading} />

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </main>
  );
}
