# Deployment & Observability

> Related: [[Architecture Review Index]] | [[Cost Architecture]] | [[Data Model & Typed DB Spine]] | [[Pipeline Status]]

## The real problem is observability, not the platform

"I can't see what it's doing even if it works" is an **in-app instrumentation gap**, not a Railway verdict. Moving to AWS would reproduce the same blindness with a bigger bill. Railway can stay.

Fix, in priority order:

1. **`pipeline_runs` table as the source of truth.** Per run: stage, model, tokens in/out, cost, latency, status, error. One table answers "what is it doing", "what does it cost", and feeds evaluation. Highest-value single addition — see [[Data Model & Typed DB Spine]] and [[AI Pipeline Design]].
2. **Structured JSON logging** (pino) — correlate by run id.
3. **Surface the SSE stream.** Live pipeline visibility already exists in the transport and is underused.
4. Hosted log/trace search only if still needed — Axiom / Better Stack / Sentry are pennies and platform-agnostic.

Re-evaluate Railway *only after* you can see the system. Right now you cannot tell whether the platform is the problem.

## Platform decision

- **Railway stays.** Pre-revenue solo product; it deploys a reproducible running app trivially.
- **No EKS/Kubernetes.** Operational surface contributes nothing; control plane alone ≈ $73/mo before nodes.
- **ECS Fargate** is only defensible if AWS experience is itself a goal — a *separate* track, off the critical path.
- The only deployment decision needed now: a **clean Dockerfile + 12-factor config** so the app is deployment-portable. Keeps the AWS door open as a deliberate, boxed, later exercise without committing to it.

Note the background **worker** ([[Cost Architecture]], [[Refactor Plan — Steel Thread]]) is one new process to deploy — Railway handles a worker service + cron natively, no orchestration layer required.
