---
name: problem-deep-dive
description: Use when the user wants to explore a technical problem deeply before implementing — discussing trade-offs, learning about approaches, and capturing the outcome as a GitHub issue. Triggered by open-ended problem statements like "I'm having issues with X", "how should we approach Y", or "help me think through Z".
---

# Problem Deep Dive

Turn an open-ended technical problem into a well-researched GitHub issue, ready to pick up in a future session.

## Process

### 1. Understand — ask before assuming

Ask 3–5 targeted questions to establish:
- What is actually broken or slow or expensive?
- What have you already tried?
- What does success look like?
- What constraints exist (time, cost, API limits, team size)?

Then **read relevant code** before going further. Don't guess — look at the actual implementation.

### 2. Explore — present multiple approaches

Generate at least **3 distinct approaches**, ranging from quick/tactical to deep/architectural. For each:

| Dimension | What to cover |
|-----------|---------------|
| **How it works** | Concrete mechanism, not vague summary |
| **Trade-offs** | Latency, cost, complexity, maintainability |
| **Effort** | Hours / days to implement |
| **Risk** | What could go wrong |
| **Best for** | When you'd choose this |

Use concrete numbers where possible. "Costs ~3x less" beats "reduces cost".

### 3. Recommend — take a position

Pick one approach and say why. Consider:
- The user's actual constraints (not ideal-world constraints)
- The codebase they already have
- Reversibility — can we undo this if it's wrong?

It's fine to say "start with Approach A, migrate to B later."

### 4. Issue — write it up

Create a GitHub issue with `gh issue create` using this structure:

```
## Problem
[What is broken/slow/expensive and why it matters]

## Context
[Relevant code paths, configs, or metrics discovered during exploration]

## Approaches Considered

### Option A: [Name]
[How it works, trade-offs, effort]

### Option B: [Name]
[How it works, trade-offs, effort]

### Option C: [Name]
[How it works, trade-offs, effort]

## Recommended Approach
[Which option and why, given the constraints]

## Implementation Notes
[Key files to change, gotchas, suggested starting point]

## Open Questions
[Anything that needs a decision before implementing]
```

Label the issue appropriately (e.g. `performance`, `cost`, `architecture`).

## Rules

- **Never skip to solutions.** Complete at least 3 back-and-forth exchanges before recommending anything.
- **Read the code.** Grep and read files before claiming something is expensive or broken.
- **Don't hedge everything.** Make a recommendation — even a tentative one is more useful than a list of considerations.
- **One issue per problem.** If the conversation surfaces multiple unrelated problems, create separate issues.
