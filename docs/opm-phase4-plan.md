# OPM Phase 4 — TTSR-lite and MEMORY.md

Gate: Phase 3 browser pack on the OPM branch.

## Scope

- Pack `ttsr`: TTSR-lite on `message_update`.
  - Regex: unsolicited commit, skip-tests, auto-learn (including Vietnamese commit phrasing).
  - Hit → `ctx.abort()` once per user turn, then `pi.sendUserMessage(reminder, { deliverAs: "followUp" })`.
  - Reminder includes `[opm-ttsr]` so the injected text cannot re-trigger.
  - Reset `fired` on `before_agent_start` only when the prompt is not the reminder (avoids abort loops).
- Pack `memory`: project `MEMORY.md`.
  - Walk up from cwd; stop at `.git` after checking that directory.
  - YAML `description:` → `resources_discover` skill path (Pi will not load a non-`SKILL.md` file without it).
  - Otherwise append the file body to the system prompt. Never both.
  - `/memory` shows path + preview; `/memory init` writes the template in **cwd**. Never auto-write learnings.
- Default **off** in `opm-verify`. **On** in `opm-full` and `pi-super`.
- Disable: `--without ttsr` / `--without memory`, or `OPM_TTSR=0` / `OPM_MEMORY=0`.

## Models that break

Abort mid-stream + followUp is not a clean retry. On some models this can:

- loop (model repeats the forbidden line after the reminder)
- drop in-flight tool calls
- leave a half-written assistant message in the transcript

If that happens: `--without ttsr` or `OPM_TTSR=0`. A clean abort+retry hook would be an upstream Pi change, not this pack.

## Out of this phase

Native grep, OS VM sandbox, CDP click/type, auto `learn` → skill.
