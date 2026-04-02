"use client";

import { useRef, useState } from "react";

interface IntakeFormProps {
  onSubmit: (file: File, name: string, scholarUrl: string, futureResearch: string) => void;
  loading?: boolean;
}

export function IntakeForm({ onSubmit, loading = false }: IntakeFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [scholarUrl, setScholarUrl] = useState("");
  const [futureResearch, setFutureResearch] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (file && name.trim()) onSubmit(file, name.trim(), scholarUrl.trim(), futureResearch.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-md">
      {/* CV upload */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={`w-full border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${dragging ? "border-blue-400 bg-blue-950" : "border-slate-600 hover:border-slate-400"}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".md,.pdf,.txt"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <div className="text-3xl mb-2">📄</div>
        {file ? (
          <p className="text-slate-300 text-sm">{file.name}</p>
        ) : (
          <>
            <p className="text-slate-400 text-sm">Drop your CV here</p>
            <p className="text-slate-600 text-xs mt-1">.md, .pdf, or .txt</p>
          </>
        )}
      </div>

      {/* Name */}
      <input
        type="text"
        placeholder="Your name (e.g. will-rea)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400"
      />

      {/* Google Scholar URL — optional */}
      <div className="flex flex-col gap-1">
        <label className="text-slate-400 text-xs">
          Google Scholar profile URL{" "}
          <span className="text-slate-600">(optional — we'll try to find you if left blank)</span>
        </label>
        <input
          type="url"
          placeholder="https://scholar.google.com/citations?user=…"
          value={scholarUrl}
          onChange={(e) => setScholarUrl(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400"
        />
      </div>

      {/* Future research direction — optional */}
      <div className="flex flex-col gap-1">
        <label className="text-slate-400 text-xs">
          Future research direction{" "}
          <span className="text-slate-600">(optional — helps match you to forward-looking grants)</span>
        </label>
        <textarea
          placeholder="Possible future research — what questions do you want to explore next? What projects are you considering? This helps match you to forward-looking grants."
          value={futureResearch}
          onChange={(e) => setFutureResearch(e.target.value)}
          rows={4}
          maxLength={1000}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-400 resize-none"
        />
        <p className="text-slate-600 text-xs text-right">{futureResearch.length}/1000</p>
      </div>

      <button
        type="submit"
        disabled={!file || !name.trim() || loading}
        className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-8 py-2 rounded-lg text-sm transition-colors"
      >
        {loading ? "Starting…" : "Start →"}
      </button>
    </form>
  );
}
