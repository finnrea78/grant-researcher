# Frontend Conventions (Next.js 14 App Router)

## Component rules
- Server components by default — add `"use client"` only when needed (interactivity, hooks, browser APIs)
- shadcn/ui components live in `src/components/ui/` — use them, don't rebuild primitives
- Import icons from `lucide-react`
- Use `cn()` from `@/lib/utils` for all conditional className merging

## Styling
- Tailwind only — no inline styles, no CSS modules, no styled-components
- Dark theme uses CSS variables — see `globals.css` for the token definitions
- Color tokens: `bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground` etc.
- Don't hardcode `bg-slate-950` — use the semantic token equivalents

## Routing and data fetching
- All API routes live under `/api/session/[name]/`
- SSE streaming routes use the `sse.ts` helper from `@/lib/sse`
- `params` is a plain object in Next.js 14 — use `params.name` directly (not `await params`)

## Animations
- Use `framer-motion` for enter/exit animations on lists and modals
- Use `sonner` for toast notifications (not a custom toast)
- `cmdk` is available for command palette (Cmd+K) if needed

## Path aliases
- `@/` maps to `src/` — always use this for imports, never relative `../`
