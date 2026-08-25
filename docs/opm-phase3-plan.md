# OPM Phase 3 — Browser evidence

Gate: Phase 2 sandbox + task on the OPM branch.

## Scope

- Pack `browser`: UI evidence only.
  - Actions: `snapshot` (Chrome/Chromium `--dump-dom`) and `screenshot` (`--screenshot=`).
  - URLs: `http`, `https`, `file`.
  - Binary: `OPM_CHROME_BIN` or first of `google-chrome-stable`, `google-chrome`, `chromium`, `chromium-browser`, `chrome` on `PATH`.
- Default **off** in `opm-verify`. **On** in `opm-full` and `pi-super`. `--with browser` enables it on any combo.
- Never add `computer` (desktop OS control).

## Decision vs original plan

`docs/opm-from-pi-plan.md` mentioned Puppeteer as an optionalDependency. Rejected for v1: that would need a dynamic `import()` (forbidden) or a hard dep with install lifecycle scripts. This phase spawns a Chrome/Chromium CLI already on the machine.

## Out of this phase

CDP click/type, Puppeteer, Playwright, OS VM sandbox, TTSR-lite, MEMORY.md, native grep.
