"use client";

import { useEffect, useRef } from "react";
import type { SSEEvent } from "@/lib/sse";

interface LogEntry {
  event: SSEEvent;
  id: number;
}

interface StageLogProps {
  entries: LogEntry[];
}

export function StageLog({ entries }: StageLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 h-48 flex items-center justify-center">
        <p className="text-slate-600 text-sm">Stage output will appear here</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 h-48 overflow-y-auto font-mono text-xs">
      {entries.map(({ event, id }) => {
        if (event.type === "tool") {
          return (
            <div key={id} className="text-blue-400 mb-1">[{event.name}]</div>
          );
        }
        if (event.type === "text") {
          return (
            <div key={id} className="text-slate-400 mb-1">{event.text}</div>
          );
        }
        if (event.type === "result") {
          return (
            <div key={id} className="text-green-400 mb-1 mt-2">
              ✓ Done in {(event.duration / 1000).toFixed(1)}s · {event.turns} turns · ${event.cost.toFixed(4)}
            </div>
          );
        }
        if (event.type === "error") {
          return (
            <div key={id} className="text-red-400 mb-1">✗ Error: {event.message}</div>
          );
        }
        if (event.type === "progress") {
          const icon = event.status === "done" ? "✓" : event.status === "failed" ? "✗" : "●";
          const color = event.status === "done" ? "text-green-400" : event.status === "failed" ? "text-red-400" : "text-blue-400";
          return (
            <div key={id} className={`${color} mb-0.5`}>
              {icon} [{event.current}/{event.total}] {event.slug} — {event.status}
            </div>
          );
        }
        return null;
      })}
      <div ref={bottomRef} />
    </div>
  );
}
