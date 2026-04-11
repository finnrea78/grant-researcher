---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
---

Stress-test this plan by working through every meaningful decision one at a time. Resolve dependencies in order — don't ask downstream questions before upstream ones are settled.

## Format for each question

Present **2-3 concrete options** with trade-offs, then give your recommendation:

> **Option A** — description. Trade-off: ...
> **Option B** — description. Trade-off: ...
> **Option C** (if applicable) — description. Trade-off: ...
>
> **My recommendation: Option B** — because ...

One question per message. Wait for the user's answer before continuing.

## Rules

- If a question can be answered by exploring the codebase, explore the codebase instead of asking.
- Skip questions whose answers are obvious from context.
- Flag genuine risks or contradictions clearly — this is a stress-test, not a rubber stamp.
- Once all branches are resolved, summarise the decisions made and confirm you've reached a shared understanding.
