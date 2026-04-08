"use client";

import { useState } from "react";

interface Proposal {
  filename: string;
  content: string;
}

interface ProposalViewerProps {
  proposals: Proposal[];
}

function downloadProposal(proposal: Proposal) {
  const blob = new Blob([proposal.content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = proposal.filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProposalViewer({ proposals }: ProposalViewerProps) {
  const [activeIdx, setActiveIdx] = useState(proposals.length - 1);

  if (proposals.length === 0) return null;

  const active = proposals[activeIdx];

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-slate-500 font-bold uppercase">
          Proposal Alignments
        </div>
        <div className="flex gap-2">
          {proposals.length > 1 && (
            <button
              onClick={() => proposals.forEach(downloadProposal)}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
            >
              Download all
            </button>
          )}
          <button
            onClick={() => downloadProposal(active)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            ↓ Download
          </button>
        </div>
      </div>

      {proposals.length > 1 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {proposals.map((p, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`text-xs px-3 py-1 rounded border transition-colors
                ${i === activeIdx
                  ? "border-blue-500 text-blue-400 bg-blue-950"
                  : "border-slate-700 text-slate-500 hover:border-slate-500"
                }`}
            >
              {p.filename.replace(".md", "")}
            </button>
          ))}
        </div>
      )}

      <pre className="bg-slate-950 border border-slate-800 rounded-lg p-4 text-slate-300 text-xs overflow-auto whitespace-pre-wrap leading-relaxed max-h-96">
        {active.content}
      </pre>
    </div>
  );
}
