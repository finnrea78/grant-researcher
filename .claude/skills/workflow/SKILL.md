---
name: workflow
description: Use when the user wants to navigate engineering workflow phases. Presents an interactive menu to select from Brainstorm, Plan, Implement, Debug, Review, Simplify, Verify, Ship, or Toolbox utilities, then invokes the matching skills or commands in sequence.
user-invocable: true
allowed-tools: AskUserQuestion, Skill, EnterWorktree, ExitWorktree
---

# Workflow Router

You are a menu router. Present choices, invoke the selected skills in order, then stop. Do not add commentary, tips, or process guidance.

## Step 1: Skill Selection

Show all groups at once in a single batched AskUserQuestion call with 4 questions — one per group. The user sees all groups simultaneously and picks skills from any combination. All questions use multiSelect: true.

Question 1:
- question: "Build — which steps? (select all that apply)"
- header: "Build"
- multiSelect: true
- options:
  - label: "Brainstorm" | description: "Explore intent, requirements, and design before writing anything"
  - label: "Grill Me" | description: "Stress-test a plan or design through relentless questioning"
  - label: "Plan" | description: "Write a structured multi-step implementation plan"

Question 2:
- question: "Implement — which approach?"
- header: "Implement"
- multiSelect: false
- options:
  - label: "Parallel (Subagents)" | description: "Dispatch independent tasks to multiple agents simultaneously"
  - label: "Sequential" | description: "Single-agent step-by-step plan execution with review checkpoints"
  - label: "Test-Driven" | description: "Write failing tests first, then implement to make them pass"
  - label: "Skip" | description: "Skip the implement stage"

Question 3:
- question: "Quality & Ship — which steps? (select all that apply)"
- header: "Quality"
- multiSelect: true
- options:
  - label: "Review" | description: "Code review — receive or deep PR analysis"
  - label: "Simplify" | description: "Review changed code for reuse, quality, and efficiency"
  - label: "Commit & PR" | description: "Commit, push, and open a pull request in one step"

Question 4a (shown as part of the same batched call):
- question: "Work Management — which tools? (select all that apply)"
- header: "Work Mgmt"
- multiSelect: true
- options:
  - label: "What To Work On" | description: "Evaluate project state and surface the highest-value next work for an AI app"
  - label: "Deep Dive" | description: "Explore a problem from multiple angles and file a GitHub issue"
  - label: "Triage Issues" | description: "Audit open GitHub issues — find what's done, stale, or still active"
  - label: "Improve Architecture" | description: "Surface architectural friction and propose module-deepening refactors as GitHub issue RFCs"

Question 4b — ask as a separate follow-up AskUserQuestion call immediately after the first batch:
- question: "Toolbox — which tools? (select all that apply)"
- header: "Toolbox"
- multiSelect: true
- options:
  - label: "Playground" | description: "Create an interactive HTML explorer or visual tool"
  - label: "Frontend Design" | description: "Build production-grade UI components and pages"
  - label: "Setup Audit" | description: "Analyse this codebase and recommend Claude Code automations"
  - label: "Improve Architecture" | description: "Surface architectural friction and propose module-deepening refactors as GitHub issue RFCs"

## Step 2: Skill Execution

After collecting all selections, resolve the Review sub-menu (Step 3) if needed, then invoke all selected skills in this canonical order:

1. "What To Work On" → invoke `work-to-be-done`
2. "Deep Dive" → invoke `problem-deep-dive`
3. "Triage Issues" → invoke `triage-issues`
4. "Brainstorm" → invoke `superpowers:brainstorming`
5. "Grill Me" → invoke `grill-me`
6. "Plan" → invoke `superpowers:writing-plans`
7. Implement — invoke based on the approach selected in Question 2:
   - "Parallel (Subagents)" → invoke `superpowers:subagent-driven-development`
   - "Sequential" → invoke `superpowers:executing-plans`
   - "Test-Driven" → invoke `superpowers:test-driven-development`
   - "Skip" → skip
8. "Review" → go to Step 3, then invoke the chosen review type(s)
9. "Simplify" → invoke `simplify`
10. "Commit & PR" → invoke `commit-commands:commit-push-pr`
11. "Playground" → invoke `playground:playground`
12. "Frontend Design" → invoke `frontend-design:frontend-design`
13. "Setup Audit" → invoke `claude-code-setup:claude-automation-recommender`
14. "Improve Architecture" → invoke `improve-codebase-architecture`

Skip any skill the user did not select.

## Step 3: Review type (only if "Review" was selected)

Use AskUserQuestion:

- question: "Which review steps? (select all that apply)"
- header: "Review"
- multiSelect: true
- options:
  - label: "Receive Review" | description: "Process and respond to inbound review feedback"
  - label: "PR Toolkit" | description: "Deep PR review using 6 specialized agents (comments, tests, types, simplification)"

Then invoke each selected skill in this order:
1. "Receive Review" → invoke `superpowers:receiving-code-review`
2. "PR Toolkit" → invoke `pr-review-toolkit:review-pr`

## Rules

1. **Router only.** Present menus and invoke skills. Do not add advice or commentary.
2. **All groups always visible.** Show Questions 1–4a in a single batched AskUserQuestion call (4 questions max), then immediately ask Question 4b in a second AskUserQuestion call. Never skip groups.
3. **Invoke in canonical order.** Execute selected skills in the numbered order from Step 2.
4. **Sub-menus only for required choices.** Step 3 (Review sub-menu) requires a real decision — ask it only when Review was selected. Implement approach is captured directly in Question 2 of Step 1.
