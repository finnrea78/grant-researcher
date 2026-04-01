# Core CLI Conventions (grant-scout)

## Package info
- Package name: `grant-scout` (importable as `grant-scout/prompts/*` etc.)
- ESM module (`"type": "module"`) — use `.js` extensions in imports
- Binary: `grant-scout` CLI at `./dist/cli.js`
- **Always rebuild after changes:** `npm run build`

## Prompts
- Each prompt is a separate file in `src/prompts/`
- Export the prompt string as default
- Prompts are exported via package.json `exports` — add new ones there too

## Agent SDK patterns
- Assistant message content lives at `message.message.content` (nested BetaMessage)
- See `src/stream.ts` for the canonical SSE streaming pattern
- The `match` command must never include `WebFetch` or `WebSearch` in `allowedTools`

## Data directory structure
- `data/funding-sources/` — one markdown file per funder
- `data/researchers/` — subdirs per researcher with profile.json and CV
- `data/outputs/` — subdirs per researcher with match results and proposals
- `_last-harvested.json` and `_urls.md` track scraping state

## Commands
- `profile` — build researcher profile from CV
- `scan` — harvest funding source data
- `match` — match researcher to funding sources
- `propose` — generate grant proposal outline
