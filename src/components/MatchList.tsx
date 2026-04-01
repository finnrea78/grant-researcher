import type { Match } from "@/lib/parseMatches";

interface MatchListProps {
  matches: Match[];
  onPropose: (funder: string, scheme: string) => void;
  proposing: boolean;
}

export function MatchList({ matches, onPropose, proposing }: MatchListProps) {
  const tier1 = matches.filter((m) => m.tier === 1);
  const tier2 = matches.filter((m) => m.tier === 2);
  const tier3 = matches.filter((m) => m.tier === 3);

  if (matches.length === 0) return null;

  function MatchRow({ match }: { match: Match }) {
    return (
      <button
        onClick={() => onPropose(match.funder, match.scheme)}
        disabled={proposing}
        className="w-full text-left bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 rounded-lg px-4 py-3 mb-2 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-slate-200 text-sm font-medium">{match.scheme}</div>
            <div className="text-slate-500 text-xs mt-0.5">
              {match.funder} · {match.amount} · {match.deadline}
            </div>
          </div>
          <div className="ml-4 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-300 text-xs font-bold shrink-0">
            {match.score.toFixed(1)}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="mt-6">
      {tier1.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 font-bold uppercase mb-2">
            Tier 1 — Strong Matches · click to propose
          </div>
          {tier1.map((m, i) => <MatchRow key={i} match={m} />)}
        </div>
      )}
      {tier2.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-slate-500 font-bold uppercase mb-2">
            Tier 2 — Worth Exploring
          </div>
          {tier2.map((m, i) => <MatchRow key={i} match={m} />)}
        </div>
      )}
      {tier3.length > 0 && (
        <div>
          <div className="text-xs text-slate-500 font-bold uppercase mb-2">
            Tier 3 — Long Shots
          </div>
          {tier3.map((m, i) => <MatchRow key={i} match={m} />)}
        </div>
      )}
    </div>
  );
}
