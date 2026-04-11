---
name: work-to-be-done
description: Use when the user wants to figure out what to work on next — evaluates project state, challenges assumptions about priorities, and surfaces the highest-value next work for an AI application. Triggered by "what should I work on", "what's next", "help me prioritize", or starting a new session without a clear task.
---

# Work To Be Done

Evaluate project state, challenge the user's instincts, and land on the highest-value next action for an AI application.

## Process

### 1. Read the project state

Before asking anything, gather:
- `git log --oneline -20` — what just shipped?
- Open GitHub issues: `gh issue list --limit 20 --json number,title,labels,createdAt`
- `CLAUDE.md` and `.claude/CONTEXT.md` (if present) — what's the product vision and current milestone?
- Recent PRs: `gh pr list --state closed --limit 5` — what momentum exists?

Don't ask the user what's in the repo. Read it.

### 2. Ask one framing question

With that context in hand, ask a single question:

> "What are you thinking of working on next — and why?"

Let them answer before pushing back. This surfaces their assumptions.

### 3. Challenge with AI application lens

Using knowledge of what typically matters in AI applications, push back on their instincts. Common traps to probe:

| User instinct | Push back with |
|---------------|----------------|
| "Add more features" | Is the core loop good enough yet? More features on a shaky foundation compounds debt. |
| "Improve the UI" | What's the conversion/engagement evidence this is the bottleneck? |
| "Add more agents/models" | Are existing agents producing quality output? More agents amplify bad quality. |
| "Optimize prompts" | Is there an eval harness? Prompt tuning without evals is guessing. |
| "Fix a minor bug" | Is this bug on a user-critical path or a rare edge case? |
| "Rewrite X" | Is there measurable pain from the current implementation, or is this aesthetic? |
| "Add authentication/billing" | Is there a working product worth gating? Don't build the gate before the product. |

Ask at least 2 follow-up challenges before moving to recommendation. If the user has a strong answer that survives pushback, back down — their context beats general heuristics.

### 4. Score candidates by value

If multiple work items are on the table, compare them across:

| Dimension | Question |
|-----------|----------|
| **User impact** | Does this unblock or delight a real user path? |
| **Leverage** | Does this make future work faster or safer? |
| **Risk reduction** | Does this reduce the chance of a painful rework? |
| **Reversibility** | How hard is it to undo if it's wrong? |
| **Momentum** | Does this build on what just shipped, or context-switch the whole codebase? |

Prefer work that is high-leverage and reversible over work that is high-impact but hard to undo.

### 5. Recommend — take a position

Give a single recommendation. Say:
- What to do
- Why it's highest value *now* (not in the abstract)
- What to defer and why

It's fine to say "do A now, B next sprint."

### 6. Offer to go deeper

If the recommended work involves a non-obvious technical decision, offer:

> "Want to deep-dive this before planning? I can use `/problem-deep-dive` to explore approaches and write it up as a GitHub issue."

Only offer this if there's genuine ambiguity — don't default to it for straightforward tasks.

## Rules

- **Read before asking.** Never ask the user for information visible in git, issues, or CLAUDE.md.
- **Push back at least twice.** One challenge is easy to dismiss. Two challenges force genuine reflection.
- **Make a recommendation.** A list of considerations is not an output. Name the next thing.
- **Don't defer to user sycophantically.** If their instinct is wrong, say why clearly — then accept their decision if they push back with reasoning.
- **Defer to user judgment on constraints.** They know deadlines, team capacity, and business context you can't read.
