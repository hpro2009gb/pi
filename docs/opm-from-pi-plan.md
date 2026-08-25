# OPM from Pi Implementation Plan

> Saved at `docs/opm-from-pi-plan.md` because the repo gitignores `plans/`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build **OPM**, a Pi-based distribution: stock Pi remains the engine; Oh My Pi (omp) and other agents are learned as optional packs with presets, not a second fork of the agent loop.

**Architecture:** A root `opm/` tree that is **not** an npm workspace package of pi-mono. The `opm` CLI launches `@earendil-works/pi-coding-agent` (or this repo’s `./pi-test.sh` during development) with a known set of Pi packages. Each capability is one Pi package (extension + optional skill/prompt). Presets turn packs on or off. Pi core (`packages/coding-agent/src`) is not given plan mode, MCP, subagents, or 31 tools.

**Tech Stack:** TypeScript (erasable syntax, same as Pi), Node >= 22.19, Pi extension API (`registerTool`, `registerCommand`, `on("tool_call")`), existing examples under `packages/coding-agent/examples/extensions/`, optional later native addon. Tests: Vitest via repo `node_modules` for pack units; `./test.sh` is **not** used for OPM packs unless a pack is later moved into a workspace package.

## Global Constraints

- Pi core philosophy stays: no plan/subagent/MCP/todo/permission-popup baked into `packages/coding-agent`.
- Do not fork `agent-loop.ts` or replace the TUI; wrap and extend.
- Do not vendor or copy oh-my-pi source; reimplement small pieces against Pi APIs (license-clean).
- Command `opm` is this product. Command `omp` is can1357/oh-my-pi. Command `pi` is upstream harness.
- Default preset is `opm-verify` (evidence, small diffs, no unsolicited commit). Preset `pi` is four tools only.
- No `any`. No inline imports. Pack code uses top-level imports only.
- Packs must be disableable with `opm --preset pi` or `opm config disable <pack>`.
- Do not auto-commit, auto-push, or auto-enforce agent-written “taste” skills.
- Sandbox default for trusted personal repos: off (Pi). Untrusted: `workspace` when the sandbox pack is installed.
- User-facing copy: Vietnamese OK in docs; code identifiers English.

## Approaches considered

1. **Fork Pi like omp** — put LSP, hashline, 31 tools in core. Rejected: loses Pi, diverges forever, hard to pull upstream.
2. **Only document `pi install` of third-party packages** — no product. Rejected: no preset, no verify discipline, no hashline.
3. **Wrapper CLI + first-party Pi packages (this plan)** — `opm` depends on Pi; packs live in `opm/packs/*`; presets compose them. Chosen.

---

## File map (new tree, not pi workspaces)

```
opm/
  README.md
  package.json                 # private; bin opm; does not join root workspaces
  tsconfig.json
  src/
    cli.ts                     # parse argv, resolve preset, spawn pi
    presets.ts                 # pi | opm-verify | opm-full
    pack-registry.ts           # pack id -> extension paths, default on/off
    spawn-pi.ts                # env, -e flags, PI_CODING_AGENT_DIR
  packs/
    verify/                    # system prompt + no-commit + evidence skill
    hashline/                  # override edit tool
    ask/                       # structured questions
    plan/                      # read-only gate + accept-to-execute
    lsp/                       # lsp tool + diagnostics after write/edit
    sandbox/                   # bash/edit/write path+net policy
    task/                      # subagents (from Pi example, later)
    browser/                   # optional UI verify (later)
  test/
    presets.test.ts
    hashline.test.ts
    plan-gate.test.ts
    lsp-diagnostics.test.ts
```

Root `package.json` workspaces stay `packages/*` only. Do not add `opm` to workspaces so `npm run check` on Pi does not typecheck OPM until we opt in.

---

## What we take / skip

| Take | From | How |
| --- | --- | --- |
| Agent loop, TUI, sessions, providers, skills, extension API | Pi | Depend / spawn |
| Hashline-style anchored edits | omp | Override `edit` via `registerTool({ name: "edit" })` |
| LSP diagnostics + go-to-def | omp / OPM example | New `lsp` tool; `tool_result` hook after edit/write |
| Structured questions | Claude Code, Pi `question.ts` | `ask` tool |
| Plan as **tool filter + accept gate** | Claude Code, Cline, Pi `plan-mode/` | Pack `plan` |
| Subagents isolated context | Pi `subagent/`, omp `task` | Pack `task` in v2 |
| Evidence / small-diff / no surprise commit | User OPM philosophy | Pack `verify` |
| OS workspace sandbox | Codex, Pi `sandbox/` | Pack `sandbox` in v2 |
| Skip | 31-tool dump, `computer` desktop, MCP-in-core, `omp commit` default, auto `learn` skills, 80k Rust rewrite, `/collab` relay | Out of v1 |

---

## Presets

| Preset | Packs on | Tools the model sees |
| --- | --- | --- |
| `pi` | none | `read`, `bash`, `edit`, `write` (stock Pi edit) |
| `opm-verify` | verify, hashline, ask, lsp | those four + `ask` + `lsp`; hashline edit |
| `opm-plan` | opm-verify + plan | write/edit disabled until accept |
| `opm-full` | all installed packs | union; still no `computer`, no MCP unless user enables later |

---

### Task 1: Scaffold `opm/` CLI that launches Pi with zero packs

**Files:**
- Create: `opm/package.json`
- Create: `opm/tsconfig.json`
- Create: `opm/src/cli.ts`
- Create: `opm/src/spawn-pi.ts`
- Create: `opm/src/presets.ts`
- Create: `opm/src/pack-registry.ts`
- Create: `opm/test/presets.test.ts`
- Create: `opm/README.md`

**Interfaces:**
- Consumes: `pi` binary on PATH, or `OPM_PI_BIN`, or repo `./pi-test.sh` when `OPM_PI_FROM_SOURCE=1`
- Produces: `resolveLaunchPlan(argv): LaunchPlan` with `{ preset, extraArgs, extensionPaths, env }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { resolveLaunchPlan } from "../src/presets.ts";

describe("resolveLaunchPlan", () => {
	it("preset pi passes no extension paths", () => {
		const plan = resolveLaunchPlan(["--preset", "pi", "-p", "hello"]);
		expect(plan.preset).toBe("pi");
		expect(plan.extensionPaths).toEqual([]);
		expect(plan.extraArgs).toEqual(["-p", "hello"]);
	});

	it("default preset is opm-verify", () => {
		const plan = resolveLaunchPlan([]);
		expect(plan.preset).toBe("opm-verify");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd opm && node ../node_modules/vitest/dist/cli.js --run test/presets.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**

`opm/package.json`:

```json
{
  "name": "opm",
  "private": true,
  "type": "module",
  "bin": { "opm": "./src/cli.ts" },
  "engines": { "node": ">=22.19.0" }
}
```

`opm/src/presets.ts` (initial; pack paths filled in later tasks):

```ts
export type PresetName = "pi" | "opm-verify" | "opm-plan" | "opm-full";

export type LaunchPlan = {
	preset: PresetName;
	extensionPaths: string[];
	extraArgs: string[];
};

const PRESET_FLAG = "--preset";

export function resolveLaunchPlan(argv: string[]): LaunchPlan {
	const extraArgs: string[] = [];
	let preset: PresetName = "opm-verify";
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;
		if (arg === PRESET_FLAG) {
			const value = argv[++i];
			if (value === "pi" || value === "opm-verify" || value === "opm-plan" || value === "opm-full") {
				preset = value;
			} else {
				throw new Error(`Unknown preset: ${value ?? "(missing)"}`);
			}
			continue;
		}
		extraArgs.push(arg);
	}
	return { preset, extraArgs, extensionPaths: [] };
}
```

`opm/src/cli.ts`: parse `process.argv.slice(2)`, call `spawnPi(resolveLaunchPlan(...))`.

`opm/src/spawn-pi.ts`: `spawn(piBin, ["-e", ...paths, ...extraArgs], { stdio: "inherit", env })`. Never `git add -A`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd opm && node ../node_modules/vitest/dist/cli.js --run test/presets.test.ts`

Expected: PASS

- [ ] **Step 5: Manual smoke**

Run: `OPM_PI_FROM_SOURCE=1 node opm/src/cli.ts --preset pi --help`

Expected: Pi help (or coding-agent help) prints; process exit 0.

- [ ] **Step 6: Commit**

```bash
git add opm/package.json opm/tsconfig.json opm/src/cli.ts opm/src/spawn-pi.ts opm/src/presets.ts opm/src/pack-registry.ts opm/test/presets.test.ts opm/README.md
git commit -m "feat(opm): scaffold CLI wrapper that launches Pi"
```

---

### Task 2: Pack registry wires preset → extension paths

**Files:**
- Modify: `opm/src/pack-registry.ts`
- Modify: `opm/src/presets.ts`
- Modify: `opm/test/presets.test.ts`

**Interfaces:**
- Consumes: `LaunchPlan` from Task 1
- Produces: `packPath(id: PackId): string` resolved relative to `opm/packs/<id>/index.ts`

```ts
export type PackId = "verify" | "hashline" | "ask" | "plan" | "lsp" | "sandbox" | "task" | "browser";

export const PRESET_PACKS: Record<PresetName, PackId[]> = {
	pi: [],
	"opm-verify": ["verify", "hashline", "ask", "lsp"],
	"opm-plan": ["verify", "hashline", "ask", "lsp", "plan"],
	"opm-full": ["verify", "hashline", "ask", "lsp", "plan", "sandbox", "task", "browser"],
};
```

Missing pack files: `resolveLaunchPlan` **skips** absent paths and records `warnings: string[]` (do not crash). Tests: `pi` → `[]`; `opm-verify` → four paths ending in `verify/index.ts` etc. even if files do not exist yet (paths are computed, spawn may fail later).

- [ ] **Step 1: Extend tests** for pack path computation and skip-missing.
- [ ] **Step 2: Run tests** — expect FAIL on new assertions.
- [ ] **Step 3: Implement `pack-registry.ts` + wire `presets.ts`.**
- [ ] **Step 4: Tests PASS.**
- [ ] **Step 5: Commit** `feat(opm): map presets to pack extension paths`

---

### Task 3: `verify` pack — OPM system prompt, no unsolicited git write

**Files:**
- Create: `opm/packs/verify/index.ts`
- Create: `opm/packs/verify/VERIFY.md` (skill text loaded into append prompt)
- Create: `opm/test/verify-hooks.test.ts`

**Interfaces:**
- Consumes: `ExtensionAPI` from `@earendil-works/pi-coding-agent`
- Produces: `pi.appendSystemPrompt(text)` equivalent via `pi.on("before_agent_start")` returning extra prompt, **or** `resource` append if using DefaultResourceLoader — prefer `pi.on("session_start")` + documented `APPEND_SYSTEM.md` copy into `~/.opm/agent/` only when `opm init` runs. For the pack itself: `pi.on("tool_call")` blocks `bash` when command matches `git commit|git push|git reset --hard` unless user text this turn contains an explicit commit/push request flag stored on the session.

Implementation rules:

- Append guidelines: read repo conventions first; small diffs; bugfix needs repro; UI needs UI check; never commit unless the user asked in this session.
- `tool_call` on `bash`: if `/git\s+commit/i.test(command)` and `!sessionAllowsGitWrite`, return `{ block: true, reason: "verify pack: commit only when the user asked" }`.
- Detect user ask: last user message matches `/\b(commit|push|tao commit|git commit)\b/i`.

Test: pure function `shouldBlockGitWrite(command, lastUserText)` in the same file, exported for tests (not a one-off helper with a single call site — it has test + hook call sites).

- [ ] **Step 1: Test `shouldBlockGitWrite("git commit -am x", "fix the bug") === true` and `false` when user said `hay commit giup minh`.**
- [ ] **Step 2: FAIL then implement.**
- [ ] **Step 3: Extension default export registers the hook.**
- [ ] **Step 4: Commit** `feat(opm): add verify pack with evidence prompt and git-write gate`

---

### Task 4: `hashline` pack — override `edit` with content-hash anchors

**Files:**
- Create: `opm/packs/hashline/index.ts`
- Create: `opm/packs/hashline/anchors.ts`
- Create: `opm/test/hashline.test.ts`

**Interfaces:**
- Consumes: file text as UTF-8, LF-normalized like Pi `edit-diff.ts`
- Produces: `lineAnchors(content): { hash: string; line: string }[]` and `applyHashlineEdits(content, edits): { next: string } | { error: string }`

Anchor: first 8 hex chars of SHA-256 of the **exact line without newline**. Collision on two identical lines: require `occurrence` (1-based) on the edit object.

Schema for overridden `edit` tool:

```ts
{
  path: string,
  edits: Array<{
    hash: string,
    occurrence?: number,
    newText: string,
  }>
}
```

`read` override in the same pack: after reading a text file, prepend a header `<!-- hashline -->` and prefix each line `HHHHHHHH|`. Keep original `read` renderer if possible; if not, return text with prefixes (model must see hashes). Do **not** change binary/image reads.

If any hash is missing or occurrence OOB, throw (Pi tool error path). Never write a partial file.

Fallback: if `OPM_HASHLINE=0`, do not register overrides (preset `pi` already has no pack).

Tests (no disk required for anchors):

- `lineAnchors("a\nb\n")` length 2
- identical lines `x\nx\n` need occurrence 1 vs 2
- stale hash → error string contains `stale`

- [ ] **Step 1: Write hashline unit tests.**
- [ ] **Step 2: Run FAIL.**
- [ ] **Step 3: Implement `anchors.ts` then tool override using `fs/promises` + `withFileMutationQueue` like `examples/extensions/tool-override.ts`.**
- [ ] **Step 4: Tests PASS.**
- [ ] **Step 5: Commit** `feat(opm): hashline edit/read override pack`

---

### Task 5: `ask` pack — structured questions

**Files:**
- Create: `opm/packs/ask/index.ts`
- Test: `opm/test/ask-schema.test.ts` (schema/static only)

**Interfaces:**
- Consumes: Pi `ctx.ui.select` / `confirm` from ExtensionContext
- Produces: tool `ask` with parameters `{ question: string, options?: string[], multi?: boolean }`

Behavior: if `options` length >= 2, `ctx.ui.select`; else `ctx.ui.input` or confirm yes/no when options are `["yes","no"]`. Return chosen values as tool text. `executionMode: "sequential"`.

Copy structure from `packages/coding-agent/examples/extensions/question.ts` (read that file in full before writing). Do not add a todo tool.

- [ ] **Step 1: Schema test: TypeBox object requires `question`.**
- [ ] **Step 2: Implement extension.**
- [ ] **Step 3: Commit** `feat(opm): ask pack for structured user questions`

---

### Task 6: `plan` pack — read-only until accept

**Files:**
- Create: `opm/packs/plan/index.ts`
- Create: `opm/test/plan-gate.test.ts`
- Read in full first: `packages/coding-agent/examples/extensions/plan-mode/index.ts` and `utils.ts`

**Interfaces:**
- Consumes: `pi.setActiveTools` / tool_call block (match whatever the copied example uses in this repo version)
- Produces: `/plan` toggle; while on, block `edit`/`write` and non-allowlisted `bash`; on accept, restore tools and send a user message “Execute the accepted plan.”

Export `isPlanSafeBash(command: string): boolean` copied from the example allowlist (ls, rg, git status, …). Test a few commands.

Difference from Pi example: **do not auto-execute**. Show `ctx.ui.confirm("Accept plan and enable writes?")`. Cancel leaves plan mode on.

- [ ] **Step 1: Test allowlist.**
- [ ] **Step 2: Implement pack from example, with confirm gate.**
- [ ] **Step 3: Commit** `feat(opm): plan pack with accept gate`

---

### Task 7: `lsp` pack — diagnostics after mutations + `lsp` tool

**Files:**
- Create: `opm/packs/lsp/index.ts`
- Create: `opm/packs/lsp/spawn-lsp.ts`
- Create: `opm/test/lsp-spawn.test.ts`

**Interfaces:**
- Consumes: optional `typescript-language-server` / `gopls` on PATH; if missing, tool returns a clear error, does not crash Pi
- Produces: tool `lsp` `{ action: "diagnostics"|"definition"|"references"|"hover", path: string, line?: number, character?: number }`

v1 scope: **TypeScript/JavaScript only** via `typescript-language-server --stdio` if present. Other languages: error `unsupported in v1`.

After `tool_result` for `edit`/`write` on `*.ts`, `*.tsx`, `*.js`, `*.jsx`, run diagnostics and `pi.notify` or append a short tool-visible note via `after` hook if the API allows modifying results (`tool_result` event result). If the hook cannot inject, `ctx.ui.notify` in interactive mode only.

Tests: mock spawn — do not require a real language server in CI. Unit-test JSON-RPC message framing helper.

- [ ] **Step 1: Test framing encode/decode for one LSP request.**
- [ ] **Step 2: Implement stdio client minimal (initialize, textDocument/didOpen, diagnostic pull).**
- [ ] **Step 3: Commit** `feat(opm): lsp pack for ts/js diagnostics`

---

### Task 8: `opm init` writes user dir without clobbering Pi auth

**Files:**
- Modify: `opm/src/cli.ts`
- Create: `opm/src/init.ts`

**Interfaces:**
- Produces: `~/.opm/agent/` with `settings.json` pointing packages at `opm/packs` via **local path** `pi install` semantics documented in README. Auth: read `~/.pi/agent/auth.json` if present (do not copy secrets into git). Set `PI_CODING_AGENT_DIR` to `~/.opm/agent` for `opm` sessions so OPM settings do not overwrite `~/.pi/agent/settings.json`.

`opm init` is idempotent. Tests: run against `os.tmpdir()`.

- [ ] **Step 1: Test init in tmpdir creates settings.json.**
- [ ] **Step 2: Implement.**
- [ ] **Step 3: Commit** `feat(opm): init separate config dir, reuse Pi auth`

---

### Task 9: README + usage matrix for Văn

**Files:**
- Modify: `opm/README.md`

Must include: install (use this repo), `opm --preset pi`, `opm --preset opm-verify`, difference vs `omp` (oh-my-pi), security (still user-permission; sandbox pack later), “do not commit unless asked”.

- [ ] **Step 1: Write README.**
- [ ] **Step 2: Commit** `docs(opm): usage and preset matrix`

---

## Later phases (own plans after Task 9 works)

Do not start these until Tasks 1–9 are merged on the OPM branch and `opm --preset opm-verify -p "list files"` works against `./pi-test.sh`.

### Phase 2 — Isolation and fan-out

- Pack `sandbox`: start from `packages/coding-agent/examples/extensions/sandbox/` and `gondolin/`; add Codex-like profile names `off | workspace | container`. Default `off`.
- Pack `task`: start from `packages/coding-agent/examples/extensions/subagent/`; worker inherits verify pack; scout is read-only tools.

### Phase 3 — Browser evidence

- Pack `browser`: Puppeteer optional dependency; off in `opm-verify` until user enables. Never add `computer` (full desktop) in this product unless a later spec is approved.

### Phase 4 — TTSR-lite and memory

- TTSR-lite: `message_update` regex → `abort()` → inject reminder message → `continue()` / `followUp`. Document models that break.
- Memory: `MEMORY.md` in project, user-reviewed; no auto `learn` → skill.

### Phase 5 — Optional native grep

- Only if node `grep` pack is too slow. New crate under `opm/native`, optionalDependency. Fallback to `rg` then JS.

### Upstream Pi PRs (optional, separate)

Only if packs hit a wall:

- Stream abort + retry hook for clean TTSR (today: abort + followUp).
- Official “pack preset” in Pi itself — **not required**; OPM wrapper is enough.

---

## Test strategy

- Unit tests in `opm/test` with Vitest from repo root `node_modules`.
- No full `./test.sh` for OPM (avoids e2e/LLM).
- After hashline+verify exist: one harness-style test with faux provider is allowed only inside `opm/test` using `@earendil-works/pi-ai` faux, not paid APIs.
- `npm run check` remains Pi-only until OPM is a workspace package (out of scope).

## Done when

- `opm --preset pi` behaves like stock Pi tools.
- `opm --preset opm-verify` loads verify+hashline+ask+lsp.
- `opm --preset opm-plan` cannot edit until confirm.
- Git commit via bash is blocked unless the user asked.
- Hashline rejects stale hashes.
- Oh-my-pi is not a dependency.

---

## Execution order

Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9, then stop for review. Phase 2+ is a second plan file.
