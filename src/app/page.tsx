"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ResearcherIntakeWizard } from "@/components/ResearcherIntakeWizard";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [existing, setExisting] = useState<{ slug: string; name: string }[]>([]);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [hydrating, setHydrating] = useState(false);

  useEffect(() => {
    fetch("/api/researchers")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setExisting(data);
          setSelectedSlug(data[0].slug);
        }
      })
      .catch(() => {});
  }, []);

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

  async function handleHydrate() {
    if (!selectedSlug) return;
    setHydrating(true);
    setError(null);
    try {
      const res = await fetch("/api/session/hydrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: selectedSlug }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load researcher");
        return;
      }
      router.push(`/session/${data.name}`);
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setHydrating(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Grant Scout</h1>
      <p className="text-slate-500 text-sm mb-10">Find funding for your research</p>

      <ResearcherIntakeWizard onSubmit={handleSubmit} loading={loading} />

      {existing.length > 0 && (
        <div className="w-full max-w-xl mt-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-slate-500 text-xs">or resume existing researcher</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>
          <div className="flex gap-2">
            <select
              value={selectedSlug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-blue-400"
            >
              {existing.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleHydrate}
              disabled={hydrating || !selectedSlug}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 text-sm rounded-lg transition-colors"
            >
              {hydrating ? "Loading…" : "Go"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-4 text-red-400 text-sm">{error}</p>}
    </main>
  );
}
