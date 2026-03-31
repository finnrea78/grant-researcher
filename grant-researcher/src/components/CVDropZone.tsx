"use client";

import { useRef, useState } from "react";

interface CVDropZoneProps {
  onSubmit: (file: File, name: string) => void;
  loading?: boolean;
}

export function CVDropZone({ onSubmit, loading = false }: CVDropZoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
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
    if (file && name.trim()) onSubmit(file, name.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 w-full max-w-md">
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

      <input
        type="text"
        placeholder="Your name (e.g. will-rea)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-200 text-sm text-center placeholder-slate-500 focus:outline-none focus:border-blue-400"
      />

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
