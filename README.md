<div align="center">

# ◈ cc-skill-router

### Project-aware skill recommender for Claude Code

**`SessionStart` hook · Advises, never auto-runs · Zero per-turn cost**

[![Lint](https://github.com/Alpha-Oi/cc-skill-router/actions/workflows/lint.yml/badge.svg)](https://github.com/Alpha-Oi/cc-skill-router/actions/workflows/lint.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-22a06b.svg)](LICENSE)
[![Last commit](https://img.shields.io/github/last-commit/Alpha-Oi/cc-skill-router?color=1f6feb)](https://github.com/Alpha-Oi/cc-skill-router/commits/main)

[English](README.md) · [Русский](README.ru.md) · [Contributing](CONTRIBUTING.md) · [Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md)

</div>

---

Global Claude Code skill + `SessionStart` hook that recommends which installed skill fits the task, with project-aware alternatives. **Advises, never auto-runs.**

Claude Code already routes to a skill when a request matches that skill's `description`. This adds the parts native routing doesn't do:

- a **once-per-session, project-aware** index of what's installed and whether each skill's preconditions are met;
- **project-aware alternatives** — if a skill needs an issue tracker or a label vocabulary that this repo hasn't set up, it proposes the setup step instead;
- awareness of **slash-only** skills (`disable-model-invocation`) that native routing never surfaces on its own;
- a **never-auto-invoke** list for heavy or outward-facing skills (`code-review`, `security-review`, anything that writes to external systems).

## Pieces

| File | Role |
|---|---|
| [`skills/skill-router/SKILL.md`](skills/skill-router/SKILL.md) | routing logic — loaded on demand when `Skill(skill-router)` is invoked, or auto-matched by its `description` |
| [`skills/skill-router/analyze-project.mjs`](skills/skill-router/analyze-project.mjs) | `SessionStart` hook script — injects a one-time, project-aware skill index at the start of each session |

The script reads only the filesystem — skill folders under `~/.claude/skills` and `<project>/.claude/skills`, plus a few marker files at the project root. No network, no writes. On any error it prints nothing and exits 0, so it can never block a session.

## Install

### Option A — `npx skills`

```bash
npx skills add https://github.com/Alpha-Oi/cc-skill-router --skill skill-router
```

Then add the hook (see below), since `npx skills` installs the skill but not the `settings.json` hook.

### Option B — manual

1. Copy `skills/skill-router/` to `~/.claude/skills/skill-router/`.
2. Add a `SessionStart` hook to `~/.claude/settings.json` (merge with existing keys — don't replace the file):

```jsonc
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "node \"~/.claude/skills/skill-router/analyze-project.mjs\"",
            "timeout": 15
          }
        ]
      }
    ]
  }
}
```

On Windows, `~` in the command may not expand — use the absolute path, e.g.
`node "C:/Users/<you>/.claude/skills/skill-router/analyze-project.mjs"`.

3. Restart Claude Code (or start a new session). The hook fires on session start, not mid-session.

## How it behaves

At session start the script injects a compact block: project root, which marker files are present, whether an issue tracker / triage labels are configured, the list of installed skills (with slash-only ones flagged), and the routing rules. During the session, Claude:

- **recommends** a skill on a clear match — one line, with a reason, then waits for your go-ahead;
- **proposes a setup step** instead when the matched skill's preconditions aren't met;
- **never auto-invokes** `code-review`, `security-review`, slash-only skills, or anything that writes to external systems — it only proposes those;
- **stays silent** about routing when nothing fits, and just does the work.

New skills need no edit — the hook re-reads the skill folders each session, so anything you install later is picked up automatically.

## Token cost

One injection per session — a few hundred tokens, scaling with how many skills are installed. Nothing per turn. The full `SKILL.md` logic is loaded only when routing actually happens.

## Tuning

- Routing table and rules: edit `SKILL.md`.
- How much the hook injects (description-length cap, which markers it reports, which rule lines it prints): edit `analyze-project.mjs`.
- The injected guidance text is in Russian; change the `log(...)` lines in `analyze-project.mjs` to translate it.

## Disable

Remove the `SessionStart` block from `~/.claude/settings.json`. To remove entirely, also delete `~/.claude/skills/skill-router/`.

## License

MIT — see [LICENSE](LICENSE).
