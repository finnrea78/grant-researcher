"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CVDropZone } from "@/components/CVDropZone";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(file: File, name: string) {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("cv", file);
      formData.append("name", name);

      const res = await fetch("/api/session", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to create session");
        return;
      }

      router.push(`/session/${data.name}`);
    } catch (err) {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <h1 className="text-2xl font-bold text-slate-100 mb-2">Grant Scout</h1>
      <p className="text-slate-500 text-sm mb-10">Find funding for your research</p>

      <CVDropZone onSubmit={handleSubmit} loading={loading} />

      {error && (
        <p className="mt-4 text-red-400 text-sm">{error}</p>
      )}
    </main>
  );
}
