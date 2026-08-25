# OPM Phase 2 — isolation and fan-out

Gate from `docs/opm-from-pi-plan.md`: Tasks 1–9 on the OPM branch, then this file.

## Scope

- Pack `sandbox`: policy profiles `off | workspace | container`. Default `off`.
  - `workspace`: edit/write inside cwd or tmp; deny `~/.ssh` `~/.aws` `~/.gnupg`; network allowed.
  - `container`: workspace rules plus deny network commands (`curl`, `wget`, `ssh`, …). Not a VM.
  - OS isolation (bubblewrap / gondolin QEMU) is later — no new npm dep in this phase.
- Pack `task`: tool `task` with `scout` (read+bash) and `worker` (all tools + verify pack). Spawn Pi `--mode json -p`.
- Profile `codex` loads sandbox and injects `--sandbox workspace`.

## Out of this phase

Browser pack, TTSR-lite, MEMORY.md, native grep, auto-commit, `computer` desktop.
