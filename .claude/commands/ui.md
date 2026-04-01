# /ui — Start a UI Development Session

This command sets up context for a frontend development session on Grant Scout.

## What to do when /ui is run

1. **Check the dev server status** — remind the user to start it if not running:
   ```
   npm run dev -w grant-researcher
   ```
   (Must run from monorepo root `/home/finn/Developer/grant-researcher`)

2. **Summarize the current frontend state** — briefly list:
   - The 5 existing components: CVDropZone, PipelineBar, MatchList, ProposalViewer, StageLog
   - The shadcn/ui components available: button, card, dialog, input, label, badge
   - Current theme: dark slate, CSS variable tokens

3. **Remind about the design workflow:**
   - Use v0.dev to scaffold initial layouts
   - Copy v0 output into the project and adapt with Claude Code
   - Use `cn()` from `@/lib/utils` for all className merging
   - Use `lucide-react` for icons

4. **Ask what UI work to tackle** — offer these focus areas:
   - Improve an existing component
   - Build a new component
   - Redesign a page layout
   - Add animations or transitions

## Key files for UI work
- `grant-researcher/src/app/` — pages and layouts
- `grant-researcher/src/components/` — custom components
- `grant-researcher/src/components/ui/` — shadcn primitives (don't modify unless necessary)
- `grant-researcher/src/app/globals.css` — CSS variable tokens
- `grant-researcher/tailwind.config.ts` — theme extensions
