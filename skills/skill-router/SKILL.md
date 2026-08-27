---
name: skill-router
description: Recommend which installed skill(s) fit the current task, or a project-aware alternative when a skill's preconditions aren't met. Consult when unsure whether a skill applies to planning, architecture, tickets, triage, code review, domain modeling, or handoff work.
---

# skill-router

Advise, don't execute. This skill picks the right installed skill for the task in front of you, taking the project's own conventions into account. It never runs another skill on its own — it proposes, then waits for the user's go-ahead.

## When this runs

- A `SessionStart` hook (`analyze-project.mjs` in this folder) injects a one-time, project-aware skill index at the start of each session. That covers ambient guidance — you don't need to invoke this skill to get it.
- Invoke `Skill(skill-router)` for a deliberate routing decision on a specific task, or when the session-start guidance is stale because the working directory moved to a different project mid-session.

## Read the project first

Before recommending, check the project's conventions in this order — first hit wins:

1. `CLAUDE.md` / `AGENTS.md` at the project root, especially an `## Agent skills` section.
2. `CONTEXT.md`, or `CONTEXT-MAP.md` for multi-context repos, at the root.
3. `docs/agents/*.md` — `issue-tracker.md`, `triage-labels.md`, `domain.md`.
4. Structural signals: `package.json`, `pnpm-workspace.yaml`, language/framework, presence of `.git`.

Project root = nearest ancestor of the working directory containing `.git`, `CLAUDE.md`, or `AGENTS.md`; otherwise the working directory itself.

## How to recommend

1. **Clear single match** — name the skill in one line with a one-clause reason, then wait for "yes". Do not invoke it yourself.
2. **Several candidates** — if one clearly dominates, lead with it and name the runner-up in a clause. If it's close, list 2–3 with the trade-off and ask.
3. **Precondition missing** — if the matched skill needs setup that isn't done, propose the setup step instead of the skill:
   - `to-tickets` / `to-spec` / `triage` need an issue tracker → look for `docs/agents/issue-tracker.md`. Missing → propose `setup-matt-pocock-skills`, or a local `.scratch/<feature>/` markdown flow.
   - `triage` also needs a label vocabulary → `docs/agents/triage-labels.md`. Missing → same.
   - A skill named below that isn't actually installed → say so; don't pretend it's available.
4. **Never auto-invoke — propose only, always:** `code-review`, `security-review`; any skill marked `[только /слэш]` / `disable-model-invocation`; any skill that writes to external systems (creates issues, posts comments, commits, pushes); anything flagged Med/High risk by an install scan.
5. **Nothing fits** — say nothing about skills, just do the work the normal way. Never force-fit a skill.
6. **Stay out of the way** for `docx`, `pdf`, `xlsx`, `pptx`, `dataviz` and similar — Claude's built-in skill matching already handles those well.

When you do act on a match, one line is enough: `использую <skill> — <причина>`. When nothing matches, stay silent about routing entirely.

## Routing table — refinements for known skills

| Signal in the task | Skill | Handling |
|---|---|---|
| stress-test a plan / decision / architecture | `grilling` | recommend; safe to invoke once the user agrees |
| break a feature or discussion into tickets | `to-tickets` / `to-spec` | needs an issue tracker — see precondition rule |
| triage an incoming issue backlog | `triage` | needs install + label vocabulary |
| review a code change | `code-review` | propose only |
| security review of a change | `security-review` | propose only |
| glossary / domain model / ADRs | `domain-modeling` | recommend |
| improve codebase architecture | `improve-codebase-architecture` | propose only |
| conversation has grown long; continue elsewhere | `handoff` | remind; it is `/slash` only |
| first-time repo setup for these skills | `setup-matt-pocock-skills` | `/slash` only |

## Everything else — including skills installed in the future

For any installed skill not in the table above: match on its own `description`, then apply the same rules — recommend on a clear match, respect the never-auto-invoke list in rule 4, check for obvious preconditions, stay silent when nothing fits. New skills need no edit here; the `SessionStart` hook discovers them automatically by re-reading the skill folders each session.
