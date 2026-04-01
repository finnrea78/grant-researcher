#!/usr/bin/env bash
# Weekly developer progress dashboard
# Run from monorepo root: bash scripts/dev-dashboard.sh

set -euo pipefail

DAYS=${1:-7}
SINCE="$DAYS days ago"
REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ── Header ──────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          GRANT SCOUT  —  Dev Dashboard               ║"
printf "║  Past %-2s days  ·  %s  ║\n" "$DAYS" "$(date '+%a %d %b %Y        ')"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Commit stats ─────────────────────────────────────────────────────────────
COMMITS=$(git log --oneline --since="$SINCE" 2>/dev/null | wc -l | tr -d ' ')
COMMIT_DAYS=$(git log --format="%ad" --date=short --since="$SINCE" 2>/dev/null | sort -u | wc -l | tr -d ' ')

echo "## Commits"
echo "  Total commits:   $COMMITS"
echo "  Active days:     $COMMIT_DAYS / $DAYS"

# Streak: count consecutive days from today backwards
STREAK=0
CHECK_DATE=$(date +%Y-%m-%d)
for i in $(seq 0 30); do
  CHECK_DATE=$(date -d "$i days ago" +%Y-%m-%d 2>/dev/null || date -v-${i}d +%Y-%m-%d 2>/dev/null || break)
  HAS_COMMIT=$(git log --oneline --after="${CHECK_DATE} 00:00" --before="${CHECK_DATE} 23:59" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$HAS_COMMIT" -gt 0 ]; then
    STREAK=$((STREAK + 1))
  elif [ "$i" -gt 0 ]; then
    break
  fi
done
echo "  Current streak:  $STREAK day(s) 🔥"
echo ""

# ── Files changed by area ─────────────────────────────────────────────────────
echo "## Changes by area"
FIRST=$(git log --since="$SINCE" --format="%H" 2>/dev/null | tail -1)
if [ -n "$FIRST" ]; then
  CHANGED=$(git diff --name-only "${FIRST}^" HEAD 2>/dev/null || true)
  FRONTEND=$(echo "$CHANGED" | grep -c "^grant-researcher/src" || true)
  CORE=$(echo "$CHANGED" | grep -c "^core/src" || true)
  DATA=$(echo "$CHANGED" | grep -c "^core/data" || true)
  DOCS=$(echo "$CHANGED" | grep -c "^docs" || true)
  CONFIG=$(echo "$CHANGED" | grep -cE "^(package|tsconfig|next\.config|tailwind)" || true)
  echo "  Frontend (grant-researcher/src): $FRONTEND file(s)"
  echo "  Core CLI (core/src):             $CORE file(s)"
  echo "  Data files (core/data):          $DATA file(s)"
  echo "  Docs:                            $DOCS file(s)"
  echo "  Config:                          $CONFIG file(s)"
else
  echo "  No commits in the past $DAYS days"
fi
echo ""

# ── Recent commits ────────────────────────────────────────────────────────────
echo "## Recent commits"
git log --oneline --since="$SINCE" --format="  %C(yellow)%h%Creset %s" 2>/dev/null | head -15 || \
git log --oneline --since="$SINCE" 2>/dev/null | head -15 | sed 's/^/  /'
echo ""

# ── Additions / deletions ─────────────────────────────────────────────────────
echo "## Lines changed (vs $DAYS days ago)"
FIRST_COMMIT=$(git log --since="$SINCE" --format="%H" 2>/dev/null | tail -1)
if [ -n "$FIRST_COMMIT" ]; then
  STATS=$(git diff --shortstat "${FIRST_COMMIT}^" HEAD 2>/dev/null || echo "  (no diff available)")
  echo "  $STATS"
else
  echo "  No commits in the past $DAYS days"
fi
echo ""

# ── Footer ────────────────────────────────────────────────────────────────────
echo "──────────────────────────────────────────────────────"
echo "  Run: bash scripts/dev-dashboard.sh [days]"
echo "  Example: bash scripts/dev-dashboard.sh 30"
echo ""
